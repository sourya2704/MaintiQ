import uuid
from collections.abc import Callable
from typing import Annotated

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import AppError, forbidden, not_found
from app.core.security import decode_access_token, password_stamp
from app.db.session import get_db
from app.models import Incident, Machine, User
from app.models.enums import Role

bearer = HTTPBearer(auto_error=False)

DB = Annotated[Session, Depends(get_db)]


# Until a worker replaces the one-time password from their admin, only these routes answer.
FIRST_LOGIN_PATHS = {"/api/auth/me", "/api/auth/change-password", "/api/auth/me/language"}


def get_current_user(
    request: Request, db: DB, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> User:
    if creds is None:
        raise AppError(401, "unauthorized", "Authentication required")
    try:
        payload = decode_access_token(creds.credentials)
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise AppError(401, "unauthorized", "Invalid or expired token")
    user = db.get(User, user_id)
    if user is None or not user.is_active or payload.get("pwd") != password_stamp(user.password_hash):
        raise AppError(401, "unauthorized", "Invalid or expired token")
    if user.must_change_password and request.url.path not in FIRST_LOGIN_PATHS:
        raise AppError(403, "password_change_required", "Set your own password before continuing")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: Role) -> Callable[[User], User]:
    def checker(user: CurrentUser) -> User:
        if user.role not in roles:
            raise forbidden()
        return user

    return checker


def get_machine_for_user(db: Session, user: User, machine_id: uuid.UUID) -> Machine:
    machine = db.get(Machine, machine_id)
    if machine is None or machine.organization_id != user.organization_id:
        raise not_found("Machine")
    return machine


def get_incident_for_user(db: Session, user: User, incident_id: uuid.UUID, *, lock: bool = False) -> Incident:
    if lock:
        incident = db.query(Incident).filter(Incident.id == incident_id).with_for_update().one_or_none()
    else:
        incident = db.get(Incident, incident_id)
    if incident is None or incident.organization_id != user.organization_id:
        raise not_found("Incident")
    return incident
