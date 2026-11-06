"""Company logins for workers: generated login emails and one-time passwords."""

import re
import secrets
import unicodedata

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Organization, User

LOGIN_DOMAIN = "mantiq"
# No 0/O, 1/l/I: the admin reads this out or writes it down for the worker.
PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"


def slugify(text: str, sep: str = "-", limit: int = 30) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", sep, text.lower()).strip(sep)
    return text[:limit].strip(sep)


def unique_org_slug(db: Session, name: str) -> str:
    """'Narmada Steel Works – Plant 2' -> 'narmada-steel-works-plant-2' (numbered if taken)."""
    base = slugify(name) or "plant"
    slug, n = base, 2
    while db.scalar(select(func.count()).select_from(Organization).where(Organization.slug == slug)):
        slug, n = f"{base[:36]}-{n}", n + 1
    return slug


def login_email(db: Session, org: Organization, name: str) -> str:
    """ravi.kumar@narmada-steel.mantiq; a second Ravi Kumar gets ravi.kumar2@..."""
    if not org.slug:
        org.slug = unique_org_slug(db, org.name)
    local = slugify(name, sep=".", limit=40) or "worker"
    email, n = f"{local}@{org.slug}.{LOGIN_DOMAIN}", 2
    while db.scalar(select(func.count()).select_from(User).where(User.email == email)):
        email, n = f"{local}{n}@{org.slug}.{LOGIN_DOMAIN}", n + 1
    return email


def temporary_password() -> str:
    """12 characters in three groups, e.g. 'Kp7m-Qz4t-Hx9c'. Shown once, changed at first login."""
    chars = [secrets.choice(PASSWORD_ALPHABET) for _ in range(12)]
    return "-".join("".join(chars[i:i + 4]) for i in range(0, 12, 4))
