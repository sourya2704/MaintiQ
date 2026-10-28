from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select

from app.api.deps import DB, CurrentUser
from app.core.errors import AppError, conflict
from app.core.rate_limit import auth_rate_limit
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Organization, User
from app.models.enums import Role
from app.schemas.auth import LoginIn, MeOut, RegisterIn, TokenOut
from app.services import audit

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _token(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_access_token(user.id, user.organization_id, user.role),
        user=MeOut.model_validate(user),
    )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(auth_rate_limit)])
def register(body: RegisterIn, db: DB):
    """Create a new organization and its first (admin) user."""
    email = body.email.lower()
    if db.scalar(select(func.count()).select_from(User).where(User.email == email)):
        raise conflict("email_taken", "An account with this email already exists")
    org = Organization(name=body.organization_name.strip())
    db.add(org)
    db.flush()
    user = User(
        organization_id=org.id, name=body.name.strip(), email=email,
        password_hash=hash_password(body.password), role=Role.admin,
    )
    db.add(user)
    db.flush()
    audit.record(db, organization_id=org.id, actor_id=user.id, entity_type="user", entity_id=user.id, action="registered")
    db.commit()
    db.refresh(user)
    return _token(user)


@router.post("/login", response_model=TokenOut, dependencies=[Depends(auth_rate_limit)])
def login(body: LoginIn, db: DB):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    # Same message for unknown email and wrong password.
    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        raise AppError(401, "invalid_credentials", "Email or password is incorrect")
    return _token(user)


@router.get("/me", response_model=MeOut)
def me(user: CurrentUser):
    return user
