"""Google Gemini adapter (generateContent REST API).

Used for fix suggestions and translation. With `use_search`, Gemini may ground
its answer in Google Search; the pages it relied on are returned as sources.
The key stays on the server and is sent as a header, never in the URL.
"""

import time
import uuid

import httpx

from app.core.config import get_settings
from app.services.providers import base
from app.services.providers.base import CallMeta, ProviderDisabled, ProviderError

API_ROOT = "https://generativelanguage.googleapis.com/v1beta"
RETRY_STATUSES = {429, 500, 503}


def generate(
    prompt: str,
    *,
    system: str | None = None,
    use_search: bool = False,
    json_output: bool = False,
    temperature: float = 0.2,
) -> tuple[str, list[dict], CallMeta]:
    """Return (text, sources, meta). Sources are [{"title", "url"}] from search grounding."""
    settings = get_settings()
    if settings.ai_mode == "disabled":
        raise ProviderDisabled("gemini")
    if not settings.gemini_api_key:
        raise ProviderError("gemini_not_configured", "AI suggestions are on but GEMINI_API_KEY is not set")

    body: dict = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        # Gemini 2.5 "thinks" before answering and that counts against the output limit: cap it.
        "generationConfig": {"temperature": temperature, "maxOutputTokens": 8192,
                             "thinkingConfig": {"thinkingBudget": 1024}},
    }
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    if use_search:
        body["tools"] = [{"google_search": {}}]
    elif json_output:
        # Gemini does not allow a JSON response type together with search grounding.
        body["generationConfig"]["responseMimeType"] = "application/json"

    url = f"{API_ROOT}/models/{settings.gemini_model}:generateContent"
    headers = {"x-goog-api-key": settings.gemini_api_key, "Content-Type": "application/json"}
    started = time.perf_counter()
    response = None
    for attempt in range(settings.ai_max_attempts):
        try:
            with base.http_client(settings.ai_timeout_seconds) as client:
                response = client.post(url, headers=headers, json=body)
        except httpx.TimeoutException:
            raise ProviderError("gemini_timeout", "The AI service did not respond in time", retryable=True)
        except httpx.HTTPError:
            raise ProviderError("gemini_unreachable", "Could not reach the AI service", retryable=True)
        if response.status_code not in RETRY_STATUSES or attempt == settings.ai_max_attempts - 1:
            break
        time.sleep(2 * (attempt + 1))
    latency_ms = int((time.perf_counter() - started) * 1000)

    assert response is not None
    if response.status_code == 429:
        raise ProviderError("gemini_rate_limited", "The AI service is busy or out of quota; try again in a minute",
                            retryable=True)
    if response.status_code != 200:
        raise base.map_http_error("gemini", response)
    try:
        data = response.json()
        candidate = data["candidates"][0]
    except (ValueError, KeyError, IndexError, TypeError):
        raise ProviderError("gemini_bad_response", "The AI service returned an unexpected response")
    finish = candidate.get("finishReason", "")
    text = "".join(p.get("text", "") for p in (candidate.get("content") or {}).get("parts", []))
    if finish == "MAX_TOKENS" and not text.strip():
        raise ProviderError("gemini_too_long", "The AI answer was too long; try again", retryable=True)
    if finish in ("SAFETY", "RECITATION", "PROHIBITED_CONTENT", "BLOCKLIST"):
        raise ProviderError("gemini_blocked", "The AI service declined to answer this report")
    if not text.strip():
        raise ProviderError("gemini_empty", "The AI service returned an empty answer")

    sources, seen = [], set()
    for chunk in candidate.get("groundingMetadata", {}).get("groundingChunks", []):
        web = chunk.get("web") or {}
        if web.get("uri", "").startswith("https://") and web["uri"] not in seen:
            seen.add(web["uri"])
            sources.append({"title": (web.get("title") or web["uri"])[:200], "url": web["uri"]})

    meta = CallMeta("gemini", data.get("modelVersion") or settings.gemini_model, "live",
                    request_id=data.get("responseId") or str(uuid.uuid4()), latency_ms=latency_ms,
                    extra={"usage": data.get("usageMetadata"), "grounded": bool(sources)})
    return text, sources[:8], meta
