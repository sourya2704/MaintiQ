from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from app.api.deps import DB, CurrentUser, require_roles
from app.core.config import get_settings
from app.models import AIProcessingJob, AudioAsset, Incident, User
from app.models.enums import JobStatus, RetentionStatus, Role
from app.services import retention, storage
from app.services.providers import evon

router = APIRouter(prefix="/api", tags=["settings"])
Admin = Annotated[User, Depends(require_roles(Role.admin))]


def _last_job(db, org_id, provider: str, status: str | None = None):
    stmt = (
        select(AIProcessingJob).join(Incident, Incident.id == AIProcessingJob.incident_id)
        .where(Incident.organization_id == org_id, AIProcessingJob.provider == provider)
    )
    if status:
        stmt = stmt.where(AIProcessingJob.status == status)
    job = db.scalars(stmt.order_by(AIProcessingJob.started_at.desc()).limit(1)).first()
    if not job:
        return None
    return {"at": job.started_at, "mode": job.mode, "model": job.model, "status": job.status,
            "latency_ms": job.latency_ms, "error_code": job.error_code}


@router.get("/settings/integrations")
def integrations(db: DB, user: CurrentUser):
    """Non-secret integration status, clearly separating live calls from mocks (FR-018)."""
    s = get_settings()
    key_set = bool(s.gnani_api_key)

    def provider(name: str, mode: str, model: str, endpoint: str, configured: bool, purpose: str):
        return {
            "provider": name, "purpose": purpose, "mode": mode, "model": model, "endpoint": endpoint,
            "credentials_configured": configured,
            "live_ready": mode == "live" and configured,
            "label": {"live": "Live provider calls", "mock": "MOCK: local fixture, no provider call",
                      "disabled": "Disabled"}[mode],
            "last_call": _last_job(db, user.organization_id, name),
            "last_failure": _last_job(db, user.organization_id, name, JobStatus.failed),
        }

    return {
        "environment": s.environment,
        "providers": [
            provider("prisma", s.prisma_mode, s.prisma_model, s.gnani_base_url.rstrip("/") + "/stt/v3", key_set,
                     "Speech-to-text"),
            provider("evon", s.evon_mode, s.evon_model, s.evon_base_url.rstrip("/") + "/chat/completions",
                     True, "Structured incident extraction"),
            provider("timbre", s.timbre_mode, s.timbre_model, s.gnani_base_url.rstrip("/") + "/api/v1/tts/inference",
                     key_set, "Text-to-speech (optional)"),
        ],
        "audio": {
            "max_bytes": s.max_audio_bytes, "max_seconds": s.max_audio_seconds,
            "retention_days": s.audio_retention_days, "accepted_formats": sorted(e.lstrip(".") for e in storage.ALLOWED),
        },
        "privacy_notice": "Audio and transcripts are sent to Gnani AI services for processing when providers are live.",
    }


@router.post("/admin/retention/run")
def run_retention(db: DB, admin: Admin):
    """Delete stored audio whose retention period has passed (FR-022). Transcripts and incidents are kept.
    The same sweep also runs automatically every RETENTION_INTERVAL_MINUTES."""
    deleted = retention.apply_retention(db, admin.organization_id, admin.id)
    db.commit()
    remaining = db.scalar(
        select(func.count()).select_from(AudioAsset).join(Incident, Incident.id == AudioAsset.incident_id)
        .where(Incident.organization_id == admin.organization_id,
               AudioAsset.retention_status == RetentionStatus.retained)
    )
    return {"deleted": deleted, "retained": remaining}


@router.get("/settings/integrations/evon/check")
def check_evon(_: Admin):
    """Probe the configured Evon endpoint (lists served models; no inference cost)."""
    return evon.check_connection()
