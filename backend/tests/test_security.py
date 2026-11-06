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
