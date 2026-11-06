"""Deterministic symptom taxonomy.

Free-text symptoms are mapped to canonical tags so retrieval can explain
matches ("shared symptom: vibration") without relying on model scores.
"""

import re
from functools import lru_cache

SYMPTOM_TAXONOMY: dict[str, tuple[str, ...]] = {
    "vibration": ("vibrat", "shak", "wobbl", "oscillat", "imbalance", "unbalance"),
    "overheating": ("overheat", "hot", "heat", "temperature", "thermal trip", "thermal overload", "warm"),
    "abnormal_noise": ("noise", "noisy", "grind", "squeal", "squeak", "knock", "rattl", "hum", "whine", "clunk", "screech"),
    "leak": ("leak", "drip", "seep", "spill"),
    "smoke_or_burning": ("smoke", "burning", "burnt", "scorch", "fumes"),
    "electrical_fault": ("trip", "spark", "short circuit", "fuse", "breaker", "earth fault", "overcurrent", "current draw"),
    "pressure_abnormal": ("pressure",),
    "stoppage": ("stopp", "stall", "jam", "won't start", "not start", "shut down", "shutdown", "seized"),
    "wear_or_damage": ("wear", "worn", "crack", "broken", "misalign", "loose", "corros", "fray"),
    "speed_abnormal": ("slow", "rpm", "speed", "slipp"),
    "lubrication": ("lubric", "grease", "oil level", "dry bearing"),
    "alarm_or_fault_code": ("alarm", "fault code", "error code", "warning light"),
}

# Hindi (Devanagari) and Hinglish cues, since Prisma returns code-mixed text for Hindi speakers.
# Hindi places negation after the word ("धुआं नहीं है"), so these are checked differently.
HINDI_TAXONOMY: dict[str, tuple[str, ...]] = {
    "vibration": ("कंपन", "हिल रह", "थरथरा", "वाइब्रेशन"),
    "overheating": ("गर्म", "गरम", "गर्मी", "ओवरहीट", "तापमान", "garam", "garm"),
    "abnormal_noise": ("आवाज़", "आवाज", "शोर", "घरघरा", "awaaz", "awaz", "shor"),
    "leak": ("टपक", "रिसाव", "रिस रह", "लीक", "tapak"),
    "smoke_or_burning": ("धुआं", "धुआँ", "धुंआ", "जलने की", "जल रह", "dhuan", "dhuaan"),
    "electrical_fault": ("चिंगारी", "स्पार्क", "ट्रिप"),
    "pressure_abnormal": ("प्रेशर", "दबाव"),
    "stoppage": ("बंद हो गय", "रुक गय", "अटक", "जाम हो"),
    "wear_or_damage": ("घिस", "टूट", "ढीला", "दरार"),
    "speed_abnormal": ("धीमा", "धीरे चल", "स्पीड"),
    "lubrication": ("ग्रीस",),
    "alarm_or_fault_code": ("अलार्म",),
}
HINDI_HAZARD_TERMS = ("धुआं", "धुआँ", "धुंआ", "आग", "चिंगारी", "करंट", "झटका", "dhuan")

HAZARD_TERMS = (
    "smoke", "fire", "flame", "spark", "burning smell", "electric shock", "shock", "exposed wire",
    "gas leak", "explosion", "injur", "guard removed", "interlock",
)

SAFETY_NOTICE = (
    "Possible hazard mentioned. Follow your site's approved safety, lockout/tagout and escalation "
    "procedures before any inspection or repair."
)


NEGATION = re.compile(r"\b(no|not|without|never|nor|none|isn't|wasn't|aren't|weren't|don't|didn't|doesn't)\b")
CLAUSE_BREAK = re.compile(r"[.;:!?,]|\b(but|however|although|though|and then)\b")


# Endings a cue word may take ("leak" -> "leaking", "trip" -> "tripped", "smoke" -> "smoking").
# Anything else is a different word: "hum" must not match "humid", nor "hot" "hotel".
SUFFIXES = (
    "s", "es", "ed", "d", "ing", "er", "ers", "est", "y", "ly", "ies", "ied", "ion", "ions", "e",
    "age", "ment", "ant", "ation", "ated", "ating", "ive", "ory", "ness",
)
_SUFFIX_RE = "(?:" + "|".join(sorted(SUFFIXES, key=len, reverse=True)) + ")?"


@lru_cache(maxsize=512)
def _cue_pattern(needle: str) -> re.Pattern:
    stems = [re.escape(needle)]
    if needle.endswith("e"):
        stems.append(re.escape(needle[:-1]))  # smoke -> smoking, noise -> noisy
    doubled = f"(?:{re.escape(needle[-1])})?"  # trip -> tripped, hum -> humming
    return re.compile(r"\b(?:" + "|".join(stems) + ")" + doubled + _SUFFIX_RE + r"\b")


def _affirmed(needle: str, text: str) -> bool:
    """True if `needle` occurs at least once without a negation earlier in the same clause.

    "There is no smoke" -> False; "no leak, but heavy smoke" -> True.
    """
    for m in _cue_pattern(needle).finditer(text):
        window = text[max(0, m.start() - 40) : m.start()]
        breaks = list(CLAUSE_BREAK.finditer(window))
        clause = window[breaks[-1].end() :] if breaks else window
        if not NEGATION.search(clause):
            return True
    return False


HINDI_NEGATION = re.compile(r"(नहीं|नही|ना\s|nahi|nahin)")
HINDI_CLAUSE_BREAK = re.compile(r"[।.;:!?,]|\s(और|लेकिन|पर|मगर|aur|lekin)\s")


def _affirmed_hindi(needle: str, text: str) -> bool:
    """Hindi negation follows the word in the same clause ("गर्म नहीं है"); "बिना" precedes it."""
    for m in re.finditer(r"(?<![\w\u0900-\u097F])" + re.escape(needle), text):
        after = text[m.end() : m.end() + 30]
        brk = HINDI_CLAUSE_BREAK.search(after)
        after = after[: brk.start()] if brk else after
        before = text[max(0, m.start() - 10) : m.start()]
        if not HINDI_NEGATION.search(after) and "बिना" not in before:
            return True
    return False


def tag_symptoms(*texts: str) -> list[str]:
    blob = " ".join(t for t in texts if t).lower()
    return [
        tag for tag, needles in SYMPTOM_TAXONOMY.items()
        if any(_affirmed(n, blob) for n in needles)
        or any(_affirmed_hindi(n, blob) for n in HINDI_TAXONOMY.get(tag, ()))
    ]


def detect_hazard(text: str) -> bool:
    lowered = (text or "").lower()
    return any(_affirmed(term, lowered) for term in HAZARD_TERMS) or any(
        _affirmed_hindi(term, lowered) for term in HINDI_HAZARD_TERMS
    )
