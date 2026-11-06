"""Endpoints the public website uses without signing in."""

import logging

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, Field

from app.api.deps import DB
from app.core.rate_limit import global_limit, hit
from app.models import ContactRequest

router = APIRouter(prefix="/api/public", tags=["public"])
log = logging.getLogger("mantiq.contact")


class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    contact: str = Field(min_length=5, max_length=320, description="Email or phone number")
    message: str = Field(min_length=5, max_length=3000)
    website: str = Field(default="", max_length=200, description="Leave empty (spam trap)")


@router.post("/contact", status_code=status.HTTP_202_ACCEPTED)
def contact(body: ContactIn, request: Request, db: DB):
    """Store a contact request from the website. Limited per address to keep spam out."""
    client = request.client.host if request.client else "unknown"
    hit(f"contact:{client}", 5, 3600, "Too many messages from here; try again later")
    # The client address comes from a spoofable forwarded header; a global cap bounds how many
    # rows the public form can create regardless, so it cannot be used to fill the database.
    global_limit("contact", 120, 3600, "We are receiving many messages right now; please try again later")
    if body.website:  # bots fill every field; people never see this one
        return {"ok": True}
    db.add(ContactRequest(name=body.name.strip(), company=(body.company or "").strip() or None,
                          contact=body.contact.strip(), message=body.message.strip()))
    db.commit()
    log.info("contact request received from %s", body.name.strip()[:40])
    return {"ok": True}
