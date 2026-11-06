"""Small in-process sliding-window limiter for sensitive endpoints (login/register).

Good enough for a single-instance deployment; swap for Redis when scaling out.
"""

import threading
import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import AppError

_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def reset() -> None:
    with _lock:
        _hits.clear()


def hit(key: str, limit: int, window_seconds: float, message: str) -> None:
    """Count one hit for `key`; raise 429 once `limit` hits fall inside the window."""
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > window_seconds:
            q.popleft()
        if len(q) >= limit:
            raise AppError(429, "rate_limited", message)
        q.append(now)


def auth_rate_limit(request: Request) -> None:
    """Per client address. Logins are also limited per account (see routes.auth), because a
    client address taken from proxy headers can be spoofed to dodge this limit."""
    client = request.client.host if request.client else "unknown"
    hit(f"{request.url.path}:{client}", get_settings().auth_rate_limit_per_minute, 60,
        "Too many attempts, try again in a minute")


def account_rate_limit(email: str) -> None:
    hit(f"login-account:{email.lower()}", get_settings().auth_rate_limit_per_minute, 60,
        "Too many attempts, try again in a minute")


def ai_rate_limit(user_id: object) -> None:
    """AI calls cost money and quota: cap them per user per hour."""
    hit(f"ai:{user_id}", get_settings().ai_requests_per_user_per_hour, 3600,
        "You have asked for many AI suggestions this hour; try again later")
