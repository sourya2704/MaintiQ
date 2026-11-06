import json

import httpx

from app.services.providers import base as provider_base
from tests.conftest import add_worker, make_machine, register

GUIDE = {
    "summary": "Seal face wear is the likely cause of the leak.",
    "likely_causes": [{"cause": "Worn mechanical seal", "likelihood": "higher", "evidence": ["Drip at seal"], "history_refs": []}],
    "steps": [{"action": "Isolate and lock out the pump.", "why": "Safety first.", "expected_finding": "Zero energy.", "safety": "Lockout/tagout"},
              {"action": "Inspect the seal faces for scoring.", "why": "Scored faces leak.", "expected_finding": "Smooth faces.", "safety": None}],
    "parts_to_have": ["Mechanical seal kit"], "escalate_if": ["Leak is hot fluid"], "do_not": ["Do not run dry"],
    "confidence_notes": "Based on the report and two manufacturer manuals.",
}


def gemini_transport(monkeypatch, reply_for):
    calls = []

    def handler(request: httpx.Request):
        body = json.loads(request.content)
        calls.append(body)
        assert request.headers["x-goog-api-key"] == "test-gemini-key" and "key=" not in str(request.url)
        text = reply_for(body)
        return httpx.Response(200, json={
            "candidates": [{"content": {"parts": [{"text": text}]},
                            "groundingMetadata": {"groundingChunks": [{"web": {"uri": "https://example.com/seal", "title": "Seal guide"}}]}}],
            "modelVersion": "gemini-2.5-flash"})

    monkeypatch.setattr(provider_base, "http_client",
                        lambda timeout: httpx.Client(transport=httpx.MockTransport(handler), timeout=timeout))
    return calls


def add_member(client, admin, email, role="technician", name="Ravi"):
    uid, _, headers = add_worker(client, admin, name=f"{name} {email.split('@')[0]}", role=role)
    return uid, headers


def incident_with_guide(client, auth):
    m = make_machine(client, auth, code="P-201", type_="centrifugal pump")
    inc = client.post("/api/incidents", headers=auth, data={"machine_id": m["id"], "transcript": "Pump seal is leaking"}).json()
    assert client.post(f"/api/incidents/{inc['id']}/troubleshoot", headers=auth).status_code == 202
    return inc["id"]


def test_gemini_guide_uses_search_and_lists_sources(client, auth, settings, monkeypatch):
    settings.ai_mode, settings.gemini_api_key = "live", "test-gemini-key"
    calls = gemini_transport(monkeypatch, lambda body: json.dumps(GUIDE))
    inc = incident_with_guide(client, auth)
    g = client.get(f"/api/incidents/{inc}", headers=auth).json()
    assert g["guide_source"] == "gemini"
    assert g["guide"]["sources"] == [{"title": "Seal guide", "url": "https://example.com/seal"}]
    assert calls[0]["tools"] == [{"google_search": {}}]
    assert g["guide"]["steps"][0]["action"].startswith("Isolate")


def test_admin_sends_fix_and_mechanic_reads_it_in_hindi(client, auth, settings, monkeypatch):
    settings.ai_mode, settings.gemini_api_key = "live", "test-gemini-key"

    def reply(body):
        prompt = body["contents"][0]["parts"][0]["text"]
        if prompt.startswith("Translate"):
            items = json.loads(prompt[prompt.rindex("\n\n"):])
            return json.dumps({"items": [f"हिं:{x}" for x in items]})
        return json.dumps(GUIDE)

    gemini_transport(monkeypatch, reply)
    inc = incident_with_guide(client, auth)
    ravi_id, ravi = add_member(client, auth, "ravi@acme.example.com")
    client.put("/api/auth/me/language", headers=ravi, json={"language": "hi"})

    sent = client.post("/api/messages", headers=auth, json={"recipient_id": ravi_id, "body": "Please do this today",
                                                            "incident_id": inc, "send_fix": True})
    assert sent.status_code == 201 and sent.json()["kind"] == "fix" and len(sent.json()["fix"]["steps"]) == 2

    assert client.get("/api/messages/unread-count", headers=ravi).json()["unread"] == 1
    admin_id = client.get("/api/auth/me", headers=auth).json()["id"]
    thread = client.get("/api/messages", headers=ravi, params={"with": admin_id}).json()
    msg = thread[0]
    assert msg["translated"] and msg["body"] == "हिं:Please do this today"
    assert msg["fix"]["steps"][1]["action"] == "हिं:Inspect the seal faces for scoring."
    assert msg["original_body"] == "Please do this today"
    assert client.get("/api/messages/unread-count", headers=ravi).json()["unread"] == 0

    # mechanic replies; mechanics cannot send fixes
    assert client.post("/api/messages", headers=ravi, json={"recipient_id": admin_id, "body": "ठीक है"}).status_code == 201
    no = client.post("/api/messages", headers=ravi, json={"recipient_id": admin_id, "incident_id": inc, "send_fix": True})
    assert no.status_code == 403

    hi_guide = client.get(f"/api/incidents/{inc}/guide", headers=ravi, params={"lang": "hi"}).json()
    assert hi_guide["translated"] and hi_guide["guide"]["summary"].startswith("हिं:")


def test_messages_stay_inside_the_organization(client, auth):
    other = register(client, org="Other", email="o@x.example.com")
    other_id = client.get("/api/auth/me", headers=other).json()["id"]
    r = client.post("/api/messages", headers=auth, json={"recipient_id": other_id, "body": "hi"})
    assert r.status_code == 404
    assert client.get("/api/messages", headers=auth, params={"with": other_id}).status_code == 404
    assert all(c["id"] != other_id for c in client.get("/api/messages/contacts", headers=auth).json())


def test_without_ai_messages_show_the_original(client, auth):
    ravi_id, ravi = add_member(client, auth, "r2@acme.example.com")
    client.put("/api/auth/me/language", headers=ravi, json={"language": "hi"})
    client.post("/api/messages", headers=auth, json={"recipient_id": ravi_id, "body": "Check the belt"})
    admin_id = client.get("/api/auth/me", headers=auth).json()["id"]
    msg = client.get("/api/messages", headers=ravi, params={"with": admin_id}).json()[0]
    assert msg["body"] == "Check the belt" and not msg["translated"]


def test_login_is_limited_per_account_even_from_new_addresses(client, settings):
    from app.core import rate_limit

    register(client, email="victim@x.example.com")
    settings.auth_rate_limit_per_minute = 3
    rate_limit.reset()
    codes = [client.post("/api/auth/login", headers={"X-Forwarded-For": f"10.0.0.{i}"},
                         json={"email": "victim@x.example.com", "password": "wrong-pass"}).status_code for i in range(5)]
    assert codes[:3] == [401, 401, 401] and codes[3] == 429
