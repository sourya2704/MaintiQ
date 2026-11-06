#!/bin/sh
# Container entrypoint: migrate, optionally set up the showcase or sample plant, then serve.
set -e
alembic upgrade head
if [ "$SHOWCASE_RESET" = "true" ]; then
  # Wipes the database once and creates the showcase plant; later boots leave it alone.
  python -m scripts.showcase || echo "Showcase setup failed; continuing without it"
elif [ "$SEED_DEMO" = "true" ]; then
  python -m scripts.seed || echo "Demo seed failed; continuing without it"
fi
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips="*"
