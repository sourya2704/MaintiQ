"""Generate demo voice notes for the PRD test scenarios with Gnani Timbre (live).

Usage:  uv run python -m scripts.make_demo_audio
Writes WAV files to backend/demo_audio/. These are synthetic recordings of
fictional reports, made for demos and end-to-end tests of the Prisma path.
"""

import sys
from pathlib import Path

from app.core.config import get_settings
from app.services.providers import timbre
from app.services.providers.base import ProviderError

OUT = Path(__file__).resolve().parent.parent / "demo_audio"

SCENARIOS = [
    ("01_m104_vibration_hot_belt_checked", "en-IN",
     "Motor M 104 is vibrating more than usual and the housing is hot. "
     "I checked the belt tension, it looks fine, but the vibration is still there."),
    ("02_p201_pump_vibration_seal_leak", "en-IN",
     "Coolant pump P 201 is vibrating again and there is water dripping from the mechanical seal. "
     "The leak looks worse than last month."),
    ("03_k401_overheating_no_reading", "en-IN",
     "Air compressor K 401 is overheating and the high temperature alarm went off. "
     "I could not take a temperature reading. The cooler fins look dusty."),
    ("04_c301_smoke_hazard", "en-IN",
     "There is smoke coming from the motor panel on packaging conveyor C 301 and a burning smell. "
     "I have stopped the line and called the electrician."),
    ("05_m104_long_note_over_30s", "en-IN",
     "This is Ravi on line one. Motor M 104 started vibrating badly at the start of the night shift. "
     "The motor housing feels much hotter than normal and there is a low grinding noise near the non drive end bearing. "
     "I checked the drive belt tension and it looked fine, so I do not think the belt is the problem. "
     "I also looked at the coupling guard and it is in place. There is no smoke and no burning smell. "
     "Last time something similar happened we replaced the bearing, so maybe the bearing is worn again. "
     "I have not measured the temperature yet because the thermal gun is not working. "
     "Please arrange a vibration reading and a bearing inspection before the morning shift."),
    ("06_p201_hindi_leak", "hi-IN",
     "पंप पी दो सौ एक की सील से पानी टपक रहा है और मोटर सामान्य से ज़्यादा गर्म है। मैंने अभी तक कुछ नहीं बदला है।"),
]


def main() -> None:
    if get_settings().timbre_mode != "live":
        sys.exit("Set TIMBRE_MODE=live and GNANI_API_KEY in .env to generate demo audio.")
    OUT.mkdir(exist_ok=True)
    for name, language, text in SCENARIOS:
        try:
            audio, meta = timbre.synthesize(text, language)
        except ProviderError as exc:
            print(f"{name}: failed ({exc.code}) {exc.safe_message}")
            continue
        (OUT / f"{name}.wav").write_bytes(audio)
        print(f"{name}.wav  {len(audio) // 1024} KB  ({meta.model}, {meta.latency_ms} ms)")


if __name__ == "__main__":
    main()
