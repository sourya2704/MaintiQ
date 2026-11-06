from fastapi.testclient import TestClient

from tests.conftest import add_worker, make_machine, register


def test_security_headers_on_every_response(client):
    r = client.get("/api/health")
    h = r.headers
    assert "default-src 'self'" in h["content-security-policy"] and "frame-ancestors 'none'" in h["content-security-policy"]
    assert h["x-content-type-options"] == "nosniff" and h["x-frame-options"] == "DENY"
    assert "camera=(self)" in h["permissions-policy"]


def test_password_change_ends_other_sessions(client):
    old = register(client, email="pw@x.example.com")
    r = client.post("/api/auth/change-password", headers=old,
                    json={"current_password": "Password123!", "new_password": "NewPassword456!"})
    assert r.status_code == 200
    new = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.get("/api/auth/me", headers=old).status_code == 401
    assert client.get("/api/auth/me", headers=new).status_code == 200


def test_mechanics_cannot_change_the_asset_registry(client, auth):
    m = make_machine(client, auth)
    _, _, tech = add_worker(client, auth)
    assert client.get(f"/api/machines/{m['id']}", headers=tech).status_code == 200
    assert client.patch(f"/api/machines/{m['id']}", headers=tech, json={"name": "x"}).status_code == 403
    assert client.post("/api/machines", headers=tech, json={"asset_code": "Z-1", "name": "x", "type": "fan"}).status_code == 403


def test_api_docs_are_hidden_in_production(settings):
    from app.main import create_app

    settings.environment = "production"
    with TestClient(create_app()) as c:
        assert c.get("/docs").status_code == 404
        assert c.get("/openapi.json").status_code == 404
        assert "max-age" in c.get("/api/health").headers["strict-transport-security"]


def test_contact_form_stores_requests_and_drops_spam(client):
    from sqlalchemy import select

    from app.db.session import SessionLocal
    from app.models import ContactRequest

    ok = client.post("/api/public/contact", json={"name": "Meena Rao", "company": "Rao Castings", "contact": "meena@example.com",
                                                   "message": "We run 40 machines; can we try Mantiq?"})
    assert ok.status_code == 202
    client.post("/api/public/contact", json={"name": "Bot", "contact": "x@example.com", "message": "buy now", "website": "http://spam"})
    with SessionLocal() as db:
        assert [c.name for c in db.scalars(select(ContactRequest))] == ["Meena Rao"]


def test_built_assets_are_compressed_and_cached(tmp_path, settings):
    from fastapi.testclient import TestClient

    from app.main import create_app

    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><div id=root></div>")
    (tmp_path / "assets" / "app-abc123.js").write_text("console.log('mantiq');\n" * 400)
    settings.static_dir = tmp_path
    with TestClient(create_app()) as c:
        r = c.get("/assets/app-abc123.js", headers={"Accept-Encoding": "gzip"})
        assert r.status_code == 200 and r.headers["content-encoding"] == "gzip"
        assert "immutable" in r.headers["cache-control"]
        assert c.get("/").headers["cache-control"] == "no-cache"


def test_login_failure_limit_never_blocks_a_correct_password(client, settings):
    from app.core import rate_limit

    register(client, email="worker@x.example.com")  # password Password123!
    settings.auth_rate_limit_per_minute = 1000  # take the per-address limit out of the way
    settings.login_failures_before_block = 3
    rate_limit.reset()
    def login(pw):
        return client.post("/api/auth/login", json={"email": "worker@x.example.com", "password": pw}).status_code
    # two wrong tries, then the right one still works (a user is not locked out by their own typos)
    assert login("nope") == 401 and login("nope") == 401
    assert login("Password123!") == 200
    # many correct sign-ins in a row never trip the block (successes are not counted)
    assert {login("Password123!") for _ in range(8)} == {200}
    # once failures reach the threshold, the next attempt is blocked
    assert login("nope") == 401  # third failure, now at the limit
    assert login("nope") == 429  # fourth is blocked


def test_registration_has_a_global_cap_despite_spoofed_addresses(client, settings):
    from app.core import rate_limit

    settings.auth_rate_limit_per_minute = 1000  # take the per-address limit out of the way
    rate_limit.reset()
    rate_limit.note("global:register", 3600)  # pretend the hour is nearly full already
    # drive the global bucket to its cap using a different forwarded address each time
    seen = set()
    for i in range(130):
        r = client.post("/api/auth/register", headers={"X-Forwarded-For": f"203.0.113.{i % 255}"},
                        json={"organization_name": f"Org {i}", "name": "A", "email": f"g{i}@x.example.com", "password": "Password123!"})
        seen.add(r.status_code)
    assert 429 in seen  # the global cap stops it regardless of the spoofed address


def test_contact_form_has_a_global_cap(client, settings):
    from app.core import rate_limit

    rate_limit.reset()
    seen = set()
    for i in range(130):
        r = client.post("/api/public/contact", headers={"X-Forwarded-For": f"198.51.100.{i % 255}"},
                        json={"name": f"Person {i}", "contact": f"p{i}@x.example.com", "message": "Hello there"})
        seen.add(r.status_code)
    assert 429 in seen
