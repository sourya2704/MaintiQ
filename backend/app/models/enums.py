"""Status vocabularies.

AI processing, human review and maintenance resolution are deliberately three
separate fields (PRD 11.1) so one never masquerades as another.
"""

from enum import StrEnum


class Role(StrEnum):
    admin = "admin"
    supervisor = "supervisor"
    technician = "technician"


class MachineStatus(StrEnum):
    operational = "operational"
    degraded = "degraded"
    down = "down"
    retired = "retired"


class ProcessingStatus(StrEnum):
    uploaded = "uploaded"
    transcribing = "transcribing"
    transcription_failed = "transcription_failed"
    transcribed = "transcribed"
    analyzing = "analyzing"
    analysis_failed = "analysis_failed"
    awaiting_review = "awaiting_review"


class ReviewStatus(StrEnum):
    draft = "draft"
    confirmed = "confirmed"


class ResolutionStatus(StrEnum):
    open = "open"
    monitoring = "monitoring"
    resolved = "resolved"
    unresolved = "unresolved"


class Urgency(StrEnum):
    unknown = "unknown"
    needs_review = "needs_review"
    routine = "routine"
    urgent = "urgent"


class TranscriptSource(StrEnum):
    prisma = "prisma"          # live Gnani Prisma response
    prisma_mock = "prisma_mock"  # local fixture, never presented as live
    manual = "manual"          # typed by a user
    seed = "seed"              # fictional demo dataset


class AnalysisSource(StrEnum):
    evon = "evon"
    evon_mock = "evon_mock"
    gemini = "gemini"
    manual = "manual"
    seed = "seed"


class JobStatus(StrEnum):
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class RetentionStatus(StrEnum):
    retained = "retained"
    deleted = "deleted"
