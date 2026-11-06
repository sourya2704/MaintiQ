"""Small in-process sliding-window limiter for sensitive endpoints (login/register/contact).

Good enough for a single-instance deployment; swap for Redis when scaling out.

`hit` both checks and records in one step. For finer control there is `too_many`
(check only) and `note` (record only): login uses them to count *failed* attempts,
so a user who types the right password is never blocked by their own earlier typos.
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


def _trim(q: deque[float], now: float, window_seconds: float) -> None:
    while q and now - q[0] > window_seconds:
        q.popleft()


def too_many(key: str, limit: int, window_seconds: float) -> bool:
    """True if `key` already has `limit` hits inside the window. Does not record a hit."""
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        _trim(q, now, window_seconds)
        return len(q) >= limit


def note(key: str, window_seconds: float) -> None:
    """Record one hit for `key` without raising."""
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        _trim(q, now, window_seconds)
        q.append(now)


def hit(key: str, limit: int, window_seconds: float, message: str) -> None:
    """Count one hit for `key`; raise 429 once `limit` hits fall inside the window."""
    if too_many(key, limit, window_seconds):
        raise AppError(429, "rate_limited", message)
    note(key, window_seconds)


def _client(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def auth_rate_limit(request: Request) -> None:
    """Per client address. Because the app runs behind a proxy, this address comes from a
    forwarded header the client can spoof, so it is only a first line: register and login add
    limits that do not depend on it (a global cap, and per-account failure counting)."""
    hit(f"{request.url.path}:{_client(request)}", get_settings().auth_rate_limit_per_minute, 60,
        "Too many attempts, try again in a minute")


def global_limit(bucket: str, limit: int, window_seconds: float, message: str) -> None:
    """A cap on an action across all clients, so a spoofed client address cannot lift it.
    Set generously: it exists to bound runaway abuse, not to limit ordinary use."""
    hit(f"global:{bucket}", limit, window_seconds, message)


def login_account_guard(email: str) -> None:
    """Raise if this account has had too many *failed* sign-ins recently. Checked before the
    password is verified, so a correct password still succeeds while the account is below the
    limit; successful sign-ins are never counted, so a user cannot lock themselves out."""
    if too_many(f"login-fail:{email.lower()}", get_settings().login_failures_before_block, 300):
        raise AppError(429, "rate_limited", "Too many failed attempts for this account; try again in a few minutes")


def record_login_failure(email: str) -> None:
    note(f"login-fail:{email.lower()}", 300)


def ai_rate_limit(user_id: object) -> None:
    """AI calls cost money and quota: cap them per user per hour."""
    hit(f"ai:{user_id}", get_settings().ai_requests_per_user_per_hour, 3600,
        "You have asked for many AI suggestions this hour; try again later")
