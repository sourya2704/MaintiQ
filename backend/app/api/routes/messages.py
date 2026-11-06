"""Messages between people in one organization, including fixes sent from an incident's guide.

Text is stored in the language it was written in. When the reader uses the other
language it is translated once (Gemini) and the translation is kept on the message.
"""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, get_incident_for_user
from app.core.errors import AppError, forbidden, not_found
from app.core.rate_limit import ai_rate_limit, hit
from app.db.base import utcnow
from app.models import Message, User
from app.models.enums import Role
from app.services import audit, translation

router = APIRouter(prefix="/api/messages", tags=["messages"])

FIX_TEXT_FIELDS = ("summary",)
FIX_LIST_FIELDS = ("parts_to_have", "escalate_if", "do_not")
STEP_FIELDS = ("action", "why", "expected_finding", "safety")


class MessageIn(BaseModel):
    recipient_id: uuid.UUID
    body: str = Field(default="", max_length=4000)
    incident_id: uuid.UUID | None = None
    send_fix: bool = Field(default=False, description="Attach the incident's current troubleshooting steps")


class Person(BaseModel):
    id: uuid.UUID
    name: str
    role: Role


class MessageOut(BaseModel):
    id: uuid.UUID
    sender: Person
    recipient: Person
    incident_id: uuid.UUID | None
    incident_label: str | None
    kind: Literal["text", "fix"]
    body: str
    original_body: str
    fix: dict | None
    language: str
    shown_language: str
    translated: bool
    created_at: str
    read_at: str | None
    mine: bool


class Contact(Person):
    unread: int = 0
    last_at: str | None = None


def _person(u: User) -> Person:
    return Person(id=u.id, name=u.name, role=u.role)


def _fix_snapshot(guide: dict, note: str) -> dict:
    return {
        "summary": guide.get("summary", ""),
        "steps": [{k: s.get(k) for k in ("order", *STEP_FIELDS)} for s in guide.get("steps", [])],
        **{k: list(guide.get(k, [])) for k in FIX_LIST_FIELDS},
        "note": note,
    }


def _texts(m: Message) -> list[str]:
    """Every translatable string of a message, in a fixed order."""
    out = [m.body]
    if m.fix:
        out += [m.fix.get(k) or "" for k in FIX_TEXT_FIELDS]
        for s in m.fix.get("steps", []):
            out += [s.get(k) or "" for k in STEP_FIELDS]
        for k in FIX_LIST_FIELDS:
            out += list(m.fix.get(k, []))
    return out


def _apply(m: Message, texts: list[str]) -> tuple[str, dict | None]:
    it = iter(texts)
    body = next(it)
    if not m.fix:
        return body, None
    fix = {**m.fix}
    for k in FIX_TEXT_FIELDS:
        fix[k] = next(it)
    fix["steps"] = [{**s, **{k: (next(it) or None) for k in STEP_FIELDS}} for s in m.fix.get("steps", [])]
    for k in FIX_LIST_FIELDS:
        fix[k] = [next(it) for _ in m.fix.get(k, [])]
    return body, fix


def _ensure_translations(db, messages: list[Message], lang: str) -> None:
    """Translate, in one call, every message the reader cannot read yet."""
    todo = [m for m in messages if m.language != lang and lang not in (m.translations or {})]
    if not todo or not translation.available():
        return
    batch, spans = [], []
    for m in todo:
        texts = _texts(m)
        spans.append((m, len(batch), len(texts)))
        batch += texts
    result = translation.translate(batch, lang)
    if result is None:
        return
    for m, start, n in spans:
        m.translations = {**(m.translations or {}), lang: result[start:start + n]}
    db.commit()


def _out(m: Message, viewer: User) -> MessageOut:
    lang = viewer.preferred_language or "en"
    cached = (m.translations or {}).get(lang) if m.language != lang else None
    body, fix = _apply(m, cached) if cached else (m.body, m.fix)
    inc = m.incident
    return MessageOut(
        id=m.id, sender=_person(m.sender), recipient=_person(m.recipient), incident_id=m.incident_id,
        incident_label=f"{inc.machine.asset_code}: {inc.summary or ''}"[:160] if inc else None,
        kind=m.kind, body=body, original_body=m.body, fix=fix, language=m.language,
        shown_language=lang if cached else m.language, translated=bool(cached),
        created_at=m.created_at.isoformat(), read_at=m.read_at.isoformat() if m.read_at else None,
        mine=m.sender_id == viewer.id,
    )


