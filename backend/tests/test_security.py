from fastapi.testclient import TestClient

from tests.conftest import make_machine, register


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
    client.post("/api/users", headers=auth, json={"name": "Ravi", "email": "ravi@acme.example.com",
                                                  "password": "Password123!", "role": "technician"})
    tok = client.post("/api/auth/login", json={"email": "ravi@acme.example.com", "password": "Password123!"}).json()["access_token"]
    tech = {"Authorization": f"Bearer {tok}"}
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
