from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Incident, Machine, Organization
from scripts.seed import seed


def login_seed(client, email="tech@demo-mantiq.example.com"):
    from scripts.seed import PASSWORD

    tok = client.post("/api/auth/login", json={"email": email, "password": PASSWORD}).json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


def machine_id(code):
    with SessionLocal() as db:
        return str(db.scalar(select(Machine.id).where(Machine.asset_code == code)))


def test_same_machine_ranks_first_and_other_types_rank_lower(client):
    seed()
    h = login_seed(client)
    res = client.get("/api/memory/search", headers=h, params={
        "q": "motor vibrating and running hot, belt checked", "machine_id": machine_id("M-104")}).json()
    codes = [r["machine"]["asset_code"] for r in res["results"]]
    assert codes[0] == "M-104"
    assert codes.index("M-105") < codes.index("P-201")  # same type before different type
    pump = next(r for r in res["results"] if r["machine"]["asset_code"] == "P-201")
    assert any("Different machine type" in x for x in pump["rationale"])
    assert any(x.startswith("Shared symptom") for x in pump["rationale"])
    assert "vibration" in res["query_symptoms"]
    assert "not proof" in res["disclaimer"]


def test_no_match_is_honest(client):
    seed()
    res = client.get("/api/memory/search", headers=login_seed(client), params={"q": "label printer ink colour"}).json()
    assert res["no_match"] is True and res["results"] == []


def test_unrecorded_outcome_is_labelled(client):
    seed()
    res = client.get("/api/memory/search", headers=login_seed(client),
                     params={"q": "conveyor belt slipping slow", "machine_id": machine_id("C-301")}).json()
    top = res["results"][0]
    assert top["machine"]["asset_code"] == "C-301"
    assert top["outcome"] is None and top["outcome_label"] == "unknown/unrecorded"


def test_suspected_causes_do_not_drive_retrieval(client):
    seed()
    # "impeller" appears only as a suspected cause on P-201, never as a fact.
    res = client.get("/api/memory/search", headers=login_seed(client), params={"q": "impeller"}).json()
    assert res["no_match"] is True


def test_dashboard_reflects_seed(client):
    seed()
    d = client.get("/api/dashboard/summary", headers=login_seed(client)).json()
    with SessionLocal() as db:
        org = db.scalar(select(Organization))
        total = len(db.scalars(select(Incident).where(Incident.organization_id == org.id)).all())
    assert d["incidents"]["total"] == total == d["incidents"]["seed_records"]
    assert d["incidents"]["open"] == 4  # monitoring, open(no outcome) x2, unresolved
    assert d["top_symptoms"][0]["tag"] == "vibration"


def test_search_without_machine_has_no_machine_type_rationale(client):
    seed()
    res = client.get("/api/memory/search", headers=login_seed(client), params={"q": "pump seal leaking"}).json()
    assert res["results"]
    assert all(not any("machine type" in why for why in r["rationale"]) for r in res["results"])


def test_asset_code_and_hindi_words_are_searchable(client):
    from app.services.memory_engine import query_terms

    assert query_terms("M-104 पंप से रिसाव हो रहा है") == ["m-104", "पंप", "रिसाव"]
    seed()
    res = client.get("/api/memory/search", headers=login_seed(client), params={"q": "P-201 status"}).json()
    assert res["results"] and all(r["machine"]["asset_code"] == "P-201" for r in res["results"])
    assert any("p-201" in x for x in res["results"][0]["rationale"])
