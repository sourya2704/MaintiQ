"""Failure Memory Engine (PRD section 8).

Retrieves related historical incidents from Mantiq's own database only and
explains each result with deterministic signals:
  1. same machine          2. same machine type
  3. shared symptom tags   4. Postgres full-text relevance
Results are ordered by those signals; no score is presented as diagnostic
confidence, and weak cross-machine-type text matches are excluded rather than
padded into the list.
"""

import re
import uuid
from dataclasses import dataclass

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Incident, Machine
from app.models.enums import ProcessingStatus

STOPWORDS = {
    "the", "and", "for", "but", "was", "were", "with", "that", "this", "there", "then", "than", "have", "has", "had",
    "are", "not", "its", "it's", "from", "into", "out", "about", "also", "still", "very", "more", "less", "some",
    "just", "like", "been", "being", "after", "before", "again", "today", "yesterday", "now", "when", "what", "which",
    "machine", "issue", "problem", "noticed", "seems", "looks", "looked", "feel", "feels", "felt", "think", "usual",
    "normal", "than", "our", "his", "her", "they", "them", "you", "your", "mock", "prisma", "transcript",
}
NO_CONTENT_STATES = (ProcessingStatus.uploaded, ProcessingStatus.transcribing, ProcessingStatus.transcription_failed)
MIN_CROSS_TYPE_TEXT_RANK = 0.05
MAX_QUERY_TERMS = 40


@dataclass
class MemoryQuery:
    organization_id: uuid.UUID
    text: str
    symptom_tags: list[str]
    machine_id: uuid.UUID | None = None
    machine_type: str | None = None
    exclude_incident_id: uuid.UUID | None = None
    limit: int = 5


def query_terms(text: str) -> list[str]:
    words = re.findall(r"[a-z][a-z0-9]{2,}", (text or "").lower())
    out, seen = [], set()
    for w in words:
        w = w.strip("-")
        if len(w) < 3 or w in STOPWORDS or w in seen:
            continue
        seen.add(w)
        out.append(w)
    return out[:MAX_QUERY_TERMS]


def _stem(word: str) -> str:
    return word[:5]


def _matched_terms(terms: list[str], candidate_text: str, limit: int = 5) -> list[str]:
    cand = {_stem(w) for w in re.findall(r"[a-z][a-z0-9\-]{3,}", candidate_text.lower())}
    return [t for t in terms if len(t) >= 4 and _stem(t) in cand][:limit]


def find_related(db: Session, q: MemoryQuery) -> list[dict]:
    terms = query_terms(q.text)
    tsquery = func.to_tsquery("english", " | ".join(terms)) if terms else None

    content_match = []
    if q.symptom_tags:
        content_match.append(Incident.symptom_tags.overlap(q.symptom_tags))
    if tsquery is not None:
        content_match.append(Incident.search_vector.op("@@")(tsquery))
    if not content_match:
        return []

    cols = [Incident, Machine]
    if tsquery is not None:
        rank_col = func.ts_rank_cd(Incident.search_vector, tsquery).label("text_rank")
        cols.append(rank_col)
    stmt = (
        select(*cols)
        .join(Machine, Machine.id == Incident.machine_id)
        .where(
            and_(
                Incident.organization_id == q.organization_id,  # tenant boundary
                Incident.processing_status.notin_([s.value for s in NO_CONTENT_STATES]),
                Incident.search_text != "",
                or_(*content_match),
            )
        )
        .options(selectinload(Incident.outcomes))
        .limit(200)
    )
    if q.exclude_incident_id is not None:
        stmt = stmt.where(Incident.id != q.exclude_incident_id)
    if tsquery is not None:
        stmt = stmt.order_by(rank_col.desc())

    results = []
    for row in db.execute(stmt).all():
        incident, machine = row[0], row[1]
        text_rank = float(row[2]) if tsquery is not None and row[2] is not None else 0.0
        same_machine = q.machine_id is not None and incident.machine_id == q.machine_id
        same_type = (
            q.machine_type is not None and machine.type.strip().lower() == q.machine_type.strip().lower()
        )
        shared = sorted(set(q.symptom_tags) & set(incident.symptom_tags or []))
        matched = _matched_terms(terms, incident.search_text) if text_rank > 0 else []

        # Transparent exclusion rule: a different machine type needs a shared
        # symptom or a meaningful text match to be shown at all.
        if not same_machine and not same_type and not shared and text_rank < MIN_CROSS_TYPE_TEXT_RANK:
            continue
        if not shared and not matched:
            continue

        rationale = []
        if same_machine:
            rationale.append(f"Same machine ({machine.asset_code})")
        elif same_type:
            rationale.append(f"Same machine type ({machine.type})")
        else:
            rationale.append(f"Different machine type ({machine.type}); ranked lower")
        if shared:
            rationale.append("Shared symptom: " + ", ".join(s.replace("_", " ") for s in shared))
        if matched:
            rationale.append("Text overlap: " + ", ".join(matched))

        sort_key = (int(same_machine), int(same_type), len(shared), round(text_rank, 4), incident.occurred_at)
        results.append((sort_key, incident, machine, rationale, shared, matched, text_rank, same_machine, same_type))

    results.sort(key=lambda r: r[0], reverse=True)
    out = []
    for position, (_, inc, machine, rationale, shared, matched, text_rank, same_machine, same_type) in enumerate(
        results[: q.limit], start=1
    ):
        latest = inc.outcomes[-1] if inc.outcomes else None
        out.append(
            {
                "rank": position,
                "incident_id": inc.id,
                "link": f"/incidents/{inc.id}",
                "occurred_at": inc.occurred_at,
                "machine": {"id": machine.id, "asset_code": machine.asset_code, "name": machine.name, "type": machine.type},
                "summary": inc.summary,
                "symptoms": inc.symptoms,
                "observations": inc.observations,
                "actions_taken": inc.actions_taken,
                "review_status": inc.review_status,
                "resolution_status": inc.resolution_status,
                "is_seed": inc.is_seed,
                "outcome": (
                    {
                        "resolution_status": latest.resolution_status,
                        "verified_cause": latest.verified_cause,
                        "action_performed": latest.action_performed,
                        "resolved_at": latest.resolved_at,
                    }
                    if latest
                    else None
                ),
                "outcome_label": "recorded" if latest else "unknown/unrecorded",
                "rationale": rationale,
                "signals": {
                    "same_machine": same_machine,
                    "same_machine_type": same_type,
                    "shared_symptoms": shared,
                    "matched_terms": matched,
                    "text_relevance": round(text_rank, 4),
                },
            }
        )
    return out


def history_for_prompt(related: list[dict]) -> list[dict]:
    """Compact view of related incidents handed to Evon as context."""
    return [
        {
            "date": r["occurred_at"].date().isoformat(),
            "asset_code": r["machine"]["asset_code"],
            "machine_type": r["machine"]["type"],
            "summary": r["summary"] or "",
            "actions": "; ".join(r["actions_taken"] or []),
            "outcome": (
                f"{r['outcome']['resolution_status']}: {r['outcome']['verified_cause'] or 'cause not verified'}"
                if r["outcome"]
                else None
            ),
        }
        for r in related
    ]
