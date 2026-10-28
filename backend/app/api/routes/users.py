import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select

from app.api.deps import DB, require_roles
from app.core.errors import conflict, not_found
from app.core.security import hash_password
from app.models import User
from app.models.enums import Role
from app.schemas.auth import UserCreateIn, UserOut, UserUpdateIn
from app.services import audit

router = APIRouter(prefix="/api/users", tags=["users"])

Admin = Annotated[User, Depends(require_roles(Role.admin))]
Lead = Annotated[User, Depends(require_roles(Role.admin, Role.supervisor))]


@router.get("", response_model=list[UserOut])
def list_users(db: DB, user: Lead):
    return db.scalars(select(User).where(User.organization_id == user.organization_id).order_by(User.name)).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreateIn, db: DB, admin: Admin):
    email = body.email.lower()
    if db.scalar(select(func.count()).select_from(User).where(User.email == email)):
        raise conflict("email_taken", "An account with this email already exists")
    new = User(
        organization_id=admin.organization_id, name=body.name.strip(), email=email,
        password_hash=hash_password(body.password), role=body.role,
    )
    db.add(new)
    db.flush()
    audit.record(db, organization_id=admin.organization_id, actor_id=admin.id, entity_type="user",
                 entity_id=new.id, action="user_created", details={"role": body.role})
    db.commit()
    return new


@router.patch("/{user_id}", response_model=UserOut)
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
    return target
