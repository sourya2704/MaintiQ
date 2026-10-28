"""Deterministic symptom taxonomy.

Free-text symptoms are mapped to canonical tags so retrieval can explain
matches ("shared symptom: vibration") without relying on model scores.
"""

import re

SYMPTOM_TAXONOMY: dict[str, tuple[str, ...]] = {
    "vibration": ("vibrat", "shak", "wobbl", "oscillat", "imbalance", "unbalance"),
    "overheating": ("overheat", "hot", "heat", "temperature", "thermal", "warm"),
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

HAZARD_TERMS = (
    "smoke", "fire", "flame", "spark", "burning smell", "electric shock", "shock", "exposed wire",
    "gas leak", "explosion", "injur", "guard removed", "interlock",
)

SAFETY_NOTICE = (
    "Possible hazard mentioned. Follow your site's approved safety, lockout/tagout and escalation "
    "procedures before any inspection or repair."
)


def tag_symptoms(*texts: str) -> list[str]:
    blob = " ".join(t for t in texts if t).lower()
    tags = []
    for tag, needles in SYMPTOM_TAXONOMY.items():
        if any(re.search(r"\b" + re.escape(n), blob) for n in needles):
            tags.append(tag)
    return tags


def detect_hazard(text: str) -> bool:
    lowered = (text or "").lower()
    return any(re.search(r"\b" + re.escape(term), lowered) for term in HAZARD_TERMS)
