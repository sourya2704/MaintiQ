import uuid
from typing import Annotated

from typing import Literal

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import case, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, get_machine_for_user, require_roles
from app.core.errors import conflict
from app.models import Incident, Machine, User
from app.models.enums import MachineStatus, ResolutionStatus, Role
from app.schemas.common import Page
from app.schemas.machines import (
    MachineCreate,
    MachineDetail,
    MachineListItem,
    MachineOut,
    MachineUpdate,
    SymptomCount,
    TimelineEntry,
)
from app.services import audit, machine_import

router = APIRouter(prefix="/api/machines", tags=["machines"])

OPTIONAL_FIELDS = ("manufacturer", "model", "location")
OPEN_STATES = (ResolutionStatus.open, ResolutionStatus.monitoring, ResolutionStatus.unresolved)
Lead = Annotated[User, Depends(require_roles(Role.admin, Role.supervisor))]


def _counts(db, machine_ids: list[uuid.UUID]) -> dict[uuid.UUID, tuple[int, int, object]]:
    if not machine_ids:
        return {}
    rows = db.execute(
        select(
            Incident.machine_id,
            func.count(Incident.id),
            func.sum(case((Incident.resolution_status.in_([s.value for s in OPEN_STATES]), 1), else_=0)),
            func.max(Incident.occurred_at),
        )
        .where(Incident.machine_id.in_(machine_ids))
        .group_by(Incident.machine_id)
    ).all()
    return {r[0]: (r[1], int(r[2] or 0), r[3]) for r in rows}


@router.get("", response_model=Page[MachineListItem])
def list_machines(
    db: DB,
    user: CurrentUser,
    q: str | None = Query(default=None, max_length=200, description="Search asset code, name, type, location"),
    type: str | None = None,
    status_: MachineStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    stmt = select(Machine).where(Machine.organization_id == user.organization_id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Machine.asset_code.ilike(like), Machine.name.ilike(like),
                              Machine.type.ilike(like), Machine.location.ilike(like)))
    if type:
        stmt = stmt.where(Machine.type == type.strip().lower())
    if status_:
        stmt = stmt.where(Machine.status == status_)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    machines = db.scalars(stmt.order_by(Machine.asset_code).offset((page - 1) * page_size).limit(page_size)).all()
    counts = _counts(db, [m.id for m in machines])
    items = []
    for m in machines:
        total_i, open_i, last = counts.get(m.id, (0, 0, None))
        items.append(MachineListItem.model_validate(m).model_copy(
            update={"incident_count": total_i, "open_incident_count": open_i, "last_incident_at": last}))
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get("/types", response_model=list[str])
def machine_types(db: DB, user: CurrentUser):
    return db.scalars(
        select(Machine.type).where(Machine.organization_id == user.organization_id).distinct().order_by(Machine.type)
    ).all()


@router.get("/import/template", response_class=PlainTextResponse)
def import_template(_: CurrentUser):
    """Example CSV with the recognised columns."""
    return PlainTextResponse(
        machine_import.TEMPLATE, media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="mantiq-machines-template.csv"'},
    )


@router.post("/import")
async def import_machines(
    db: DB,
    user: Lead,
    file: UploadFile = File(...),
    dry_run: bool = Query(default=True, description="Validate and report without saving"),
    on_conflict: Literal["skip", "update"] = Query(default="skip", description="What to do with asset codes that already exist"),
):
    """Bulk-create machines from a CSV asset list. Run with dry_run=true first to preview."""
    report = machine_import.import_machines(
        db, user.organization_id, user.id, await file.read(machine_import.MAX_BYTES + 1),
        on_conflict=on_conflict, dry_run=dry_run,
    )
    if dry_run:
        db.rollback()
    else:
        db.commit()
    return report.__dict__


@router.post("", response_model=MachineOut, status_code=status.HTTP_201_CREATED)
def create_machine(body: MachineCreate, db: DB, user: CurrentUser):
    machine = Machine(organization_id=user.organization_id, **body.model_dump())
    db.add(machine)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise conflict("asset_code_taken", f"Asset code {body.asset_code} already exists")
    audit.record(db, organization_id=user.organization_id, actor_id=user.id, entity_type="machine",
                 entity_id=machine.id, action="machine_created", details={"asset_code": machine.asset_code})
    db.commit()
    return machine


@router.get("/{machine_id}", response_model=MachineDetail)
def get_machine(machine_id: uuid.UUID, db: DB, user: CurrentUser,
                timeline_limit: int = Query(default=50, ge=1, le=200)):
    machine = get_machine_for_user(db, user, machine_id)
    incidents = db.scalars(
        select(Incident).where(Incident.machine_id == machine.id)
        .options(selectinload(Incident.outcomes))
        .order_by(Incident.occurred_at.desc()).limit(timeline_limit)
    ).all()
    total_i, open_i, _ = _counts(db, [machine.id]).get(machine.id, (0, 0, None))
    tag = func.unnest(Incident.symptom_tags).label("tag")
    recurring_rows = db.execute(
        select(tag, func.count().label("n"), func.max(Incident.occurred_at))
        .where(Incident.machine_id == machine.id)
        .group_by("tag")
        .order_by(func.count().desc(), "tag")
    ).all()
    recurring = [SymptomCount(tag=t, count=n, last_seen=last) for t, n, last in recurring_rows]
    timeline = []
    for inc in incidents:
        latest = inc.outcomes[-1] if inc.outcomes else None
        timeline.append(TimelineEntry(
            id=inc.id, occurred_at=inc.occurred_at, summary=inc.summary, symptoms=inc.symptoms,
            urgency=inc.urgency, processing_status=inc.processing_status, review_status=inc.review_status,
            resolution_status=inc.resolution_status, is_seed=inc.is_seed,
            outcome_summary=(f"{latest.resolution_status}: {latest.action_performed}" if latest else None),
        ))
    return MachineDetail(
        **MachineOut.model_validate(machine).model_dump(),
        incident_count=total_i, open_incident_count=open_i, recurring_symptoms=recurring, timeline=timeline,
    )


@router.patch("/{machine_id}", response_model=MachineOut)
def update_machine(machine_id: uuid.UUID, body: MachineUpdate, db: DB, user: CurrentUser):
    machine = get_machine_for_user(db, user, machine_id)
    # Optional details can be cleared with null; required fields ignore null.
    changes = {k: v for k, v in body.model_dump(exclude_unset=True).items()
               if v is not None or k in OPTIONAL_FIELDS}
    for k, v in changes.items():
        setattr(machine, k, v)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise conflict("asset_code_taken", "That asset code already exists")
    audit.record(db, organization_id=user.organization_id, actor_id=user.id, entity_type="machine",
                 entity_id=machine.id, action="machine_updated", details={k: str(v) for k, v in changes.items()})
    db.commit()
    return machine


@router.delete("/{machine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_machine(machine_id: uuid.UUID, db: DB, user: Lead, confirm: bool = Query(default=False)):
    machine = get_machine_for_user(db, user, machine_id)
    if not confirm:
        raise conflict("confirmation_required", "Pass confirm=true to delete this machine")
    if db.scalar(select(func.count()).select_from(Incident).where(Incident.machine_id == machine.id)):
        raise conflict("machine_has_incidents", "Machines with incident history cannot be deleted; set status to retired")
    audit.record(db, organization_id=user.organization_id, actor_id=user.id, entity_type="machine",
                 entity_id=machine.id, action="machine_deleted", details={"asset_code": machine.asset_code})
    db.delete(machine)
    db.commit()
