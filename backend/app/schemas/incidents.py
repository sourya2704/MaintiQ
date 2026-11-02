import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.models.enums import (
    AnalysisSource,
    ProcessingStatus,
    ResolutionStatus,
    RetentionStatus,
    ReviewStatus,
    TranscriptSource,
    Urgency,
)
from app.schemas.common import ORM

ListField = list[str]


def _clean(values: list[str] | None) -> list[str] | None:
    if values is None:
        return None
    out = []
    for v in values:
        v = " ".join(str(v).split())
        if v and v not in out:
            out.append(v[:500])
    return out[:30]


class UserRef(ORM):
    id: uuid.UUID
    name: str


class MachineRef(ORM):
    id: uuid.UUID
    asset_code: str
    name: str
    type: str


class AudioOut(ORM):
    id: uuid.UUID
    original_filename: str | None
    mime_type: str
    size_bytes: int
    duration_seconds: float | None
    retention_status: RetentionStatus
    delete_after: datetime | None
    deleted_at: datetime | None
    created_at: datetime


class JobOut(ORM):
    id: uuid.UUID
    provider: str
    task: str
    model: str
    mode: str
    status: str
    attempts: int
    provider_request_id: str | None
    latency_ms: int | None
    error_code: str | None
    safe_error_message: str | None
    started_at: datetime
    finished_at: datetime | None


class OutcomeIn(BaseModel):
    action_performed: str = Field(min_length=1, max_length=4000)
    resolution_status: ResolutionStatus
    verified_cause: str | None = Field(default=None, max_length=2000)
    parts_used: list[str] = Field(default_factory=list)
    notes: str | None = Field(default=None, max_length=4000)
    resolved_at: datetime | None = None

    @field_validator("resolution_status")
    @classmethod
    def _not_open(cls, v: ResolutionStatus) -> ResolutionStatus:
        if v == ResolutionStatus.open:
            raise ValueError("an outcome must be resolved, unresolved or monitoring")
        return v

    @field_validator("parts_used")
    @classmethod
    def _parts(cls, v: list[str]) -> list[str]:
        return _clean(v) or []


class OutcomeOut(ORM):
    id: uuid.UUID
    incident_id: uuid.UUID
    verified_cause: str | None
    action_performed: str
    parts_used: list[str]
    resolution_status: ResolutionStatus
    notes: str | None
    verified_by: UserRef | None
    resolved_at: datetime | None
    created_at: datetime


class IncidentUpdate(BaseModel):
    """Technician edits. Any field may be corrected; review status changes only via /confirm."""

    transcript_edited: str | None = Field(default=None, max_length=20000)
    summary: str | None = Field(default=None, max_length=2000)
    symptoms: ListField | None = None
    observations: ListField | None = None
    actions_taken: ListField | None = None
    suspected_causes: ListField | None = None
    missing_information: ListField | None = None
    suggested_checks: ListField | None = None
    urgency: Urgency | None = None
    occurred_at: datetime | None = None

    @field_validator(
        "symptoms", "observations", "actions_taken", "suspected_causes", "missing_information", "suggested_checks"
    )
    @classmethod
    def _lists(cls, v):
        return _clean(v)


class IncidentListItem(ORM):
    id: uuid.UUID
    machine: MachineRef
    occurred_at: datetime
    summary: str | None
    symptoms: list[str]
    symptom_tags: list[str]
    urgency: Urgency
    processing_status: ProcessingStatus
    review_status: ReviewStatus
    resolution_status: ResolutionStatus
    transcript_source: TranscriptSource | None
    analysis_source: AnalysisSource | None
    is_seed: bool
    reporter: UserRef | None
    created_at: datetime


class FieldProvenance(BaseModel):
    """Tells the UI how to label each group of fields."""

    transcript: str
    structured_fields: str
    suspected_causes: str
    outcome: str


class IncidentDetail(IncidentListItem):
    transcript_original: str | None
    transcript_edited: str | None
    transcript_language: str | None
    observations: list[str]
    actions_taken: list[str]
    suspected_causes: list[str]
    missing_information: list[str]
    suggested_checks: list[str]
    confidence_notes: str | None
    safety_notice: str | None
    analysis_warnings: list[str]
    confirmed_by: UserRef | None
    confirmed_at: datetime | None
    updated_at: datetime
    outcomes: list[OutcomeOut]
    audio_assets: list[AudioOut]
    jobs: list[JobOut]
    guide: dict[str, Any] | None
    guide_source: AnalysisSource | None
    guide_generated_at: datetime | None
    guide_generating: bool = False
    provenance: FieldProvenance | None = None


class RelatedMachine(BaseModel):
    id: uuid.UUID
    asset_code: str
    name: str
    type: str


class RelatedOutcome(BaseModel):
    resolution_status: ResolutionStatus
    verified_cause: str | None
    action_performed: str
    resolved_at: datetime | None


class RelatedIncident(BaseModel):
    rank: int
    incident_id: uuid.UUID
    link: str
    occurred_at: datetime
    machine: RelatedMachine
    summary: str | None
    symptoms: list[str]
    observations: list[str]
    actions_taken: list[str]
    review_status: ReviewStatus
    resolution_status: ResolutionStatus
    is_seed: bool
    outcome: RelatedOutcome | None
    outcome_label: str
    rationale: list[str]
    signals: dict[str, Any]


class RelatedResponse(BaseModel):
    incident_id: uuid.UUID | None = None
    query_symptoms: list[str]
    results: list[RelatedIncident]
    no_match: bool
    disclaimer: str = (
        "Related incidents are historical evidence to review, not proof of the current cause. "
        "Follow approved site procedures."
    )


class AuditOut(ORM):
    id: uuid.UUID
    action: str
    entity_type: str
    entity_id: uuid.UUID
    details: dict
    actor: UserRef | None
    created_at: datetime


class ProcessingAccepted(BaseModel):
    incident_id: uuid.UUID
    job_id: uuid.UUID
    processing_status: ProcessingStatus
    mode: str
