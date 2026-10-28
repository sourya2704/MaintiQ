from dataclasses import dataclass, field

import httpx


class ProviderError(Exception):
    """A provider call failed. `safe_message` is shown to users and stored; it never contains secrets."""

    def __init__(self, code: str, safe_message: str, *, retryable: bool = False, request_id: str | None = None):
        super().__init__(safe_message)
        self.code = code
        self.safe_message = safe_message
        self.retryable = retryable
        self.request_id = request_id


class ProviderDisabled(ProviderError):
    def __init__(self, provider: str):
        super().__init__(f"{provider}_disabled", f"{provider.capitalize()} integration is disabled")


@dataclass
class CallMeta:
    provider: str
    model: str
    mode: str  # "live" | "mock"
    request_id: str | None = None
    latency_ms: int | None = None
    extra: dict = field(default_factory=dict)


def http_client(timeout: float) -> httpx.Client:
    """Single construction point so tests can substitute a mock transport."""
    return httpx.Client(timeout=timeout)


def map_http_error(provider: str, response: httpx.Response) -> ProviderError:
    """Translate a provider HTTP failure into a safe, user-facing error."""
    status = response.status_code
    code = None
    try:
        body = response.json()
        err = body.get("error") if isinstance(body, dict) else None
        detail = body.get("detail") if isinstance(body, dict) else None
        if isinstance(err, dict):
            code = err.get("type") or err.get("code")
        elif isinstance(detail, dict):
            code = detail.get("error_code")
        elif isinstance(body, dict):
            code = body.get("code")
    except ValueError:
        pass
    messages = {
        401: "Provider rejected the API key; check server configuration",
        402: "Provider account has insufficient credit",
        403: "API key is not allowed to use this provider scope",
        429: "Provider rate limit reached; retry shortly",
    }
    message = messages.get(status) or (
        f"{provider.capitalize()} rejected the request" if 400 <= status < 500 else f"{provider.capitalize()} is unavailable"
    )
    retryable = status == 429 or status >= 500
    return ProviderError(str(code or f"http_{status}"), message + (f" ({code})" if code else ""), retryable=retryable)
