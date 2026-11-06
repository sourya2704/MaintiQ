from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models import Incident, Machine, Organization, User
from scripts import showcase as sc
from scripts.seed import seed


def test_showcase_wipes_everything_and_logs_in(client, monkeypatch):
    seed()  # an older plant that must disappear
    for _, _, _, _, var in sc.USERS:
        monkeypatch.setenv(var, f"Pw-{var[-12:]}-2026")
    sc.showcase()

    with SessionLocal() as db:
        orgs = db.scalars(select(Organization)).all()
        assert [o.slug for o in orgs] == [sc.ORG_SLUG]
        assert db.scalar(select(func.count()).select_from(User)) == 4
        assert db.scalar(select(func.count()).select_from(Machine)) == len(sc.MACHINES)
        assert db.scalar(select(func.count()).select_from(Incident)) == len(sc.INCIDENTS)
        assert not db.scalar(select(func.count()).select_from(Incident).where(Incident.is_seed.is_(True)))

    for _, _, email, role, var in sc.USERS:
        r = client.post("/api/auth/login", json={"email": email, "password": f"Pw-{var[-12:]}-2026"})
        assert r.status_code == 200, r.text
        me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"}).json()
        assert me["role"] == role

    admin_var = sc.USERS[0][4]
    tok = client.post("/api/auth/login", json={"email": sc.USERS[0][2], "password": f"Pw-{admin_var[-12:]}-2026"}).json()
    h = {"Authorization": f"Bearer {tok['access_token']}"}
    incs = client.get("/api/incidents?limit=100", headers=h).json()
    assert incs["total"] == len(sc.INCIDENTS)


def test_showcase_runs_once_unless_forced(monkeypatch):
    sc.showcase()
    with SessionLocal() as db:
        db.query(Machine).filter(Machine.asset_code == "FL-904").update({"name": "Renamed in demo"})
        db.commit()
    sc.showcase()  # second boot: must not wipe demo work
    with SessionLocal() as db:
        assert db.scalar(select(Machine.name).where(Machine.asset_code == "FL-904")) == "Renamed in demo"
    sc.showcase(force=True)
    with SessionLocal() as db:
        assert db.scalar(select(Machine.name).where(Machine.asset_code == "FL-904")) == "Forklift 2.5 t"


def test_generated_passwords_when_unset(monkeypatch, capsys):
    for _, _, _, _, var in sc.USERS:
        monkeypatch.delenv(var, raising=False)
    sc.showcase()
    out = capsys.readouterr().out
    assert out.count("generated password") == 4
