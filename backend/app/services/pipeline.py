"""Incident AI pipeline: Prisma transcription and Evon analysis jobs.

Each run is an AIProcessingJob row. Requests move the incident into
`transcribing`/`analyzing` under a row lock (so a double-click or retry cannot
start a second job), then the provider call runs as a background task with its
own DB session. Failures keep the transcript and record a safe error message.
"""

import logging
import uuid
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import conflict
from app.db.base import utcnow
from app.db.session import SessionLocal
from app.models import AIProcessingJob, Incident
from app.models.enums import (
    AnalysisSource,
    JobStatus,
    ProcessingStatus,
    ReviewStatus,
    TranscriptSource,
)
from app.services import audit, extraction, memory_engine, storage
from app.services.providers import prisma
from app.services.providers.base import ProviderError
from app.services.symptoms import tag_symptoms

log = logging.getLogger("mantiq.pipeline")
STALE_JOB_AFTER = timedelta(minutes=5)


# --------------------------------------------------------------------------- search text


def refresh_search_text(incident: Incident) -> None:
    """Rebuild the text indexed for retrieval.

    Facts only: machine identity, transcript, summary, symptoms, observations,
    actions and verified outcomes. Suspected causes and suggested checks are
    excluded so hypotheses never drive retrieval as if they were facts.
    """
    m = incident.machine
    parts = [
        m.asset_code if m else "",
        m.name if m else "",
        m.type if m else "",
        incident.summary or "",
        incident.transcript or "",
        " ".join(incident.symptoms or []),
        " ".join(t.replace("_", " ") for t in incident.symptom_tags or []),
        " ".join(incident.observations or []),
        " ".join(incident.actions_taken or []),
    ]
    for o in incident.outcomes:
        parts += [o.action_performed or "", o.verified_cause or "", o.notes or ""]
    incident.search_text = "\n".join(p for p in parts if p)
    if not incident.symptom_tags:
        incident.symptom_tags = tag_symptoms(incident.transcript or "", " ".join(incident.symptoms or []))


# --------------------------------------------------------------------------- guards


PIPELINE_TASKS = {"prisma": "transcription", "evon": "extraction"}


def _active_job(incident: Incident, provider: str) -> AIProcessingJob | None:
    task = PIPELINE_TASKS.get(provider)
    for job in reversed(incident.jobs):
        if job.provider == provider and job.task == task and job.status == JobStatus.running:
            return job
    return None


def _expire_if_stale(db: Session, incident: Incident, provider: str, running_state: str, failed_state: str) -> None:
    """A job left running by a crashed worker blocks retries forever; expire it after a timeout."""
    job = _active_job(incident, provider)
    if incident.processing_status == running_state and job and utcnow() - job.started_at > STALE_JOB_AFTER:
        job.status = JobStatus.failed
        job.error_code = "stale_job"
        job.safe_error_message = "Processing did not finish; marked failed so it can be retried"
        job.finished_at = utcnow()
        incident.processing_status = failed_state
        db.flush()


def begin_transcription(db: Session, incident: Incident, actor_id: uuid.UUID | None) -> AIProcessingJob:
    _expire_if_stale(db, incident, "prisma", ProcessingStatus.transcribing, ProcessingStatus.transcription_failed)
    if incident.processing_status == ProcessingStatus.transcribing:
        raise conflict("already_processing", "Transcription is already in progress")
    if incident.processing_status not in (ProcessingStatus.uploaded, ProcessingStatus.transcription_failed):
        raise conflict("invalid_state", f"Cannot transcribe an incident in state '{incident.processing_status}'")
    audio = next((a for a in incident.audio_assets if a.storage_key), None)
    if audio is None:
        raise conflict("no_audio", "No stored audio is available for this incident; enter the transcript manually")

    settings = get_settings()
    job = AIProcessingJob(
        incident_id=incident.id,
        provider="prisma",
        task="transcription",
        model=settings.prisma_model if settings.prisma_mode == "live" else "prisma-mock",
        mode=settings.prisma_mode,
    )
    db.add(job)
    incident.processing_status = ProcessingStatus.transcribing
    audit.record(
        db, organization_id=incident.organization_id, actor_id=actor_id, entity_type="incident",
        entity_id=incident.id, action="transcription_started", details={"mode": job.mode},
    )
    db.flush()
    return job


def begin_analysis(db: Session, incident: Incident, actor_id: uuid.UUID | None) -> AIProcessingJob:
    _expire_if_stale(db, incident, "evon", ProcessingStatus.analyzing, ProcessingStatus.analysis_failed)
    if incident.processing_status == ProcessingStatus.analyzing:
        raise conflict("already_processing", "Analysis is already in progress")
    if incident.review_status == ReviewStatus.confirmed:
        raise conflict("already_confirmed", "Confirmed incidents are not re-analysed; edit fields directly")
    if not incident.transcript:
        raise conflict("no_transcript", "A transcript is required before analysis")
    if incident.processing_status not in (
        ProcessingStatus.transcribed, ProcessingStatus.analysis_failed, ProcessingStatus.awaiting_review
    ):
        raise conflict("invalid_state", f"Cannot analyse an incident in state '{incident.processing_status}'")

    settings = get_settings()
    job = AIProcessingJob(
        incident_id=incident.id,
        provider="evon",
        task="extraction",
        model=settings.evon_model if settings.evon_mode == "live" else "evon-mock",
        mode=settings.evon_mode,
    )
    db.add(job)
    incident.processing_status = ProcessingStatus.analyzing
    audit.record(
        db, organization_id=incident.organization_id, actor_id=actor_id, entity_type="incident",
        entity_id=incident.id, action="analysis_started", details={"mode": job.mode},
    )
    db.flush()
    return job


