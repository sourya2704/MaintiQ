import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select

from app.api.deps import DB, require_roles
from app.core.errors import conflict, not_found
from app.core.rate_limit import hit
from app.core.security import hash_password
from app.models import Incident, User
from app.models.enums import Role
from app.schemas.auth import AccountIssuedOut, TeamMemberOut, UserCreateIn, UserUpdateIn
from app.services import accounts, audit

router = APIRouter(prefix="/api/users", tags=["users"])

Admin = Annotated[User, Depends(require_roles(Role.admin))]
Lead = Annotated[User, Depends(require_roles(Role.admin, Role.supervisor))]


def _member(user: User, reports: int = 0) -> TeamMemberOut:
    return TeamMemberOut.model_validate(user).model_copy(update={"reports": reports})


@router.get("", response_model=list[TeamMemberOut])
def list_users(db: DB, user: Lead):
    """Everyone in the organization with their role, last sign-in and how many faults they reported."""
    counts = dict(db.execute(
        select(Incident.reporter_id, func.count()).where(Incident.organization_id == user.organization_id)
        .group_by(Incident.reporter_id)).all())
    people = db.scalars(select(User).where(User.organization_id == user.organization_id).order_by(User.name)).all()
    return [_member(u, counts.get(u.id, 0)) for u in people]


@router.post("", response_model=AccountIssuedOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreateIn, db: DB, admin: Admin):
    """Add a worker. Returns their login and a one-time password; they must change it at first sign-in."""
    hit(f"users-create:{admin.organization_id}", 60, 3600, "Too many new accounts in an hour; try again later")
    org = admin.organization
    if body.email:
        email = body.email.lower()
        if db.scalar(select(func.count()).select_from(User).where(User.email == email)):
            raise conflict("email_taken", "An account with this email already exists")
    else:
        email = accounts.login_email(db, org, body.name)
    password = accounts.temporary_password()
    new = User(organization_id=admin.organization_id, name=body.name.strip(), email=email,
               password_hash=hash_password(password), role=body.role, must_change_password=True)
    db.add(new)
    db.flush()
    audit.record(db, organization_id=admin.organization_id, actor_id=admin.id, entity_type="user",
                 entity_id=new.id, action="user_created", details={"role": body.role})
    db.commit()
    db.refresh(new)
    return AccountIssuedOut(user=_member(new), login_email=email, temporary_password=password)


@router.post("/{user_id}/reset-password", response_model=AccountIssuedOut)
def reset_password(user_id: uuid.UUID, db: DB, admin: Admin):
    """New one-time password for a worker who forgot theirs. Their other sessions end."""
    target = db.get(User, user_id)
    if target is None or target.organization_id != admin.organization_id:
        raise not_found("User")
    if target.id == admin.id:
        raise conflict("self_reset", "Change your own password in Settings")
    password = accounts.temporary_password()
    target.password_hash = hash_password(password)
    target.must_change_password = True
    audit.record(db, organization_id=admin.organization_id, actor_id=admin.id, entity_type="user",
                 entity_id=target.id, action="password_reset")
    db.commit()
    db.refresh(target)
    return AccountIssuedOut(user=_member(target), login_email=target.email, temporary_password=password)


@router.patch("/{user_id}", response_model=TeamMemberOut)
def update_user(user_id: uuid.UUID, body: UserUpdateIn, db: DB, admin: Admin):
    target = db.get(User, user_id)
    if target is None or target.organization_id != admin.organization_id:
        raise not_found("User")
    changes = body.model_dump(exclude_unset=True)
    if target.id == admin.id and (changes.get("role", Role.admin) != Role.admin or changes.get("is_active") is False):
        raise conflict("self_lockout", "You cannot demote or deactivate your own admin account")
    for k, v in changes.items():
        setattr(target, k, v)
    audit.record(db, organization_id=admin.organization_id, actor_id=admin.id, entity_type="user",
                 entity_id=target.id, action="user_updated", details={k: str(v) for k, v in changes.items()})
    db.commit()
    return _member(target)
