"""Gnani Evon reasoning adapter.

Evon (hf.co/gnani/gnani-evon-v3.3-30b-a3b) is served through an OpenAI-compatible
`/v1/chat/completions` route (SGLang / hosted inference). This module only does
transport; prompting, validation and normalisation live in services.extraction.
"""

import time
import uuid

import httpx

from app.core.config import get_settings
from app.services.providers import base
from app.services.providers.base import CallMeta, ProviderDisabled, ProviderError


def chat_json(messages: list[dict], json_schema: dict) -> tuple[str, CallMeta]:
    """Send a chat request asking for JSON output; returns raw content text."""
    settings = get_settings()
    if settings.evon_mode == "disabled":
        raise ProviderDisabled("evon")
    if settings.evon_mode != "live":
        raise RuntimeError("chat_json is only used in live mode")

    url = settings.evon_base_url.rstrip("/") + "/chat/completions"
    headers = {"Content-Type": "application/json"}
    if settings.evon_api_key:
        headers["Authorization"] = f"Bearer {settings.evon_api_key}"
    payload = {
        "model": settings.evon_model,
        "messages": messages,
        "temperature": 0.2,
        "top_p": 0.95,
        "max_tokens": 1500,
        # Constrained decoding where the server supports it; validated again server-side regardless.
        "response_format": {"type": "json_schema", "json_schema": {"name": "incident_draft", "schema": json_schema}},
        # Reasoning off for deterministic extraction (per model card guidance).
        "chat_template_kwargs": {"enable_thinking": False},
    }

    started = time.perf_counter()
    try:
        with base.http_client(settings.evon_timeout_seconds) as client:
            response = client.post(url, headers=headers, json=payload)
    except httpx.TimeoutException:
        raise ProviderError("evon_timeout", "Evon did not respond in time", retryable=True)
    except httpx.HTTPError:
        raise ProviderError("evon_unreachable", "Could not reach Evon", retryable=True)
    latency_ms = int((time.perf_counter() - started) * 1000)

    if response.status_code != 200:
        raise base.map_http_error("evon", response)
    try:
        body = response.json()
        content = body["choices"][0]["message"]["content"] or ""
    except (ValueError, KeyError, IndexError, TypeError):
        raise ProviderError("evon_bad_response", "Evon returned an unexpected response shape")

    meta = CallMeta(
        "evon",
        body.get("model") or settings.evon_model,
        "live",
        request_id=body.get("id") or str(uuid.uuid4()),
        latency_ms=latency_ms,
        extra={"usage": body.get("usage")},
    )
    return content, meta
