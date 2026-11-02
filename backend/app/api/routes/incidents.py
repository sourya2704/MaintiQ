import json
import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Header, Query, Response, UploadFile, status
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, get_incident_for_user, get_machine_for_user, require_roles
from app.core.config import get_settings
from app.core.errors import AppError, conflict, forbidden, not_found
from app.db.base import utcnow
from app.models import AIProcessingJob, AudioAsset, AuditEvent, Incident, MaintenanceOutcome, User
from app.models.enums import (
    AnalysisSource,
    JobStatus,
    ProcessingStatus,
    ResolutionStatus,
    RetentionStatus,
    ReviewStatus,
    Role,
    TranscriptSource,
    Urgency,
)
from app.schemas.common import Page
from app.schemas.incidents import (
    AuditOut,
    FieldProvenance,
    IncidentDetail,
    IncidentListItem,
    IncidentUpdate,
    JobOut,
    OutcomeIn,
    OutcomeOut,
    ProcessingAccepted,
    RelatedResponse,
)
from app.services import audit, memory_engine, pipeline, storage
from app.services.providers import timbre
from app.services.providers.base import ProviderError
from app.services.symptoms import tag_symptoms

router = APIRouter(prefix="/api/incidents", tags=["incidents"])
Lead = Annotated[User, Depends(require_roles(Role.admin, Role.supervisor))]

TRANSCRIPT_LABELS = {
    TranscriptSource.prisma: "Transcribed by Gnani Prisma (live)",
    TranscriptSource.prisma_mock: "Prisma MOCK fixture (not a live provider call)",
    TranscriptSource.manual: "Entered manually",
    TranscriptSource.seed: "Fictional demo data",
}
ANALYSIS_LABELS = {
    AnalysisSource.evon: "AI-suggested by Gnani Evon (live), unreviewed",
    AnalysisSource.evon_mock: "AI-suggested by Evon MOCK (rule-based, no model call), unreviewed",
    AnalysisSource.manual: "Entered manually, unreviewed",
    AnalysisSource.seed: "Fictional demo data",
}


def provenance(inc: Incident) -> FieldProvenance:
    t = TRANSCRIPT_LABELS.get(inc.transcript_source, "No transcript yet")
    if inc.transcript_edited and inc.transcript_original:
        t += "; edited by technician (original preserved)"
    if inc.review_status == ReviewStatus.confirmed:
        fields = "Technician-confirmed"
    else:
        fields = ANALYSIS_LABELS.get(inc.analysis_source, "Not analysed yet")
    return FieldProvenance(
        transcript=t,
        structured_fields=fields,
        suspected_causes="Hypotheses only; not verified causes",
        outcome="Technician-recorded outcome" if inc.outcomes else "Outcome unknown/unrecorded",
    )


def detail(inc: Incident) -> IncidentDetail:
    out = IncidentDetail.model_validate(inc)
    out.provenance = provenance(inc)
    return out


def _load(db, user, incident_id, lock=False) -> Incident:
    return get_incident_for_user(db, user, incident_id, lock=lock)


# --------------------------------------------------------------------------- create / list / read


@router.post("", response_model=IncidentDetail, status_code=status.HTTP_201_CREATED,
             responses={200: {"description": "Existing incident returned for a repeated Idempotency-Key"}})
