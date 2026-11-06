import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    Computed,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, Timestamps, UUIDPk, utcnow
from app.models.enums import (
    JobStatus,
    MachineStatus,
    ProcessingStatus,
    ResolutionStatus,
    RetentionStatus,
    ReviewStatus,
    Role,
    Urgency,
)

TextList = ARRAY(Text)


class Organization(UUIDPk, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class User(UUIDPk, Base):
    __tablename__ = "users"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default=Role.technician, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # UI language ("en" or "hi"); NULL until the user picks one after first sign-in.
    preferred_language: Mapped[str | None] = mapped_column(String(5))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    organization: Mapped[Organization] = relationship()


class Machine(UUIDPk, Timestamps, Base):
    __tablename__ = "machines"
    __table_args__ = (UniqueConstraint("organization_id", "asset_code", name="uq_machines_org_asset_code"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    asset_code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    manufacturer: Mapped[str | None] = mapped_column(String(200))
    model: Mapped[str | None] = mapped_column(String(200))
    location: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default=MachineStatus.operational, nullable=False)
    is_seed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    incidents: Mapped[list["Incident"]] = relationship(back_populates="machine")


class Incident(UUIDPk, Timestamps, Base):
    __tablename__ = "incidents"
    __table_args__ = (
        UniqueConstraint("organization_id", "idempotency_key", name="uq_incidents_org_idempotency_key"),
        Index("ix_incidents_search_vector", "search_vector", postgresql_using="gin"),
        Index("ix_incidents_symptom_tags", "symptom_tags", postgresql_using="gin"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    machine_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("machines.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    reporter_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    idempotency_key: Mapped[str | None] = mapped_column(String(128))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Transcript provenance: original provider/manual text is never overwritten by edits.
    transcript_original: Mapped[str | None] = mapped_column(Text)
    transcript_edited: Mapped[str | None] = mapped_column(Text)
    transcript_source: Mapped[str | None] = mapped_column(String(20))
    transcript_language: Mapped[str | None] = mapped_column(String(32))

    # Structured fields (AI-suggested until review_status == confirmed).
    summary: Mapped[str | None] = mapped_column(Text)
    symptoms: Mapped[list[str]] = mapped_column(TextList, default=list, nullable=False)
    symptom_tags: Mapped[list[str]] = mapped_column(TextList, default=list, nullable=False)
    observations: Mapped[list[str]] = mapped_column(TextList, default=list, nullable=False)
    actions_taken: Mapped[list[str]] = mapped_column(TextList, default=list, nullable=False)
    suspected_causes: Mapped[list[str]] = mapped_column(TextList, default=list, nullable=False)
    missing_information: Mapped[list[str]] = mapped_column(TextList, default=list, nullable=False)
    suggested_checks: Mapped[list[str]] = mapped_column(TextList, default=list, nullable=False)
    urgency: Mapped[str] = mapped_column(String(20), default=Urgency.unknown, nullable=False)
    confidence_notes: Mapped[str | None] = mapped_column(Text)
    safety_notice: Mapped[str | None] = mapped_column(Text)
    analysis_warnings: Mapped[list[str]] = mapped_column(TextList, default=list, nullable=False)
    analysis_source: Mapped[str | None] = mapped_column(String(20))

    # Advisory troubleshooting guide (Evon), kept apart from the reviewed incident fields.
    guide: Mapped[dict | None] = mapped_column(JSONB)
    guide_source: Mapped[str | None] = mapped_column(String(20))
    guide_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Cached translations of the guide, keyed by language ("hi": {...}); cleared when the guide is regenerated.
    guide_translations: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}", nullable=False)

    processing_status: Mapped[str] = mapped_column(
        String(30), default=ProcessingStatus.uploaded, index=True, nullable=False
    )
    review_status: Mapped[str] = mapped_column(String(20), default=ReviewStatus.draft, index=True, nullable=False)
    resolution_status: Mapped[str] = mapped_column(
        String(20), default=ResolutionStatus.open, index=True, nullable=False
    )
    confirmed_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_seed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Maintained by the application (see services.incidents.refresh_search_text);
    # the tsvector is generated by Postgres from it.
    search_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    search_vector: Mapped[Any] = mapped_column(
        TSVECTOR, Computed("to_tsvector('english', coalesce(search_text, ''))", persisted=True)
    )

    machine: Mapped[Machine] = relationship(back_populates="incidents")
    reporter: Mapped[User | None] = relationship(foreign_keys=[reporter_id])
    confirmed_by: Mapped[User | None] = relationship(foreign_keys=[confirmed_by_id])
    outcomes: Mapped[list["MaintenanceOutcome"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan", order_by="MaintenanceOutcome.created_at"
    )
    audio_assets: Mapped[list["AudioAsset"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )
    photos: Mapped[list["IncidentPhoto"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan", order_by="IncidentPhoto.created_at"
    )
    jobs: Mapped[list["AIProcessingJob"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan", order_by="AIProcessingJob.started_at"
    )

    @property
    def transcript(self) -> str | None:
        """The text used for analysis: the reviewed edit if present, else the original."""
        return self.transcript_edited or self.transcript_original


class MaintenanceOutcome(UUIDPk, Base):
    __tablename__ = "maintenance_outcomes"

    incident_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False
    )
    verified_cause: Mapped[str | None] = mapped_column(Text)
    action_performed: Mapped[str] = mapped_column(Text, nullable=False)
    parts_used: Mapped[list[str]] = mapped_column(TextList, default=list, nullable=False)
    resolution_status: Mapped[str] = mapped_column(String(20), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    verified_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    incident: Mapped[Incident] = relationship(back_populates="outcomes")
    verified_by: Mapped[User | None] = relationship()


class AudioAsset(UUIDPk, Base):
    __tablename__ = "audio_assets"

    incident_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False
    )
    storage_key: Mapped[str | None] = mapped_column(String(500))
    original_filename: Mapped[str | None] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    retention_status: Mapped[str] = mapped_column(String(20), default=RetentionStatus.retained, nullable=False)
    delete_after: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    incident: Mapped[Incident] = relationship(back_populates="audio_assets")


class IncidentPhoto(UUIDPk, Base):
    """A photo of the fault taken by the reporter (e.g. from a phone camera)."""

    __tablename__ = "incident_photos"

    incident_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False
    )
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(50), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    incident: Mapped[Incident] = relationship(back_populates="photos")


class Message(UUIDPk, Base):
    """A message between two people in the same organization, optionally carrying a fix for an incident."""

    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_recipient_unread", "recipient_id", "read_at"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    recipient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    incident_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("incidents.id", ondelete="SET NULL"))
    kind: Mapped[str] = mapped_column(String(10), default="text", nullable=False)  # text | fix
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # For kind="fix": the steps as sent, so later guide changes do not alter what the mechanic received.
    fix: Mapped[dict | None] = mapped_column(JSONB)
    language: Mapped[str] = mapped_column(String(5), default="en", nullable=False)
    translations: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    sender: Mapped[User] = relationship(foreign_keys=[sender_id])
    recipient: Mapped[User] = relationship(foreign_keys=[recipient_id])
    incident: Mapped[Incident | None] = relationship()


class AIProcessingJob(UUIDPk, Base):
    __tablename__ = "ai_processing_jobs"

    incident_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False
    )
    provider: Mapped[str] = mapped_column(String(20), nullable=False)  # prisma | evon | timbre
    task: Mapped[str] = mapped_column(String(30), default="extraction", nullable=False)  # transcription | extraction | troubleshooting | speech
    model: Mapped[str] = mapped_column(String(200), nullable=False)
    mode: Mapped[str] = mapped_column(String(10), nullable=False)  # live | mock
    status: Mapped[str] = mapped_column(String(20), default=JobStatus.running, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    provider_request_id: Mapped[str | None] = mapped_column(String(200))
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    error_code: Mapped[str | None] = mapped_column(String(100))
    safe_error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    incident: Mapped[Incident] = relationship(back_populates="jobs")


class AuditEvent(UUIDPk, Base):
    __tablename__ = "audit_events"
    __table_args__ = (Index("ix_audit_events_entity", "entity_type", "entity_id"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    action: Mapped[str] = mapped_column(String(60), nullable=False)
    details: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    actor: Mapped[User | None] = relationship()