# --------------------------------------------------------------------------- workers


def _finish(job: AIProcessingJob, *, error: ProviderError | None = None, meta=None) -> None:
    job.finished_at = utcnow()
    if meta is not None:
        job.latency_ms = meta.latency_ms
        job.provider_request_id = meta.request_id
        job.model = meta.model or job.model
        job.mode = meta.mode
    if error is None:
        job.status = JobStatus.succeeded
    else:
        job.status = JobStatus.failed
        job.error_code = error.code[:100]
        job.safe_error_message = error.safe_message
        job.provider_request_id = job.provider_request_id or error.request_id


def run_transcription(incident_id: uuid.UUID, job_id: uuid.UUID) -> None:
    with SessionLocal() as db:
        incident = db.get(Incident, incident_id)
        job = db.get(AIProcessingJob, job_id)
        if incident is None or job is None or job.status != JobStatus.running:
            return
        audio = next((a for a in incident.audio_assets if a.storage_key), None)
        try:
            if audio is None:
                raise ProviderError("no_audio", "Audio is no longer available")
            m = incident.machine
            result = prisma.transcribe_recording(
                storage.resolve(audio.storage_key),
                audio.mime_type,
                incident.transcript_language,
                duration_seconds=audio.duration_seconds,
                keyterms=prisma.build_keyterms({
                    "asset_code": m.asset_code, "name": m.name, "type": m.type,
                    "manufacturer": m.manufacturer, "model": m.model,
                }),
            )
        except ProviderError as exc:
            log.warning("prisma failed incident=%s code=%s", incident_id, exc.code)
            _finish(job, error=exc)
            incident.processing_status = ProcessingStatus.transcription_failed
            db.commit()
            return
        except Exception:
            log.exception("prisma crashed incident=%s", incident_id)
            _finish(job, error=ProviderError("internal_error", "Unexpected error during transcription"))
            incident.processing_status = ProcessingStatus.transcription_failed
            db.commit()
            return

        incident.transcript_original = result.text
        incident.transcript_source = (
            TranscriptSource.prisma if result.meta.mode == "live" else TranscriptSource.prisma_mock
        )
        incident.transcript_language = result.language
        incident.processing_status = ProcessingStatus.transcribed
        if result.meta.extra.get("truncated"):
            incident.analysis_warnings = [*incident.analysis_warnings, "Prisma reported the transcript was truncated"]
        _finish(job, meta=result.meta)
        refresh_search_text(incident)
        log.info("prisma ok incident=%s mode=%s latency_ms=%s", incident_id, result.meta.mode, result.meta.latency_ms)
        db.commit()


def run_analysis(incident_id: uuid.UUID, job_id: uuid.UUID) -> None:
    with SessionLocal() as db:
        incident = db.get(Incident, incident_id)
        job = db.get(AIProcessingJob, job_id)
        if incident is None or job is None or job.status != JobStatus.running:
            return
        machine = incident.machine
        transcript = incident.transcript or ""
        try:
            related = memory_engine.find_related(
                db,
                memory_engine.MemoryQuery(
                    organization_id=incident.organization_id,
                    text=transcript,
                    symptom_tags=tag_symptoms(transcript),
                    machine_id=machine.id,
                    machine_type=machine.type,
                    exclude_incident_id=incident.id,
                    limit=get_settings().evon_max_history_records,
                ),
            )
            result = extraction.extract(
                transcript,
                {
                    "asset_code": machine.asset_code, "name": machine.name, "type": machine.type,
                    "manufacturer": machine.manufacturer, "model": machine.model,
                },
                memory_engine.history_for_prompt(related),
            )
        except ProviderError as exc:
            log.warning("evon failed incident=%s code=%s", incident_id, exc.code)
            _finish(job, error=exc)
            incident.processing_status = ProcessingStatus.analysis_failed
            db.commit()
            return
        except Exception:
            log.exception("evon crashed incident=%s", incident_id)
            _finish(job, error=ProviderError("internal_error", "Unexpected error during analysis"))
            incident.processing_status = ProcessingStatus.analysis_failed
            db.commit()
            return

        d = result.draft
        incident.summary = d.incident_summary
        incident.symptoms = d.symptoms
        incident.observations = d.observations
        incident.actions_taken = d.actions_already_taken
        incident.suspected_causes = d.suspected_causes
        incident.missing_information = d.missing_information
        incident.suggested_checks = d.suggested_checks
        incident.urgency = d.urgency
        incident.confidence_notes = d.confidence_notes
        incident.safety_notice = result.safety_notice
        incident.analysis_warnings = result.warnings
        incident.symptom_tags = result.symptom_tags
        incident.analysis_source = AnalysisSource.evon if result.meta.mode == "live" else AnalysisSource.evon_mock
        incident.processing_status = ProcessingStatus.awaiting_review
        job.attempts = result.attempts
        _finish(job, meta=result.meta)
        refresh_search_text(incident)
        log.info("evon ok incident=%s mode=%s latency_ms=%s", incident_id, result.meta.mode, result.meta.latency_ms)
        db.commit()
