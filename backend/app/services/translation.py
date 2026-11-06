"""Translate short interface texts (messages, fix steps) between English and Hindi with Gemini.

Results are cached by the callers on the record they belong to, so each text is
translated once per language. Without a live AI provider the original text is
returned and marked as untranslated.
"""

import json
import re

from app.core.config import get_settings
from app.services.extraction import parse_model_json
from app.services.providers import gemini
from app.services.providers.base import ProviderError

LANG_NAMES = {"en": "English", "hi": "Hindi (Devanagari script)"}
DEVANAGARI = re.compile(r"[ऀ-ॿ]")


def detect_language(text: str) -> str:
    """Good enough for English vs Hindi: any Devanagari means Hindi."""
    return "hi" if DEVANAGARI.search(text or "") else "en"


def available() -> bool:
    s = get_settings()
    return s.ai_mode == "live" and bool(s.gemini_api_key)


def translate(texts: list[str], target: str) -> list[str] | None:
    """Translate each text into `target`; None when translation is unavailable or fails."""
    if target not in LANG_NAMES or not texts:
        return None
    if not available():
        return None
    prompt = (
        f"Translate each string in this JSON array into {LANG_NAMES[target]} for a factory maintenance team. "
        "Keep machine codes (like M-104), part numbers, units and numbers unchanged. Use plain, everyday words a "
        "mechanic uses; keep common English technical terms where Hindi speakers use them (bearing, motor, seal). "
        'Return only JSON: {"items": [...]} with the same number of strings in the same order.\n\n'
        + json.dumps(texts, ensure_ascii=False)
    )
    try:
        text, _, _ = gemini.generate(prompt, json_output=True, temperature=0)
        items = parse_model_json(text).get("items")
    except (ProviderError, ValueError):
        return None
    if not isinstance(items, list) or len(items) != len(texts) or not all(isinstance(i, str) for i in items):
        return None
    return items
