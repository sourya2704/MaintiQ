from datetime import timedelta

from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser
from app.db.base import utcnow
from app.models import Incident, Machine
from app.models.enums import ProcessingStatus, ResolutionStatus, ReviewStatus
from app.schemas.incidents import IncidentListItem

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

OPEN = [ResolutionStatus.open, ResolutionStatus.monitoring, ResolutionStatus.unresolved]
FAILED = [ProcessingStatus.transcription_failed, ProcessingStatus.analysis_failed]


@router.get("/summary")
def summary(db: DB, user: CurrentUser):
    """All figures are computed live from the database (FR-016); nothing is hardcoded."""
    org = user.organization_id
    inc = select(Incident).where(Incident.organization_id == org).subquery()

    def count(*conds) -> int:
        return db.scalar(select(func.count()).select_from(inc).where(*conds)) or 0

    machines_by_status = dict(db.execute(
        select(Machine.status, func.count()).where(Machine.organization_id == org).group_by(Machine.status)
    ).all())
    since_30 = utcnow() - timedelta(days=30)
    top_symptoms = db.execute(
        select(func.unnest(inc.c.symptom_tags).label("tag"), func.count().label("n"))
        .select_from(inc).group_by("tag").order_by(func.count().desc()).limit(5)
    ).all()
    machine_activity = db.execute(
        select(Machine.id, Machine.asset_code, Machine.name, func.count(Incident.id))
        .join(Incident, Incident.machine_id == Machine.id)
        .where(Machine.organization_id == org, Incident.occurred_at >= utcnow() - timedelta(days=90))
        .group_by(Machine.id).order_by(func.count(Incident.id).desc()).limit(5)
    ).all()

    def items(stmt):
        rows = db.scalars(stmt.options(selectinload(Incident.machine), selectinload(Incident.reporter))).all()
        return [IncidentListItem.model_validate(r) for r in rows]

    base = select(Incident).where(Incident.organization_id == org)
    total_incidents = count()
    return {
        "machines": {"total": sum(machines_by_status.values()), "by_status": machines_by_status},
        "incidents": {
            "total": total_incidents,
            "open": count(inc.c.resolution_status.in_(OPEN)),
            "awaiting_review": count(inc.c.review_status == ReviewStatus.draft,
                                     inc.c.processing_status == ProcessingStatus.awaiting_review),
            "processing_failed": count(inc.c.processing_status.in_(FAILED)),
            "urgent_open": count(inc.c.urgency == "urgent", inc.c.resolution_status.in_(OPEN)),
            "resolved_last_30_days": count(inc.c.resolution_status == ResolutionStatus.resolved,
                                           inc.c.updated_at >= since_30),
            "reported_last_30_days": count(inc.c.occurred_at >= since_30),
            "seed_records": count(inc.c.is_seed.is_(True)),
        },
        "top_symptoms": [{"tag": t, "count": n} for t, n in top_symptoms],
        "machine_activity_90d": [
            {"machine_id": i, "asset_code": c, "name": n, "incident_count": k} for i, c, n, k in machine_activity
        ],
        "recent_incidents": items(base.order_by(Incident.occurred_at.desc()).limit(5)),
        "unresolved_incidents": items(
            base.where(Incident.resolution_status.in_(OPEN)).order_by(Incident.occurred_at.asc()).limit(5)
        ),
        "is_empty": total_incidents == 0,
    }
