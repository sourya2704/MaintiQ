# Mantiq

Voice-first industrial maintenance memory, built on Gnani AI models.
A technician records a voice note about a machine fault. **Gnani Prisma** transcribes it, and **Gnani Evon** drafts a structured incident for human review.
The **Failure Memory Engine** then retrieves related past incidents and their verified outcomes, with a plain-language reason for each match.

> Decision support only. Mantiq never diagnoses, controls equipment or authorizes repairs.

Docs: [PRD](docs/PRD.md) · [High-Level Design](docs/HLD.md)

## Status
- [x] Backend API (FastAPI + PostgreSQL): `backend/`, live-tested with Gnani Prisma and Timbre
- [ ] Frontend (React)

## Backend quick start (Docker)
```bash
cp backend/.env.example backend/.env    # add GNANI_API_KEY, set modes to live
docker compose up --build
docker compose exec api python -m scripts.seed
```

## Backend quick start (local)
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

## Demo voice notes
`backend/demo_audio/` holds synthetic voice notes for the PRD test scenarios. They were generated with Gnani Timbre by `uv run python -m scripts.make_demo_audio`:
- motor vibration with the belt already checked
- pump seal leak
- overheating with no temperature reading
- smoke hazard
- a 34-second note
- a Hindi note

## Speech features
- **Long voice notes:** up to 120 s. Recordings over Prisma's 30 s limit are split with ffmpeg, and each chunk carries the previous chunk's text as `previous_text`.
- **Keyterms:** the machine's asset code, name and model, plus maintenance vocabulary, are sent as Prisma v3.0 `keyterms`.
- **Languages:** English, Hindi and code-mixed speech. Symptom detection understands Hindi and Hinglish, and handles negation ("no smoke", "गर्म नहीं है").
- **Browser recordings:** WebM recordings are converted to WAV on the server.

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
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/change-password` |
| Users | `GET/POST /api/users`, `PATCH /api/users/{id}` |
| Machines | `GET/POST /api/machines`, `GET/PATCH/DELETE /api/machines/{id}`, `GET /api/machines/types` |
| Incidents | `POST /api/incidents` (audio or manual transcript), `GET /api/incidents` (search/filter), `GET/PATCH/DELETE /api/incidents/{id}` |
| Pipeline | `POST /{id}/transcribe`, `POST /{id}/analyze`, `POST /{id}/confirm`, `GET /{id}/jobs` |
| Memory | `GET /api/incidents/{id}/related`, `GET /api/memory/search` |
| Outcomes | `POST /{id}/outcome`, `GET /{id}/outcomes` |
| Other | `GET /{id}/audit`, `GET/DELETE /{id}/audio/{audio_id}`, `GET /{id}/export`, `POST /{id}/speak` |
| Admin | `GET /api/dashboard/summary`, `GET /api/settings/integrations`, `GET /api/settings/integrations/evon/check`, `POST /api/admin/retention/run`, `GET /api/health` |
