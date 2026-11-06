from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select

from app.api.deps import DB, CurrentUser
from app.core.errors import AppError, conflict
from app.core.rate_limit import (
    auth_rate_limit,
    global_limit,
    login_account_guard,
    record_login_failure,
)
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    hash_password,
    verify_password,
)
from app.db.base import utcnow
from app.models import Organization, User
from app.models.enums import Role
from app.schemas.auth import (
    ChangePasswordIn,
    LanguageIn,
    LoginIn,
    MeOut,
    RegisterIn,
    TokenOut,
)
from app.services import accounts, audit

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _token(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_access_token(user.id, user.organization_id, user.role, user.password_hash),
        user=MeOut.model_validate(user),
    )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(auth_rate_limit)])
def register(body: RegisterIn, db: DB):
    """Create a new organization and its first (admin) user."""
    # A cap that does not depend on the (spoofable) client address, so registration cannot be
    # used to fill the database by cycling forwarded addresses. Generous for real use.
    global_limit("register", 100, 3600, "Too many new organizations just now; try again shortly")
    email = body.email.lower()
    if db.scalar(select(func.count()).select_from(User).where(User.email == email)):
        raise conflict("email_taken", "An account with this email already exists")
    org = Organization(name=body.organization_name.strip())
    org.slug = accounts.unique_org_slug(db, org.name)
    db.add(org)
    db.flush()
    user = User(
        organization_id=org.id, name=body.name.strip(), email=email,
        password_hash=hash_password(body.password), role=Role.admin,
    )
    user.last_login_at = utcnow()
    db.add(user)
    db.flush()
    audit.record(db, organization_id=org.id, actor_id=user.id, entity_type="user", entity_id=user.id, action="registered")
    db.commit()
    db.refresh(user)
    return _token(user)


@router.post("/login", response_model=TokenOut, dependencies=[Depends(auth_rate_limit)])
def login(body: LoginIn, db: DB):
    login_account_guard(body.email)  # too many recent *failures* for this account
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    # Same message and same timing for unknown email, inactive account and wrong password.
    if user is None or not user.is_active:
        verify_password(body.password, DUMMY_PASSWORD_HASH)
        record_login_failure(body.email)
        raise AppError(401, "invalid_credentials", "Email or password is incorrect")
    if not verify_password(body.password, user.password_hash):
        record_login_failure(body.email)
        raise AppError(401, "invalid_credentials", "Email or password is incorrect")
    user.last_login_at = utcnow()
    db.commit()
    return _token(user)


@router.get("/me", response_model=MeOut)
def me(user: CurrentUser):
    return user


@router.put("/me/language", response_model=MeOut)
def set_language(body: LanguageIn, db: DB, user: CurrentUser):
    """Save the user's interface language so it follows them across sign-ins and devices."""
    if user.preferred_language != body.language:
        user.preferred_language = body.language
        audit.record(db, organization_id=user.organization_id, actor_id=user.id, entity_type="user",
                     entity_id=user.id, action="language_changed", details={"language": body.language})
        db.commit()
    return user


@router.post("/change-password", response_model=TokenOut, dependencies=[Depends(auth_rate_limit)])
def change_password(body: ChangePasswordIn, db: DB, user: CurrentUser):
    if not verify_password(body.current_password, user.password_hash):
        raise AppError(400, "invalid_credentials", "Current password is incorrect")
    if body.current_password == body.new_password:
        raise AppError(422, "validation_error", "New password must be different")
    user.password_hash = hash_password(body.new_password)
    user.must_change_password = False
    audit.record(db, organization_id=user.organization_id, actor_id=user.id, entity_type="user",
                 entity_id=user.id, action="password_changed")
    db.commit()
    db.refresh(user)
    return _token(user)  # this device stays signed in; every other session ends
