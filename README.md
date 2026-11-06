# Mantiq

Voice-first industrial maintenance memory, built on Gnani AI models.
A technician records a voice note about a machine fault. **Gnani Prisma** transcribes it, and **Gnani Evon** drafts a structured incident for human review.
The **Failure Memory Engine** then retrieves related past incidents and their verified outcomes, with a plain-language reason for each match.

> Decision support only. Mantiq never diagnoses, controls equipment or authorizes repairs.

Docs: [PRD](docs/PRD.md) · [High-Level Design](docs/HLD.md)

## Status
- [x] Backend API (FastAPI + PostgreSQL): `backend/`, live-tested with Gnani Prisma and Timbre
- [x] Frontend (React + Three.js): `frontend/`

## Frontend
A warm, workshop-style UI (beige and espresso palette) built with React, Vite, Tailwind, React Three Fiber and Framer Motion.
- **3D plant floor:** every machine is shown as a realistic model on a concrete floor:
  - TEFC motor, end-suction pump, belt conveyor, tank-mounted compressor, or gearbox;
  - painted cast iron, machined steel and brass under studio lighting.
- **Status and faults:** floor-marking tape shows status. Open faults animate the model: vibration shakes it, overheating warms it, a leak drips and pools, and smoke rises. Scrolling lowers the camera to floor level, and clicking a machine opens it.
- **Machine viewer:** drag to orbit, scroll to turn. Gauges, shafts, belts and flywheels move only while the machine is running.
- **Controls:** 3D push buttons, a brass gear train on the login and overview pages, a mic recorder with a live level display, and a custom machinery icon set.
- **Workflow:** record or upload a voice note, then review the transcript, run the Evon draft, confirm it and record the outcome. Failure Memory, the incident log with filters, and settings for providers, the team and retention complete the app.

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173 (proxies /api to :8000)
```

## Deploy to Render
The repo contains a `render.yaml` Blueprint and a root `Dockerfile`. They build a single service: the API also serves the web app. It comes with a managed Postgres database.

The blueprint uses Render's **free plan**: no card is needed, the service sleeps when idle, and uploaded audio lasts until the next restart. For durable audio storage, switch to the Starter plan and add a disk (see the comment in `render.yaml`).
1. Go to render.com and choose **New → Blueprint**, then pick this repository.
2. Fill in the prompted values:
   - `GNANI_API_KEY`;
   - `SEED_PASSWORD` (a password of your choice for the fictional demo accounts);
   - optionally `EVON_BASE_URL` and `EVON_API_KEY`.
3. Deploy. On every start, migrations run automatically. The demo plant is created on first start, and only if `SEED_PASSWORD` is set.

## Run everything locally with Docker
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

Sample plant logins: `asha.verma@narmadasteel.example.com` (admin), `sunil.rao@…` (supervisor) and `ravi.kumar@…` (mechanic). The password is `SEED_PASSWORD`, or the default set in `scripts/seed.py`.

## Demo voice notes
`backend/demo_audio/` holds synthetic voice notes for the PRD test scenarios. They were generated with Gnani Timbre by `uv run python -m scripts.make_demo_audio`:
- motor vibration with the belt already checked
- pump seal leak
- overheating with no temperature reading
- smoke hazard
- a 34-second note
- a Hindi note

## AI troubleshooting guide (Gnani Evon)
For any incident, Evon proposes an **advisory** guide. It is grounded in the report and in this plant's own verified past fixes:
- **Likely causes:** ranked as higher, possible or less likely (never as percentages), with evidence for each. Causes that match a previously **verified** fix link to that incident.
- **Checks in order:** a safe order that always starts with lockout. Each check says why it matters and what you would expect to find.
- **Parts to have on hand**, **when to stop and escalate**, and **what not to do**.

Before anything is shown, the backend checks every history citation, removes unsafe advice and forces hazard escalation. The guide is never a diagnosis: the technician records the verified cause in the outcome.

## Importing machines
Supervisors and admins can upload an asset list as CSV under **Machines → Import CSV**:
- **Columns:** asset code, name and type are required; manufacturer, model, location and status are optional. Common header names such as `Asset No`, `Equipment`, `Category` and `Make` are recognised.
- **Excel files:** semicolon-separated files and files with a byte-order mark are handled.
- **Preview first:** a dry run reports new, updated, skipped and error rows before anything is saved.
- **Existing asset codes:** either skipped or updated, your choice.

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
| Machines | `GET/POST /api/machines`, `GET/PATCH/DELETE /api/machines/{id}`, `GET /api/machines/types`, `POST /api/machines/import` (CSV, dry run first), `GET /api/machines/import/template` |
| Incidents | `POST /api/incidents` (audio or manual transcript), `GET /api/incidents` (search/filter), `GET/PATCH/DELETE /api/incidents/{id}` |
| Pipeline | `POST /{id}/transcribe`, `POST /{id}/analyze`, `POST /{id}/troubleshoot`, `POST /{id}/confirm`, `GET /{id}/jobs` |
| Memory | `GET /api/incidents/{id}/related`, `GET /api/memory/search` |
| Outcomes | `POST /{id}/outcome`, `GET /{id}/outcomes` |
| Other | `GET /{id}/audit`, `GET/DELETE /{id}/audio/{audio_id}`, `GET /{id}/export`, `POST /{id}/speak` |
| Admin | `GET /api/dashboard/summary`, `GET /api/settings/integrations`, `GET /api/settings/integrations/evon/check`, `POST /api/admin/retention/run`, `GET /api/health` |