@router.get("/contacts", response_model=list[Contact])
def contacts(db: DB, user: CurrentUser):
    """Everyone the user can message, with unread counts and last activity."""
    people = db.scalars(select(User).where(User.organization_id == user.organization_id, User.is_active.is_(True),
                                           User.id != user.id).order_by(User.name)).all()
    unread = dict(db.execute(
        select(Message.sender_id, func.count()).where(Message.recipient_id == user.id, Message.read_at.is_(None))
        .group_by(Message.sender_id)).all())
    last: dict = {}
    for a, b, at in db.execute(
        select(Message.sender_id, Message.recipient_id, func.max(Message.created_at))
        .where(or_(Message.sender_id == user.id, Message.recipient_id == user.id))
        .group_by(Message.sender_id, Message.recipient_id)).all():
        other = b if a == user.id else a
        last[other] = max(last.get(other, at), at)
    out = [Contact(id=p.id, name=p.name, role=p.role, unread=unread.get(p.id, 0),
                   last_at=last[p.id].isoformat() if p.id in last else None) for p in people]
    return sorted(out, key=lambda c: (c.last_at is None, -(c.unread), c.last_at or "", c.name), reverse=False)


@router.get("/unread-count")
def unread_count(db: DB, user: CurrentUser):
    n = db.scalar(select(func.count()).select_from(Message).where(Message.recipient_id == user.id,
                                                                  Message.read_at.is_(None)))
    return {"unread": n or 0}


@router.get("", response_model=list[MessageOut])
def thread(db: DB, user: CurrentUser, with_user: Annotated[uuid.UUID, Query(alias="with")],
           limit: int = Query(default=100, ge=1, le=300)):
    """Conversation with one person, oldest first. Opening it marks their messages as read."""
    other = db.get(User, with_user)
    if other is None or other.organization_id != user.organization_id:
        raise not_found("User")
    rows = db.scalars(
        select(Message).where(or_(
            (Message.sender_id == user.id) & (Message.recipient_id == other.id),
            (Message.sender_id == other.id) & (Message.recipient_id == user.id),
        )).options(selectinload(Message.sender), selectinload(Message.recipient), selectinload(Message.incident))
        .order_by(Message.created_at.desc()).limit(limit)
    ).all()[::-1]
    now = utcnow()
    for m in rows:
        if m.recipient_id == user.id and m.read_at is None:
            m.read_at = now
    db.commit()
    lang = user.preferred_language or "en"
    if any(m.language != lang and lang not in (m.translations or {}) for m in rows):
        try:
            ai_rate_limit(user.id)
            _ensure_translations(db, rows, lang)
        except AppError:
            pass  # over the AI limit: show the original text for now
    return [_out(m, user) for m in rows]


@router.post("", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send(body: MessageIn, db: DB, user: CurrentUser):
    hit(f"msg:{user.id}", 60, 60, "You are sending messages too quickly")
    recipient = db.get(User, body.recipient_id)
    if recipient is None or recipient.organization_id != user.organization_id or not recipient.is_active:
        raise not_found("User")
    if recipient.id == user.id:
        raise AppError(422, "validation_error", "You cannot message yourself")
    text = body.body.strip()
    inc, fix = None, None
    if body.incident_id:
        inc = get_incident_for_user(db, user, body.incident_id)
    if body.send_fix:
        if user.role == Role.technician:
            raise forbidden("Only supervisors and admins can send fixes")
        if inc is None or not inc.guide:
            raise AppError(409, "no_fix", "Generate the troubleshooting guide before sending it")
        fix = _fix_snapshot(inc.guide, text)
    if not text and fix is None:
        raise AppError(422, "validation_error", "Write a message")
    sample = " ".join([text, (fix or {}).get("summary", "")])
    m = Message(organization_id=user.organization_id, sender_id=user.id, recipient_id=recipient.id,
                incident_id=inc.id if inc else None, kind="fix" if fix else "text", body=text, fix=fix,
                language=translation.detect_language(sample), translations={})
    db.add(m)
    db.flush()
    audit.record(db, organization_id=user.organization_id, actor_id=user.id, entity_type="message", entity_id=m.id,
                 action="fix_sent" if fix else "message_sent", details={"to": str(recipient.id)})
    db.commit()
    db.refresh(m)
    return _out(m, user)
