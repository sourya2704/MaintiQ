# Mantiq

Voice-first industrial maintenance memory, built on Gnani AI models.
A technician records a voice note about a machine fault. **Gnani Prisma** transcribes it, and **Gnani Evon** drafts a structured incident for human review.
The **Failure Memory Engine** then retrieves related past incidents and their verified outcomes, with a plain-language reason for each match.

> Decision support only. Mantiq never diagnoses, controls equipment or authorizes repairs.

## Status
- [x] Backend API (FastAPI + PostgreSQL): `backend/`
- [ ] Frontend (React)

## Backend quick start
```bash
cd backend
cp .env.example .env          # set DATABASE_URL, JWT_SECRET, Gnani keys
uv sync
uv run alembic upgrade head
uv run python -m scripts.seed # fictional demo data
uv run uvicorn app.main:app --reload
```
API docs: http://localhost:8000/docs

Demo logins (fictional): `admin@`, `supervisor@` and `tech@demo-mantiq.example.com`. The password is `SEED_PASSWORD`, or the default set in `scripts/seed.py`.

## Tests
```bash
TEST_DATABASE_URL=postgresql+psycopg://user@localhost:5432/mantiq_test uv run pytest
```

## Provider modes
Each provider (`PRISMA_MODE`, `EVON_MODE`, `TIMBRE_MODE`) is set to `live`, `mock` or `disabled`.
Mock output is always labelled (`prisma_mock`, `evon_mock`) in the record, the job log and `/api/settings/integrations`, so it is never presented as a live call.

| Model | Use | Endpoint |
|---|---|---|
| Prisma | Speech-to-text | `POST https://api.vachana.ai/stt/v3` (`X-API-Key-ID`, max 30 s) |
| Evon | Structured extraction | OpenAI-compatible `/v1/chat/completions` |
| Timbre | Optional read-out | `POST https://api.vachana.ai/api/v1/tts/inference` |

## API overview
| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Users | `GET/POST /api/users`, `PATCH /api/users/{id}` |
| Machines | `GET/POST /api/machines`, `GET/PATCH/DELETE /api/machines/{id}`, `GET /api/machines/types` |
| Incidents | `POST /api/incidents` (audio or manual transcript), `GET /api/incidents` (search/filter), `GET/PATCH/DELETE /api/incidents/{id}` |
| Pipeline | `POST /{id}/transcribe`, `POST /{id}/analyze`, `POST /{id}/confirm`, `GET /{id}/jobs` |
| Memory | `GET /api/incidents/{id}/related`, `GET /api/memory/search` |
| Outcomes | `POST /{id}/outcome`, `GET /{id}/outcomes` |
| Other | `GET /{id}/audit`, `GET/DELETE /{id}/audio/{audio_id}`, `GET /{id}/export`, `POST /{id}/speak` |
| Admin | `GET /api/dashboard/summary`, `GET /api/settings/integrations`, `POST /api/admin/retention/run`, `GET /api/health` |
