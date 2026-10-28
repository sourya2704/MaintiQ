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


def auth_rate_limit(request: Request) -> None:
    limit = get_settings().auth_rate_limit_per_minute
    client = request.client.host if request.client else "unknown"
    key = f"{request.url.path}:{client}"
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= limit:
            raise AppError(429, "rate_limited", "Too many attempts, try again in a minute")
        q.append(now)
