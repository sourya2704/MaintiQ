import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import Role
from app.schemas.common import ORM


class RegisterIn(BaseModel):
    organization_name: str = Field(min_length=2, max_length=200)
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class OrganizationOut(ORM):
    id: uuid.UUID
    name: str
    slug: str | None = None


class UserOut(ORM):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    email: str
    role: Role
    is_active: bool
    preferred_language: Literal["en", "hi"] | None = None
    last_login_at: datetime | None = None
    must_change_password: bool = False
    created_at: datetime


class MeOut(UserOut):
    organization: OrganizationOut


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: MeOut


class UserCreateIn(BaseModel):
    """The admin gives a name and role; Mantiq makes the company login and a one-time password."""

    name: str = Field(min_length=1, max_length=200)
    role: Role = Role.technician
    email: EmailStr | None = Field(default=None, description="Use the worker's own email instead of a company login")


class TeamMemberOut(UserOut):
    reports: int = 0


class AccountIssuedOut(BaseModel):
    """Shown to the admin once, to hand to the worker."""

    user: TeamMemberOut
    login_email: str
    temporary_password: str


class UserUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    role: Role | None = None
    is_active: bool | None = None


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class LanguageIn(BaseModel):
    language: Literal["en", "hi"]
