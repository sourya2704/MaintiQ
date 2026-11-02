import io
import math
import os
import struct
import tempfile
import wave

import pytest

os.environ.setdefault("TEST_DATABASE_URL", "postgresql+psycopg://mantiq@localhost:5433/mantiq_test")
os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
os.environ["STORAGE_DIR"] = tempfile.mkdtemp(prefix="mantiq-test-")
os.environ["PRISMA_MODE"] = "mock"
os.environ["EVON_MODE"] = "mock"
os.environ["TIMBRE_MODE"] = "mock"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-bytes-long"
os.environ["AUTH_RATE_LIMIT_PER_MINUTE"] = "1000"
os.environ["RETENTION_INTERVAL_MINUTES"] = "0"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core import rate_limit  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture(autouse=True)
def clean_db():
    with engine.begin() as conn:
        tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
        conn.execute(text(f"TRUNCATE {tables} CASCADE"))
    rate_limit.reset()
    yield


@pytest.fixture
def settings(monkeypatch):
    s = get_settings()
    snapshot = s.model_dump()
    yield s
    for k, v in snapshot.items():
        setattr(s, k, v)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def register(client, org="Acme Works", email="lead@acme.example.com", name="Lead"):
    r = client.post("/api/auth/register", json={
        "organization_name": org, "name": name, "email": email, "password": "Password123!"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def auth(client):
    return register(client)


def make_machine(client, headers, code="M-104", type_="electric motor", name="Drive motor"):
    r = client.post("/api/machines", headers=headers, json={"asset_code": code, "name": name, "type": type_})
    assert r.status_code == 201, r.text
    return r.json()


def wav_bytes(seconds: float = 1.0, rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", int(3000 * math.sin(i / 8))) for i in range(int(seconds * rate))))
    return buf.getvalue()
