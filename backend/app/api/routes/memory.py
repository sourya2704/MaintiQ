import uuid

from fastapi import APIRouter, Query

from app.api.deps import DB, CurrentUser, get_machine_for_user
from app.schemas.incidents import RelatedResponse
from app.services import memory_engine
from app.services.symptoms import SYMPTOM_TAXONOMY, tag_symptoms

router = APIRouter(prefix="/api/memory", tags=["failure memory"])


@router.get("/search", response_model=RelatedResponse)
def search_memory(
    db: DB,
    user: CurrentUser,
    q: str = Query(min_length=2, max_length=1000, description="Describe the symptoms, e.g. 'vibration and hot bearing'"),
    machine_id: uuid.UUID | None = None,
    limit: int = Query(default=10, ge=1, le=20),
):
    """Investigate a recurring problem before (or without) creating an incident (PRD journey 6.2)."""
    machine = get_machine_for_user(db, user, machine_id) if machine_id else None
    tags = tag_symptoms(q)
    results = memory_engine.find_related(db, memory_engine.MemoryQuery(
        organization_id=user.organization_id, text=q, symptom_tags=tags,
        machine_id=machine.id if machine else None, machine_type=machine.type if machine else None, limit=limit,
    ))
    return RelatedResponse(query_symptoms=tags, results=results, no_match=not results)


@router.get("/symptom-tags", response_model=list[str])
def symptom_tags(_: CurrentUser):
    """Canonical symptom vocabulary used for matching and filtering."""
    return list(SYMPTOM_TAXONOMY)
