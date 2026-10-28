import uuid

from sqlalchemy.orm import Session

from app.models import AuditEvent


def record(
    db: Session,
    *,
    organization_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    entity_type: str,
    entity_id: uuid.UUID,
    action: str,
    details: dict | None = None,
) -> None:
    """Append an audit event. Callers commit; details must never contain secrets or full transcripts."""
    db.add(
        AuditEvent(
            organization_id=organization_id,
            actor_id=actor_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            details=details or {},
        )
    )
