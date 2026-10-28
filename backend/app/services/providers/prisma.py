"""Gnani Prisma speech-to-text adapter.

Live route (docs.gnani.ai): POST {GNANI_BASE_URL}/stt/v3, multipart form with
`audio_file`, `language_code`, optional `model`; auth header `X-API-Key-ID`.
Audio is sent from the backend only; the key never reaches the browser.
"""

import time
import uuid
from dataclasses import dataclass
from pathlib import Path

import httpx

from app.core.config import get_settings
from app.services.providers import base
from app.services.providers.base import CallMeta, ProviderDisabled, ProviderError

MOCK_TRANSCRIPT = (
    "[MOCK PRISMA TRANSCRIPT] Motor M-104 is vibrating more than usual and the housing feels hotter "
    "than normal. I inspected the drive belt and the tension looked fine, but the vibration is still there. "
    "There is also a low grinding noise near the non-drive end bearing."
)


@dataclass
class TranscriptionResult:
    text: str
    language: str | None
    meta: CallMeta


def transcribe(audio_path: Path, mime_type: str, language_code: str | None = None) -> TranscriptionResult:
    settings = get_settings()
    language = language_code or settings.prisma_language_code

    if settings.prisma_mode == "disabled":
        raise ProviderDisabled("prisma")
    if settings.prisma_mode == "mock":
        return TranscriptionResult(
            MOCK_TRANSCRIPT, language, CallMeta("prisma", "prisma-mock", "mock", request_id=f"mock-{uuid.uuid4()}", latency_ms=0)
        )
    if not settings.gnani_api_key:
        raise ProviderError("prisma_not_configured", "Prisma is in live mode but GNANI_API_KEY is not set")

    request_id = str(uuid.uuid4())
    data = {"language_code": language}
    if settings.prisma_model and settings.prisma_model != "prisma-v2.5":
        data["model"] = settings.prisma_model
    headers = {"X-API-Key-ID": settings.gnani_api_key, "X-API-Request-ID": request_id}
    url = settings.gnani_base_url.rstrip("/") + "/stt/v3"

    started = time.perf_counter()
    try:
        with base.http_client(settings.prisma_timeout_seconds) as client, audio_path.open("rb") as fh:
            response = client.post(url, headers=headers, data=data, files={"audio_file": (audio_path.name, fh, mime_type)})
    except httpx.TimeoutException:
        raise ProviderError("prisma_timeout", "Prisma did not respond in time", retryable=True, request_id=request_id)
    except httpx.HTTPError:
        raise ProviderError("prisma_unreachable", "Could not reach Prisma", retryable=True, request_id=request_id)
    latency_ms = int((time.perf_counter() - started) * 1000)

    if response.status_code != 200:
        err = base.map_http_error("prisma", response)
        err.request_id = request_id
        raise err
    try:
        body = response.json()
    except ValueError:
        raise ProviderError("prisma_bad_response", "Prisma returned a non-JSON response", request_id=request_id)
    if not body.get("success", False):
        err = body.get("error") or {}
        code = err.get("type") if isinstance(err, dict) else None
        raise ProviderError(code or "prisma_failed", f"Prisma could not transcribe the audio ({code or 'unknown'})", request_id=request_id)

    text = (body.get("transcript") or "").strip()
    if not text:
        raise ProviderError("empty_transcript", "Prisma returned an empty transcript; check the recording", request_id=request_id)

    meta = CallMeta(
        "prisma",
        body.get("model") or settings.prisma_model,
        "live",
        request_id=body.get("request_id") or request_id,
        latency_ms=latency_ms,
        extra={"truncated": bool(body.get("truncated")), "processing_time": body.get("processing_time")},
    )
    return TranscriptionResult(text, body.get("detected_language_code") or language, meta)
