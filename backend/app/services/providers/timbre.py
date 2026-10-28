"""Gnani Timbre text-to-speech adapter (optional, P2).

Live route: POST {GNANI_BASE_URL}/api/v1/tts/inference, JSON body, returns audio/wav.
"""

import io
import math
import struct
import time
import wave

import httpx

from app.core.config import get_settings
from app.services.providers import base
from app.services.providers.base import CallMeta, ProviderDisabled, ProviderError


def _mock_wav(seconds: float = 0.6, rate: int = 16000) -> bytes:
    """A short tone so the UI can exercise playback without a live provider."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        frames = b"".join(
            struct.pack("<h", int(6000 * math.sin(2 * math.pi * 440 * i / rate))) for i in range(int(seconds * rate))
        )
        w.writeframes(frames)
    return buf.getvalue()


def synthesize(text: str) -> tuple[bytes, CallMeta]:
    settings = get_settings()
    if settings.timbre_mode == "disabled":
        raise ProviderDisabled("timbre")
    if settings.timbre_mode == "mock":
        return _mock_wav(), CallMeta("timbre", "timbre-mock", "mock", latency_ms=0)
    if not settings.gnani_api_key:
        raise ProviderError("timbre_not_configured", "Timbre is in live mode but GNANI_API_KEY is not set")

    payload = {
        "text": text[: settings.timbre_max_chars],
        "voice": settings.timbre_voice,
        "model": settings.timbre_model,
        "language": settings.timbre_language,
        "speed": 1.0,
        "audio_config": {
            "sample_rate": 24000,
            "num_channels": 1,
            "sample_width": 2,
            "encoding": "linear_pcm",
            "container": "wav",
        },
    }
    url = settings.gnani_base_url.rstrip("/") + "/api/v1/tts/inference"
    started = time.perf_counter()
    try:
        with base.http_client(60) as client:
            response = client.post(url, headers={"X-API-Key-ID": settings.gnani_api_key}, json=payload)
    except httpx.HTTPError:
        raise ProviderError("timbre_unreachable", "Could not reach Timbre", retryable=True)
    if response.status_code != 200:
        raise base.map_http_error("timbre", response)
    if not response.headers.get("content-type", "").startswith("audio/"):
        raise ProviderError("timbre_bad_response", "Timbre did not return audio")
    return response.content, CallMeta(
        "timbre", settings.timbre_model, "live", latency_ms=int((time.perf_counter() - started) * 1000)
    )
