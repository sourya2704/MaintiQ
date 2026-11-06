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
    from tests.conftest import add_worker

    _, _, tech = add_worker(client, auth, name="Tech")
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


def test_machine_optional_details_can_be_cleared(client, auth):
    from tests.conftest import make_machine

    m = make_machine(client, auth)
    client.patch(f"/api/machines/{m['id']}", headers=auth, json={"manufacturer": "ABB", "location": "Bay A"})
    r = client.patch(f"/api/machines/{m['id']}", headers=auth,
                     json={"manufacturer": None, "location": None, "name": None})
    assert r.status_code == 200
    body = r.json()
    assert body["manufacturer"] is None and body["location"] is None and body["name"] == m["name"]


def test_language_preference_is_saved_and_returned_on_login(client):
    headers = register(client, email="lang@x.example.com")
    assert client.get("/api/auth/me", headers=headers).json()["preferred_language"] is None

    r = client.put("/api/auth/me/language", headers=headers, json={"language": "hi"})
    assert r.status_code == 200 and r.json()["preferred_language"] == "hi"
    login = client.post("/api/auth/login", json={"email": "lang@x.example.com", "password": "Password123!"}).json()
    assert login["user"]["preferred_language"] == "hi"

    assert client.put("/api/auth/me/language", headers=headers, json={"language": "fr"}).status_code == 422



def test_admin_issues_company_login_and_worker_must_change_password(client, auth):
    r = client.post("/api/users", headers=auth, json={"name": "Ravi Kumar", "role": "technician"})
    issued = r.json()
    assert r.status_code == 201 and issued["login_email"] == "ravi.kumar@acme-works.mantiq"
    assert len(issued["temporary_password"]) == 14 and issued["user"]["must_change_password"]
    # a second Ravi Kumar gets a numbered login
    assert client.post("/api/users", headers=auth, json={"name": "Ravi Kumar"}).json()["login_email"] == "ravi.kumar2@acme-works.mantiq"

    tok = client.post("/api/auth/login", json={"email": issued["login_email"], "password": issued["temporary_password"]}).json()
    worker = {"Authorization": f"Bearer {tok['access_token']}"}
    assert tok["user"]["must_change_password"] is True
    blocked = client.get("/api/incidents", headers=worker)
    assert blocked.status_code == 403 and blocked.json()["error"]["code"] == "password_change_required"
    changed = client.post("/api/auth/change-password", headers=worker,
                          json={"current_password": issued["temporary_password"], "new_password": "MyOwnPass123"}).json()
    worker = {"Authorization": f"Bearer {changed['access_token']}"}
    assert client.get("/api/incidents", headers=worker).status_code == 200

    team = {u["email"]: u for u in client.get("/api/users", headers=auth).json()}
    assert team["ravi.kumar@acme-works.mantiq"]["last_login_at"] and team["ravi.kumar@acme-works.mantiq"]["reports"] == 0

    reset = client.post(f"/api/users/{issued['user']['id']}/reset-password", headers=auth).json()
    assert reset["temporary_password"] != issued["temporary_password"]
    assert client.get("/api/auth/me", headers=worker).status_code == 401  # old session ended
