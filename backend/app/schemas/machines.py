import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.enums import MachineStatus, ProcessingStatus, ResolutionStatus, ReviewStatus, Urgency
from app.schemas.common import ORM


class MachineBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    type: str = Field(min_length=1, max_length=100)
    manufacturer: str | None = Field(default=None, max_length=200)
    model: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    status: MachineStatus = MachineStatus.operational

    @field_validator("type")
    @classmethod
    def _norm_type(cls, v: str) -> str:
        return " ".join(v.split()).lower()


class MachineCreate(MachineBase):
    asset_code: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9._\-/ ]*$")

    @field_validator("asset_code")
    @classmethod
    def _norm_code(cls, v: str) -> str:
        return v.strip().upper()


class MachineUpdate(BaseModel):
    asset_code: str | None = Field(default=None, min_length=1, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9._\-/ ]*$")
    name: str | None = Field(default=None, min_length=1, max_length=200)
    type: str | None = Field(default=None, min_length=1, max_length=100)
    manufacturer: str | None = Field(default=None, max_length=200)
    model: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    status: MachineStatus | None = None

    @field_validator("asset_code")
    @classmethod
    def _norm_code(cls, v: str | None) -> str | None:
        return v.strip().upper() if v else v

    @field_validator("type")
    @classmethod
    def _norm_type(cls, v: str | None) -> str | None:
        return " ".join(v.split()).lower() if v else v


class MachineOut(ORM):
    id: uuid.UUID
    asset_code: str
    name: str
    type: str
    manufacturer: str | None
    model: str | None
    location: str | None
    status: MachineStatus
    is_seed: bool
    created_at: datetime
    updated_at: datetime


class MachineListItem(MachineOut):
    incident_count: int = 0
    open_incident_count: int = 0
    last_incident_at: datetime | None = None


class TimelineEntry(BaseModel):
    id: uuid.UUID
    occurred_at: datetime
    summary: str | None
    symptoms: list[str]
    urgency: Urgency
    processing_status: ProcessingStatus
    review_status: ReviewStatus
    resolution_status: ResolutionStatus
    outcome_summary: str | None
    is_seed: bool


class MachineDetail(MachineOut):
    incident_count: int
    open_incident_count: int
    timeline: list[TimelineEntry]