async def create_incident(
    db: DB,
    user: CurrentUser,
    background: BackgroundTasks,
    machine_id: Annotated[uuid.UUID, Form()],
    audio_file: Annotated[UploadFile | None, File()] = None,
    transcript: Annotated[str | None, Form(max_length=20000)] = None,
    language_code: Annotated[str | None, Form(max_length=32)] = None,
    occurred_at: Annotated[datetime | None, Form()] = None,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key", max_length=128)] = None,
):
    """Create an incident from a voice note (Prisma transcription starts automatically)
    or from a manually typed transcript (PRD FR-004/FR-006)."""
    has_audio = audio_file is not None and bool(audio_file.filename)
    manual = (transcript or "").strip()
    if has_audio == bool(manual):
        raise AppError(422, "validation_error", "Provide either audio_file or transcript (exactly one)")
    machine = get_machine_for_user(db, user, machine_id)

    if idempotency_key:
        existing = db.scalar(select(Incident).where(
            Incident.organization_id == user.organization_id, Incident.idempotency_key == idempotency_key))
        if existing:
            return JSONResponse(status_code=200, content=json.loads(detail(existing).model_dump_json()))

    incident = Incident(
        organization_id=user.organization_id, machine_id=machine.id, reporter_id=user.id,
        idempotency_key=idempotency_key, occurred_at=occurred_at or utcnow(),
        transcript_language=language_code or get_settings().prisma_language_code,
    )
    incident.machine = machine
    stored = None
    if has_audio:
        stored = storage.save_audio(user.organization_id, audio_file.filename, await audio_file.read())
        incident.processing_status = ProcessingStatus.uploaded
    else:
        incident.transcript_original = manual
        incident.transcript_source = TranscriptSource.manual
        incident.processing_status = ProcessingStatus.transcribed
        pipeline.refresh_search_text(incident)
    db.add(incident)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        if stored:
            storage.delete_file(stored.storage_key)
        existing = db.scalar(select(Incident).where(
            Incident.organization_id == user.organization_id, Incident.idempotency_key == idempotency_key))
        if existing:
            return JSONResponse(status_code=200, content=json.loads(detail(existing).model_dump_json()))
        raise

    job = None
    if stored:
        db.add(AudioAsset(incident_id=incident.id, storage_key=stored.storage_key, mime_type=stored.mime_type,
                          size_bytes=stored.size_bytes, duration_seconds=stored.duration_seconds,
                          original_filename=stored.original_filename, delete_after=stored.delete_after))
        db.flush()
        db.refresh(incident)
    audit.record(db, organization_id=user.organization_id, actor_id=user.id, entity_type="incident",
                 entity_id=incident.id, action="incident_created",
                 details={"input": "audio" if stored else "manual_transcript", "machine": machine.asset_code})
    if stored:
        job = pipeline.begin_transcription(db, incident, user.id)
    db.commit()
    if job:
        background.add_task(pipeline.run_transcription, incident.id, job.id)
    db.refresh(incident)
    return detail(incident)


