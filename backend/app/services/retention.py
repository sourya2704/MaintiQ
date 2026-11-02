"""Audio retention (PRD FR-022): delete recordings past `delete_after`; transcripts and incidents stay."""

import asyncio
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.base import utcnow
from app.db.session import SessionLocal
from app.models import AudioAsset, Incident
from app.models.enums import RetentionStatus
from app.services import audit, storage

log = logging.getLogger("mantiq.retention")


def apply_retention(db: Session, organization_id: uuid.UUID | None = None, actor_id: uuid.UUID | None = None) -> int:
    """Delete due audio for one organisation, or all of them when organization_id is None. Caller commits."""
    stmt = (
        select(AudioAsset, Incident.organization_id)
        .join(Incident, Incident.id == AudioAsset.incident_id)
        .where(AudioAsset.retention_status == RetentionStatus.retained, AudioAsset.delete_after <= utcnow())
    )
    if organization_id is not None:
        stmt = stmt.where(Incident.organization_id == organization_id)
    due = db.execute(stmt).all()
    for asset, org_id in due:
        storage.delete_file(asset.storage_key)
        asset.storage_key = None
        asset.retention_status = RetentionStatus.deleted
        asset.deleted_at = utcnow()
        audit.record(db, organization_id=org_id, actor_id=actor_id, entity_type="incident",
                     entity_id=asset.incident_id, action="audio_deleted",
                     details={"audio_id": str(asset.id), "reason": "retention_policy"})
    return len(due)


def _sweep_once() -> int:
    with SessionLocal() as db:
        deleted = apply_retention(db)
        db.commit()
        return deleted


async def retention_loop() -> None:
    """In-process scheduler; one instance is enough for a single-node deployment."""
    interval = get_settings().retention_interval_minutes * 60
    while True:
        try:
            deleted = await asyncio.to_thread(_sweep_once)
            if deleted:
                log.info("retention sweep deleted %d recording(s)", deleted)
        except Exception:
            log.exception("retention sweep failed")
        await asyncio.sleep(interval)
