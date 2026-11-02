import json

import httpx

from app.services.providers import base as provider_base
from scripts.seed import seed
from tests.conftest import make_machine, register
from tests.test_memory_engine import login_seed, machine_id


def use_transport(monkeypatch, handler):
    monkeypatch.setattr(provider_base, "http_client",
                        lambda timeout: httpx.Client(transport=httpx.MockTransport(handler), timeout=timeout))


def manual(client, headers, mid, text):
    r = client.post("/api/incidents", headers=headers, data={"machine_id": mid, "transcript": text})
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ---------------------------------------------------------------- troubleshooting guide


def test_mock_guide_cites_verified_history_and_starts_safe(client):
    seed()
    h = login_seed(client)
    iid = manual(client, h, machine_id("M-104"), "M-104 vibrating badly and the housing is hot. Belt tension checked, fine.")
    client.post(f"/api/incidents/{iid}/analyze", headers=h)
    assert client.post(f"/api/incidents/{iid}/troubleshoot", headers=h).status_code == 202
    inc = client.get(f"/api/incidents/{iid}", headers=h).json()
    g = inc["guide"]

    assert inc["guide_source"] == "evon_mock" and not inc["guide_generating"]
    assert g["steps"][0]["order"] == 1 and "lock out" in g["steps"][0]["action"].lower()
    top = g["likely_causes"][0]
    assert top["likelihood"] == "higher" and top["cause"] == "Worn non-drive-end bearing"
    assert top["history"][0]["asset_code"] == "M-104" and top["history"][0]["verified_cause"]
    assert "not a diagnosis" in g["disclaimer"]
    assert all("%" not in c["likelihood"] for c in g["likely_causes"])
    job = [j for j in inc["jobs"] if j["task"] == "troubleshooting"][0]
    assert job["status"] == "succeeded" and job["mode"] == "mock"
    assert "Troubleshooting guide (AI-suggested" in client.get(f"/api/incidents/{iid}/export", headers=h).text


def test_live_guide_drops_fake_citations_and_unsafe_steps(client, settings, monkeypatch):
    seed()
    h = login_seed(client)
    settings.evon_mode = "live"
    sent = {}

    def handler(request):
        body = json.loads(request.content)
        sent["prompt"] = body["messages"][1]["content"]
        guide = {
            "summary": "Likely bearing related.",
            "likely_causes": [
                {"cause": "Worn bearing", "likelihood": "Higher", "evidence": ["rumble"], "history_refs": ["H1", "H9"]},
                {"cause": "Misalignment", "likelihood": "73%", "evidence": [], "history_refs": []},
            ],
            "steps": [
                {"action": "Bypass the interlock and run unloaded", "why": "quick test", "expected_finding": "", "safety": None},
                {"action": "Measure bearing temperatures", "why": "locate heat", "expected_finding": "one hot bearing", "safety": None},
            ],
            "parts_to_have": ["6205 bearing"],
            "escalate_if": [],
            "do_not": [],
            "confidence_notes": "",
        }
        return httpx.Response(200, json={"id": "c1", "model": "evon", "choices": [{"message": {"content": json.dumps(guide)}}]})

    use_transport(monkeypatch, handler)
    iid = manual(client, h, machine_id("C-301"), "Smoke from the C-301 motor panel and a burning smell.")
    client.post(f"/api/incidents/{iid}/troubleshoot", headers=h)
    g = client.get(f"/api/incidents/{iid}", headers=h).json()["guide"]

    assert "<report>" in sent["prompt"] and "Related past incidents" in sent["prompt"]
    assert [c["likelihood"] for c in g["likely_causes"]] == ["higher", "possible"]  # % rejected
    assert all(r["ref"] != "H9" for c in g["likely_causes"] for r in c["history"])
    assert any("unknown history" in w for w in g["warnings"])
    assert all("interlock" not in s["action"].lower() for s in g["steps"])
    assert "lock out" in g["steps"][0]["action"].lower()
    assert g["escalate_if"][0].startswith("A hazard was reported")
    assert any("guards" in d for d in g["do_not"])


def test_guide_requires_transcript_and_is_org_scoped(client, auth, settings):
    from tests.conftest import wav_bytes

    settings.prisma_mode = "disabled"  # transcription fails, so the incident has no transcript
    m = make_machine(client, auth)
    no_text = client.post("/api/incidents", headers=auth, data={"machine_id": m["id"]},
                          files={"audio_file": ("a.wav", wav_bytes(), "audio/wav")}).json()["id"]
    r = client.post(f"/api/incidents/{no_text}/troubleshoot", headers=auth)
    assert r.status_code == 409 and r.json()["error"]["code"] == "no_transcript"

    iid = manual(client, auth, m["id"], "Pump leaking at seal.")
    other = register(client, org="Rival", email="r@x.example.com")
    assert client.post(f"/api/incidents/{iid}/troubleshoot", headers=other).status_code == 404


# ---------------------------------------------------------------- CSV import


CSV = (
    "Asset No;Equipment;Category;Make;Area;Status\n"
    "m-501;Boiler feed pump;centrifugal pump;Grundfos;Boiler house;Running\n"
    "M-502;Cooling tower fan;fan;;Roof;\n"
    "M-501;Duplicate row;pump;;;\n"
    ";Missing code;pump;;;\n"
    "M-503;Bad status;motor;;;exploded\n"
).encode("utf-8-sig")


def _upload(client, headers, content, **params):
    return client.post("/api/machines/import", headers=headers, params=params,
                       files={"file": ("assets.csv", content, "text/csv")})


def test_csv_import_dry_run_then_commit(client, auth):
    preview = _upload(client, auth, CSV).json()
    assert preview["dry_run"] and preview["created"] == 2 and preview["total_rows"] == 5
    assert {e["line"] for e in preview["errors"]} == {4, 5, 6}
    assert client.get("/api/machines", headers=auth).json()["total"] == 0  # nothing saved

    done = _upload(client, auth, CSV, dry_run=False).json()
    assert done["created"] == 2
    items = {m["asset_code"]: m for m in client.get("/api/machines", headers=auth).json()["items"]}
    assert items["M-501"]["manufacturer"] == "Grundfos" and items["M-501"]["status"] == "operational"
    assert items["M-502"]["type"] == "fan"


def test_csv_import_conflicts_skip_or_update(client, auth):
    make_machine(client, auth, code="M-501", name="Old name", type_="pump")
    skip = _upload(client, auth, CSV, dry_run=False).json()
    assert skip["skipped"] == 1 and skip["created"] == 1
    upd = _upload(client, auth, CSV, dry_run=False, on_conflict="update").json()
    assert upd["updated"] == 2
    names = {m["asset_code"]: m["name"] for m in client.get("/api/machines", headers=auth).json()["items"]}
    assert names["M-501"] == "Boiler feed pump"


def test_csv_import_validation_and_permissions(client, auth):
    bad = _upload(client, auth, b"foo,bar\n1,2\n")
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "missing_columns"
    assert _upload(client, auth, b"").status_code == 400
    assert "asset_code" in client.get("/api/machines/import/template", headers=auth).text
    client.post("/api/users", headers=auth, json={"name": "T", "email": "t@acme.example.com", "password": "Password123!"})
    tok = client.post("/api/auth/login", json={"email": "t@acme.example.com", "password": "Password123!"}).json()["access_token"]
    assert _upload(client, {"Authorization": f"Bearer {tok}"}, CSV).status_code == 403
