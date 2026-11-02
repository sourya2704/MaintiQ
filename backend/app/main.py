import asyncio
import contextlib
import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.routes import auth, dashboard, incidents, machines, memory, settings, users
from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.db.session import engine
from app.services.retention import retention_loop

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("mantiq.http")


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(retention_loop()) if get_settings().retention_interval_minutes > 0 else None
    yield
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


def create_app() -> FastAPI:
    s = get_settings()
    if s.environment == "production" and (s.jwt_secret == "change-me-in-production" or len(s.jwt_secret) < 32):
        raise RuntimeError("Set a strong JWT_SECRET (32+ characters) before running in production")
    app = FastAPI(
        title="Mantiq API",
        version="0.2.0",
        lifespan=lifespan,
        description=(
            "Voice-first industrial maintenance memory. Gnani Prisma transcribes technician voice notes, "
            "Gnani Evon drafts structured incidents for human review, and the Failure Memory Engine "
            "retrieves related historical incidents with transparent rationale."
        ),
    )
    app.add_middleware(
        CORSMiddleware, allow_origins=s.cors_origins, allow_credentials=True,
        allow_methods=["*"], allow_headers=["*"], expose_headers=["Content-Disposition", "X-Request-ID"],
    )
    install_error_handlers(app)

    @app.middleware("http")
    async def request_log(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
        started = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        # Path and status only: never bodies, tokens or transcripts.
        log.info("%s %s %s %dms rid=%s", request.method, request.url.path, response.status_code,
                 int((time.perf_counter() - started) * 1000), request_id)
        return response

    for r in (auth, users, machines, incidents, memory, dashboard, settings):
        app.include_router(r.router)

    @app.get("/api/health", tags=["health"])
    def health():
        db_ok = True
        try:
            with engine.connect() as conn:
                conn.execute(text("select 1"))
        except Exception:
            db_ok = False
        return {"status": "ok" if db_ok else "degraded", "database": db_ok,
                "providers": {"prisma": s.prisma_mode, "evon": s.evon_mode, "timbre": s.timbre_mode}}

    return app


app = create_app()
