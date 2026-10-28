from tests.conftest import make_machine, register


def test_register_login_me(client):
    headers = register(client, email="a@x.example.com")
    me = client.get("/api/auth/me", headers=headers).json()
    assert me["role"] == "admin" and me["organization"]["name"] == "Acme Works"

    ok = client.post("/api/auth/login", json={"email": "A@x.example.com", "password": "Password123!"})
    assert ok.status_code == 200
    bad = client.post("/api/auth/login", json={"email": "a@x.example.com", "password": "wrong-password"})
    assert bad.status_code == 401 and bad.json()["error"]["code"] == "invalid_credentials"
    dup = client.post("/api/auth/register", json={
        "organization_name": "Other", "name": "B", "email": "a@x.example.com", "password": "Password123!"})
    assert dup.status_code == 409


def test_protected_endpoints_require_auth(client):
    assert client.get("/api/machines").status_code == 401
    r = client.get("/api/machines", headers={"Authorization": "Bearer nonsense"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "unauthorized"


def test_admin_creates_technician_with_limited_rights(client, auth):
    r = client.post("/api/users", headers=auth, json={
        "name": "Tech", "email": "tech@acme.example.com", "password": "Password123!", "role": "technician"})
    assert r.status_code == 201
    tok = client.post("/api/auth/login", json={"email": "tech@acme.example.com", "password": "Password123!"}).json()
    tech = {"Authorization": f"Bearer {tok['access_token']}"}
    assert client.get("/api/users", headers=tech).status_code == 403
    assert client.post("/api/users", headers=tech, json={
        "name": "X", "email": "x@acme.example.com", "password": "Password123!"}).status_code == 403


def test_machine_crud_search_and_uniqueness(client, auth):
    m = make_machine(client, auth, code="m-104")
    assert m["asset_code"] == "M-104"
    assert client.post("/api/machines", headers=auth, json={
        "asset_code": "M-104", "name": "dup", "type": "motor"}).status_code == 409
    make_machine(client, auth, code="P-201", type_="Centrifugal  Pump", name="Coolant pump")

    page = client.get("/api/machines", headers=auth, params={"q": "coolant"}).json()
    assert page["total"] == 1 and page["items"][0]["type"] == "centrifugal pump"
    assert client.get("/api/machines/types", headers=auth).json() == ["centrifugal pump", "electric motor"]

    r = client.patch(f"/api/machines/{m['id']}", headers=auth, json={"status": "degraded", "location": "Bay A"})
    assert r.json()["status"] == "degraded"
    detail = client.get(f"/api/machines/{m['id']}", headers=auth).json()
    assert detail["timeline"] == [] and detail["incident_count"] == 0


def test_cross_organization_machine_access_denied(client, auth):
    m = make_machine(client, auth)
    other = register(client, org="Rival Co", email="rival@x.example.com")
    assert client.get(f"/api/machines/{m['id']}", headers=other).status_code == 404
    assert client.patch(f"/api/machines/{m['id']}", headers=other, json={"name": "pwned"}).status_code == 404
    assert client.get("/api/machines", headers=other).json()["total"] == 0