@router.get("", response_model=Page[IncidentListItem])
def list_incidents(
    db: DB,
    user: CurrentUser,
    q: str | None = Query(default=None, max_length=200, description="Full-text search over incident facts"),
    machine_id: uuid.UUID | None = None,
    symptom: str | None = Query(default=None, description="Canonical symptom tag, e.g. vibration"),
    processing_status: ProcessingStatus | None = None,
    review_status: ReviewStatus | None = None,
    resolution_status: ResolutionStatus | None = None,
    urgency: Urgency | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    include_seed: bool = True,
    mine: bool = Query(default=False, description="Only incidents I reported"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    stmt = select(Incident).where(Incident.organization_id == user.organization_id)
    if q:
        stmt = stmt.where(Incident.search_vector.op("@@")(func.websearch_to_tsquery("english", q)))
    if machine_id:
        stmt = stmt.where(Incident.machine_id == machine_id)
    if symptom:
        stmt = stmt.where(Incident.symptom_tags.any(symptom.strip().lower().replace(" ", "_")))
    for col, val in ((Incident.processing_status, processing_status), (Incident.review_status, review_status),
                     (Incident.resolution_status, resolution_status), (Incident.urgency, urgency)):
        if val:
            stmt = stmt.where(col == val)
    if date_from:
        stmt = stmt.where(Incident.occurred_at >= date_from)
    if date_to:
        stmt = stmt.where(Incident.occurred_at <= date_to)
    if not include_seed:
        stmt = stmt.where(Incident.is_seed.is_(False))
    if mine:
        stmt = stmt.where(Incident.reporter_id == user.id)
    total =db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(
        stmt.options(selectinload(Incident.machine), selectinload(Incident.reporter))
        .order_by(Incident.occurred_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return Page(items=rows, total=total, page=page, page_size=page_size)


@router.get("/{incident_id}", response_model=IncidentDetail)
def get_incident(incident_id: uuid.UUID, db: DB, user: CurrentUser):
    return detail(_load(db, user, incident_id))


# --------------------------------------------------------------------------- edit / review


@router.patch("/{incident_id}", response_model=IncidentDetail)
def update_incident(incident_id: uuid.UUID, body: IncidentUpdate, db: DB, user: CurrentUser):
    inc = _load(db, user, incident_id, lock=True)
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        return detail(inc)
    if inc.processing_status in (ProcessingStatus.transcribing, ProcessingStatus.analyzing):
        raise conflict("processing_in_progress", "Wait for processing to finish before editing")
    if inc.review_status == ReviewStatus.confirmed and user.role == Role.technician:
        raise forbidden("This incident is confirmed; a supervisor must make further edits")

    if "transcript_edited" in changes:
        text = (changes.pop("transcript_edited") or "").strip()
        if inc.transcript_original is None:
            # Manual fallback after failed/unavailable transcription (FR-006).
            if inc.processing_status not in (ProcessingStatus.uploaded, ProcessingStatus.transcription_failed):
                raise conflict("invalid_state", "Transcript cannot be entered in the current state")
            if not text:
                raise AppError(422, "validation_error", "Transcript text is required")
            inc.transcript_original = text
            inc.transcript_source = TranscriptSource.manual
            inc.processing_status = ProcessingStatus.transcribed
            audit.record(db, organization_id=inc.organization_id, actor_id=user.id, entity_type="incident",
                         entity_id=inc.id, action="manual_transcript_entered")
        else:
            inc.transcript_edited = text or None  # empty edit reverts to the original
            if inc.analysis_source and inc.review_status == ReviewStatus.draft:
                note = "Transcript edited after analysis; re-run analysis or review fields manually"
                if note not in inc.analysis_warnings:
                    inc.analysis_warnings = [*inc.analysis_warnings, note]
            audit.record(db, organization_id=inc.organization_id, actor_id=user.id, entity_type="incident",
                         entity_id=inc.id, action="transcript_edited",
                         details={"chars": len(text), "reverted": not text})

    if changes:
        for k, v in changes.items():
            setattr(inc, k, v)
        if inc.analysis_source is None:
            inc.analysis_source = AnalysisSource.manual
        if "symptoms" in changes:
            inc.symptom_tags = tag_symptoms(" ".join(inc.symptoms), inc.transcript or "")
        audit.record(db, organization_id=inc.organization_id, actor_id=user.id, entity_type="incident",
                     entity_id=inc.id, action="fields_edited", details={"fields": sorted(changes)})
    pipeline.refresh_search_text(inc)
    db.commit()
    db.refresh(inc)
    return detail(inc)


@router.post("/{incident_id}/confirm", response_model=IncidentDetail)
def confirm_incident(incident_id: uuid.UUID, db: DB, user: CurrentUser):
    """Human confirmation: fields become 'Technician-confirmed' (FR-010)."""
    inc = _load(db, user, incident_id, lock=True)
    if inc.review_status == ReviewStatus.confirmed:
        return detail(inc)
    if inc.processing_status in (ProcessingStatus.transcribing, ProcessingStatus.analyzing):
        raise conflict("processing_in_progress", "Wait for processing to finish before confirming")
    if not inc.transcript or not (inc.summary or "").strip():
        raise conflict("incomplete", "A transcript and summary are required before confirmation")
    inc.review_status = ReviewStatus.confirmed
    inc.confirmed_by_id = user.id
    inc.confirmed_at = utcnow()
    audit.record(db, organization_id=inc.organization_id, actor_id=user.id, entity_type="incident",
                 entity_id=inc.id, action="incident_confirmed")
    db.commit()
    db.refresh(inc)
    return detail(inc)


# --------------------------------------------------------------------------- AI processing


@router.post("/{incident_id}/transcribe", response_model=ProcessingAccepted, status_code=status.HTTP_202_ACCEPTED)
def transcribe_incident(incident_id: uuid.UUID, db: DB, user: CurrentUser, background: BackgroundTasks):
    """Retry Prisma transcription after a failure."""
    inc = _load(db, user, incident_id, lock=True)
    job = pipeline.begin_transcription(db, inc, user.id)
    db.commit()
    background.add_task(pipeline.run_transcription, inc.id, job.id)
    return ProcessingAccepted(incident_id=inc.id, job_id=job.id, processing_status=inc.processing_status, mode=job.mode)


@router.post("/{incident_id}/analyze", response_model=ProcessingAccepted, status_code=status.HTTP_202_ACCEPTED)
def analyze_incident(incident_id: uuid.UUID, db: DB, user: CurrentUser, background: BackgroundTasks):
    """Run or retry Evon structured extraction. Poll GET /api/incidents/{id} for the result."""
    inc = _load(db, user, incident_id, lock=True)
    job = pipeline.begin_analysis(db, inc, user.id)
    db.commit()
    background.add_task(pipeline.run_analysis, inc.id, job.id)
    return ProcessingAccepted(incident_id=inc.id, job_id=job.id, processing_status=inc.processing_status, mode=job.mode)


@router.get("/{incident_id}/jobs", response_model=list[JobOut])
def incident_jobs(incident_id: uuid.UUID, db: DB, user: CurrentUser):
    return _load(db, user, incident_id).jobs


# --------------------------------------------------------------------------- memory


@router.get("/{incident_id}/related", response_model=RelatedResponse)
def related_incidents(incident_id: uuid.UUID, db: DB, user: CurrentUser, limit: int = Query(default=5, ge=1, le=20)):
    inc = _load(db, user, incident_id)
    text = " ".join(filter(None, [inc.summary, " ".join(inc.symptoms), " ".join(inc.observations), inc.transcript]))
    tags = inc.symptom_tags or tag_symptoms(text)
    results = memory_engine.find_related(db, memory_engine.MemoryQuery(
        organization_id=user.organization_id, text=text, symptom_tags=tags, machine_id=inc.machine_id,
        machine_type=inc.machine.type, exclude_incident_id=inc.id, limit=limit,
    ))
    return RelatedResponse(incident_id=inc.id, query_symptoms=tags, results=results, no_match=not results)


# --------------------------------------------------------------------------- outcomes


@router.post("/{incident_id}/outcome", response_model=OutcomeOut, status_code=status.HTTP_201_CREATED)
def record_outcome(incident_id: uuid.UUID, body: OutcomeIn, db: DB, user: CurrentUser):
    """Record what was actually done and whether it worked (FR-013). Separate from AI suggestions."""
    inc = _load(db, user, incident_id, lock=True)
    resolved_at = body.resolved_at or (utcnow() if body.resolution_status == ResolutionStatus.resolved else None)
    outcome = MaintenanceOutcome(
        incident_id=inc.id, verified_cause=(body.verified_cause or "").strip() or None,
        action_performed=body.action_performed.strip(), parts_used=body.parts_used,
        resolution_status=body.resolution_status, notes=body.notes, verified_by_id=user.id, resolved_at=resolved_at,
    )
    db.add(outcome)
    inc.outcomes.append(outcome)
    inc.resolution_status = body.resolution_status
    pipeline.refresh_search_text(inc)
    audit.record(db, organization_id=inc.organization_id, actor_id=user.id, entity_type="incident",
                 entity_id=inc.id, action="outcome_recorded",
                 details={"resolution_status": body.resolution_status, "verified_cause_given": bool(outcome.verified_cause)})
    db.commit()
    db.refresh(outcome)
    return outcome


@router.get("/{incident_id}/outcomes", response_model=list[OutcomeOut])
def list_outcomes(incident_id: uuid.UUID, db: DB, user: CurrentUser):
    return _load(db, user, incident_id).outcomes


# --------------------------------------------------------------------------- audit


@router.get("/{incident_id}/audit", response_model=list[AuditOut])
def incident_audit(incident_id: uuid.UUID, db: DB, user: CurrentUser):
    inc = _load(db, user, incident_id)
    return db.scalars(
        select(AuditEvent).where(AuditEvent.entity_type == "incident", AuditEvent.entity_id == inc.id,
                                 AuditEvent.organization_id == user.organization_id)
        .order_by(AuditEvent.created_at)
    ).all()


# --------------------------------------------------------------------------- audio


def _audio(inc: Incident, audio_id: uuid.UUID) -> AudioAsset:
    asset = next((a for a in inc.audio_assets if a.id == audio_id), None)
    if asset is None:
        raise not_found("Audio")
    return asset


@router.get("/{incident_id}/audio/{audio_id}")
def get_audio(incident_id: uuid.UUID, audio_id: uuid.UUID, db: DB, user: CurrentUser):
    asset = _audio(_load(db, user, incident_id), audio_id)
    if not asset.storage_key:
        raise AppError(410, "audio_deleted", "This recording was deleted under the retention policy")
    path = storage.resolve(asset.storage_key)
    if not path.exists():
        raise AppError(410, "audio_missing", "The recording file is no longer available")
    return FileResponse(path, media_type=asset.mime_type, headers={"Cache-Control": "private, no-store"})


@router.delete("/{incident_id}/audio/{audio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_audio(incident_id: uuid.UUID, audio_id: uuid.UUID, db: DB, user: CurrentUser,
                 confirm: bool = Query(default=False)):
    inc = _load(db, user, incident_id, lock=True)
    if user.role == Role.technician and inc.reporter_id != user.id:
        raise forbidden("Only the reporter or a supervisor can delete this recording")
    if not confirm:
        raise conflict("confirmation_required", "Pass confirm=true to permanently delete this recording")
    if inc.processing_status == ProcessingStatus.transcribing:
        raise conflict("processing_in_progress", "Wait for transcription to finish")
    asset = _audio(inc, audio_id)
    storage.delete_file(asset.storage_key)
    asset.storage_key = None
    asset.retention_status = RetentionStatus.deleted
    asset.deleted_at = utcnow()
    audit.record(db, organization_id=inc.organization_id, actor_id=user.id, entity_type="incident",
                 entity_id=inc.id, action="audio_deleted", details={"audio_id": str(asset.id), "reason": "manual"})
    db.commit()


@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_incident(incident_id: uuid.UUID, db: DB, user: Lead, confirm: bool = Query(default=False)):
    inc = _load(db, user, incident_id, lock=True)
    if not confirm:
        raise conflict("confirmation_required", "Pass confirm=true to permanently delete this incident")
    for asset in inc.audio_assets:
        storage.delete_file(asset.storage_key)
    audit.record(db, organization_id=inc.organization_id, actor_id=user.id, entity_type="incident",
                 entity_id=inc.id, action="incident_deleted", details={"machine_id": str(inc.machine_id)})
    db.delete(inc)
    db.commit()


# --------------------------------------------------------------------------- export / speech


def _md_list(items: list[str]) -> str:
    return "\n".join(f"- {i}" for i in items) if items else "- _none recorded_"


def render_markdown(inc: Incident) -> str:
    p = provenance(inc)
    m = inc.machine
    lines = [
        f"# Incident report: {m.asset_code} ({m.name})",
        "",
        f"- Incident ID: `{inc.id}`",
        f"- Occurred: {inc.occurred_at:%Y-%m-%d %H:%M %Z}",
        f"- Machine type: {m.type}; location: {m.location or 'n/a'}",
        f"- Urgency: {inc.urgency}; review: {inc.review_status}; resolution: {inc.resolution_status}",
        f"- Structured fields: **{p.structured_fields}**",
        "",
        "## Summary", inc.summary or "_not yet summarised_", "",
        "## Symptoms", _md_list(inc.symptoms), "",
        "## Observations (reported)", _md_list(inc.observations), "",
        "## Actions already taken", _md_list(inc.actions_taken), "",
        "## Suspected causes (hypotheses, NOT verified)", _md_list(inc.suspected_causes), "",
        "## Missing information", _md_list(inc.missing_information), "",
        "## Suggested checks (advisory; follow site procedures)", _md_list(inc.suggested_checks), "",
    ]
    if inc.safety_notice:
        lines += ["## Safety notice", inc.safety_notice, ""]
    lines += ["## Maintenance outcomes (technician-recorded)"]
    if inc.outcomes:
        for o in inc.outcomes:
            lines += [
                f"- **{o.resolution_status}** {o.resolved_at or o.created_at:%Y-%m-%d}: {o.action_performed}",
                f"  - Verified cause: {o.verified_cause or 'not verified'}",
                f"  - Parts: {', '.join(o.parts_used) or 'none recorded'}; by: {o.verified_by.name if o.verified_by else 'unknown'}",
            ]
    else:
        lines.append("- Outcome unknown/unrecorded")
    lines += ["", "## Transcript", f"_{p.transcript}_", "", "> " + (inc.transcript or "").replace("\n", "\n> "), ""]
    lines.append("_Generated by Mantiq. AI suggestions are decision support only and require qualified human review._")
    return "\n".join(lines)


@router.get("/{incident_id}/export")
def export_incident(incident_id: uuid.UUID, db: DB, user: CurrentUser,
                    format: Literal["markdown", "json"] = "markdown"):
    inc = _load(db, user, incident_id)
    filename = f"incident-{inc.machine.asset_code}-{inc.occurred_at:%Y%m%d}-{str(inc.id)[:8]}"
    if format == "json":
        return Response(detail(inc).model_dump_json(indent=2), media_type="application/json",
                        headers={"Content-Disposition": f'attachment; filename="{filename}.json"'})
    return PlainTextResponse(render_markdown(inc), media_type="text/markdown",
                             headers={"Content-Disposition": f'attachment; filename="{filename}.md"'})


@router.post("/{incident_id}/speak", responses={200: {"content": {"audio/wav": {}}}})
def speak_incident(incident_id: uuid.UUID, db: DB, user: CurrentUser):
    """Optional Timbre read-out of the incident summary (FR-019). Unreviewed summaries are labelled as such."""
    inc = _load(db, user, incident_id)
    if not inc.summary:
        raise conflict("no_summary", "There is no summary to read yet")
    prefix = "Confirmed summary." if inc.review_status == ReviewStatus.confirmed else "AI suggested summary, not yet reviewed."
    text = f"{prefix} Machine {inc.machine.asset_code}. {inc.summary}"
    settings = get_settings()
    job = AIProcessingJob(incident_id=inc.id, provider="timbre", model=settings.timbre_model, mode=settings.timbre_mode)
    db.add(job)
    try:
        audio, meta = timbre.synthesize(text)
    except ProviderError as exc:
        pipeline._finish(job, error=exc)
        db.commit()
        raise AppError(503 if exc.retryable else 400, exc.code, exc.safe_message)
    pipeline._finish(job, meta=meta)
    db.commit()
    return Response(audio, media_type="audio/wav", headers={"X-Mantiq-Provider-Mode": meta.mode})
