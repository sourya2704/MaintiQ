import json
import uuid

import httpx

from app.services.providers import base as provider_base
from app.services.symptoms import detect_hazard, tag_symptoms
from tests.conftest import make_machine, wav_bytes


def use_transport(monkeypatch, handler):
    monkeypatch.setattr(provider_base, "http_client",
                        lambda timeout: httpx.Client(transport=httpx.MockTransport(handler), timeout=timeout))


def _form_field(body: bytes, name: str) -> str | None:
    marker = f'name="{name}"\r\n\r\n'.encode()
    if marker not in body:
        return None
    return body.split(marker, 1)[1].split(b"\r\n--", 1)[0].decode()


def test_long_recording_is_chunked_with_context_and_keyterms(client, auth, settings, monkeypatch):
    settings.prisma_mode, settings.gnani_api_key = "live", "k"
    calls = []

    def handler(request):
        calls.append(request.content)
        return httpx.Response(200, json={"success": True, "request_id": f"r{len(calls)}",
                                         "transcript": f"part {len(calls)}.", "model": "prisma-v3.0"})

    use_transport(monkeypatch, handler)
    m = make_machine(client, auth, code="M-104", name="Line 1 drive motor")
    r = client.post("/api/incidents", headers=auth, data={"machine_id": m["id"]},
                    files={"audio_file": ("long.wav", wav_bytes(45), "audio/wav")})
    assert r.status_code == 201, r.text
    inc = client.get(f"/api/incidents/{r.json()['id']}", headers=auth).json()

    assert len(calls) == 2
    assert inc["transcript_original"] == "part 1. part 2."
    assert _form_field(calls[0], "previous_text") is None
    assert _form_field(calls[1], "previous_text") == "part 1."
    assert "M-104" in json.loads(_form_field(calls[0], "keyterms"))
    assert inc["jobs"][0]["provider_request_id"] == "r1,r2"


def test_negated_symptoms_and_hazards_are_ignored():
    assert tag_symptoms("There is no smoke and no burning smell.") == []
    assert not detect_hazard("There is no smoke and no burning smell.")
    assert detect_hazard("No leak, but heavy smoke from the panel.")
    assert tag_symptoms("It is not vibrating anymore but the housing is hot") == ["overheating"]
    assert tag_symptoms("The thermal gun is not working") == []


def test_change_password(client, auth):
    bad = client.post("/api/auth/change-password", headers=auth,
                      json={"current_password": "nope", "new_password": "NewPassword1!"})
    assert bad.status_code == 400
    ok = client.post("/api/auth/change-password", headers=auth,
                     json={"current_password": "Password123!", "new_password": "NewPassword1!"})
    assert ok.status_code == 200
    assert client.post("/api/auth/login", json={"email": "lead@acme.example.com", "password": "NewPassword1!"}).status_code == 200


def test_mine_filter_and_recurring_symptoms(client, auth):
    m = make_machine(client, auth)
    for text in ("Motor vibrating and hot.", "Vibration again at full speed.", "Grinding noise at start."):
        client.post("/api/incidents", headers=auth, data={"machine_id": m["id"], "transcript": text})
    from tests.conftest import add_worker

    _, _, tech_headers = add_worker(client, auth, name="T")
    tok = tech_headers["Authorization"].split()[1]
    tech = {"Authorization": f"Bearer {tok}"}
    client.post("/api/incidents", headers=tech, data={"machine_id": m["id"], "transcript": "Leak at seal."})

    assert client.get("/api/incidents", headers=tech, params={"mine": True}).json()["total"] == 1
    assert client.get("/api/incidents", headers=tech).json()["total"] == 4

    recurring = client.get(f"/api/machines/{m['id']}", headers=auth).json()["recurring_symptoms"]
    assert recurring[0]["tag"] == "vibration" and recurring[0]["count"] == 2


def test_evon_connection_check(client, auth, settings, monkeypatch):
    assert client.get("/api/settings/integrations/evon/check", headers=auth).json()["reachable"] is None
    settings.evon_mode = "live"
    use_transport(monkeypatch, lambda r: httpx.Response(200, json={"data": [{"id": settings.evon_model}]}))
    body = client.get("/api/settings/integrations/evon/check", headers=auth).json()
    assert body["reachable"] is True and body["configured_model_served"] is True


def test_hindi_and_hinglish_symptoms():
    code_mixed = "pump P-201 की seal से पानी टपक रहा है और motor सामान्य से ज्यादा गर्म है"
    assert tag_symptoms(code_mixed) == ["overheating", "leak"]
    assert tag_symptoms("motor गर्म नहीं है लेकिन बहुत आवाज़ कर रहा है") == ["abnormal_noise"]
    assert detect_hazard("पैनल से धुआं निकल रहा है")
    assert not detect_hazard("धुआं नहीं है")
    assert tag_symptoms("motor bahut garam hai aur awaaz aa rahi hai") == ["overheating", "abnormal_noise"]


def test_jobs_interrupted_by_restart_are_failed_and_retryable(client, auth):
    from app.db.session import SessionLocal
    from app.models import AIProcessingJob, Incident
    from app.services.pipeline import recover_interrupted_jobs
    from tests.conftest import make_machine

    m = make_machine(client, auth)
    inc = client.post("/api/incidents", headers=auth,
                      data={"machine_id": m["id"], "transcript": "Pump is leaking at the seal"}).json()
    with SessionLocal() as db:
        row = db.get(Incident, uuid.UUID(inc["id"]))
        row.processing_status = "analyzing"
        db.add(AIProcessingJob(incident_id=row.id, provider="evon", task="extraction", model="evon-mock", mode="mock"))
        db.commit()

    assert recover_interrupted_jobs() == 1
    after = client.get(f"/api/incidents/{inc['id']}", headers=auth).json()
    assert after["processing_status"] == "analysis_failed"
    assert client.post(f"/api/incidents/{inc['id']}/analyze", headers=auth).status_code == 202


def test_evon_credentials_status_is_reported_honestly(client, auth, settings):
    def evon():
        return next(p for p in client.get("/api/settings/integrations", headers=auth).json()["providers"]
                    if p["provider"] == "evon")

    settings.evon_mode, settings.evon_base_url, settings.evon_api_key = "live", "https://evon.example.com/v1", ""
    assert evon()["credentials_configured"] is False and evon()["live_ready"] is False
    settings.evon_api_key = "key"
    assert evon()["live_ready"] is True
    settings.evon_base_url, settings.evon_api_key = "http://localhost:30000/v1", ""
    assert evon()["credentials_configured"] is True


def test_safety_filter_keeps_negated_advice():
    from app.services.extraction import is_unsafe_advice

    assert is_unsafe_advice("Bypass the interlock to test the motor")
    assert is_unsafe_advice("Do not wait, bypass the interlock")
    assert not is_unsafe_advice("Do not remove the guard while the shaft turns")
    assert not is_unsafe_advice("Never bypass the safety interlock")
