"""Gnani Prisma speech-to-text adapter.

Live route (docs.gnani.ai): POST {GNANI_BASE_URL}/stt/v3, multipart form with
`audio_file`, `language_code`, optional `model`; auth header `X-API-Key-ID`.
Audio is sent from the backend only; the key never reaches the browser.

Prisma v3.0 extras used here: `keyterms` (machine vocabulary biasing) and
`previous_text` (context carried between chunks of a long recording).
Recordings longer than the 30 s REST limit are split with ffmpeg and
transcribed chunk by chunk.
"""

import json
import shutil
import subprocess
import tempfile
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


MAINTENANCE_KEYTERMS = (
    "bearing", "coupling", "gearbox", "impeller", "mechanical seal", "shaft", "belt tension", "alignment",
    "vibration", "lubrication", "grease", "lockout", "tagout", "interlock", "thermal", "amps", "RPM",
)


def build_keyterms(machine: dict | None) -> list[str]:
    terms = []
    if machine:
        terms += [machine.get(k) for k in ("asset_code", "name", "type", "manufacturer", "model")]
    terms += list(MAINTENANCE_KEYTERMS)
    seen, out = set(), []
    for t in terms:
        t = (t or "").strip()
        if t and t.lower() not in seen:
            seen.add(t.lower())
            out.append(t[:60])
    return out[:200]


def transcribe(
    audio_path: Path,
    mime_type: str,
    language_code: str | None = None,
    *,
    keyterms: list[str] | None = None,
    previous_text: str | None = None,
) -> TranscriptionResult:
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
    if settings.prisma_model == "prisma-v3.0":
        if keyterms and settings.prisma_use_keyterms:
            data["keyterms"] = json.dumps(keyterms)
        if previous_text:
            data["previous_text"] = previous_text[-600:]
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


def _split(audio_path: Path, chunk_seconds: float, workdir: Path) -> list[Path]:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(audio_path), "-ac", "1", "-ar", "16000",
         "-f", "segment", "-segment_time", str(chunk_seconds), str(workdir / "chunk_%03d.wav")],
        capture_output=True, timeout=120, check=True,
    )
    return sorted(workdir.glob("chunk_*.wav"))


def transcribe_recording(
    audio_path: Path,
    mime_type: str,
    language_code: str | None = None,
    *,
    duration_seconds: float | None = None,
    keyterms: list[str] | None = None,
) -> TranscriptionResult:
    """Transcribe a whole recording, chunking it when it exceeds Prisma's per-request limit."""
    settings = get_settings()
    if (
        settings.prisma_mode != "live"
        or duration_seconds is None
        or duration_seconds <= settings.prisma_max_clip_seconds
    ):
        return transcribe(audio_path, mime_type, language_code, keyterms=keyterms)
    if not shutil.which("ffmpeg"):
        raise ProviderError("audio_too_long", "Recording exceeds 30 s and the server cannot split it (ffmpeg missing)")

    with tempfile.TemporaryDirectory(prefix="mantiq-chunks-") as tmp:
        try:
            chunks = _split(audio_path, settings.prisma_chunk_seconds, Path(tmp))
        except subprocess.SubprocessError:
            raise ProviderError("audio_split_failed", "The recording could not be split for transcription")
        texts, request_ids, latency, truncated, language = [], [], 0, False, None
        for i, chunk in enumerate(chunks, start=1):
            try:
                part = transcribe(chunk, "audio/wav", language_code, keyterms=keyterms,
                                  previous_text=" ".join(texts) or None)
            except ProviderError as exc:
                if exc.code == "empty_transcript" and i == len(chunks) and texts:
                    continue  # trailing silence in the final chunk
                exc.safe_message = f"{exc.safe_message} (chunk {i} of {len(chunks)})"
                raise
            texts.append(part.text)
            request_ids.append(part.meta.request_id or "")
            latency += part.meta.latency_ms or 0
            truncated = truncated or bool(part.meta.extra.get("truncated"))
            language = language or part.language
            model = part.meta.model

    meta = CallMeta("prisma", model, "live", request_id=",".join(request_ids)[:200], latency_ms=latency,
                    extra={"truncated": truncated, "chunks": len(texts)})
    return TranscriptionResult(" ".join(texts), language, meta)
