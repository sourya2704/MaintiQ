#!/bin/sh
# Container entrypoint: migrate, optionally seed the fictional demo plant, then serve.
set -e
alembic upgrade head
if [ "$SEED_DEMO" = "true" ]; then
  python -m scripts.seed || echo "Demo seed failed; continuing without it"
fi
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips="*"
