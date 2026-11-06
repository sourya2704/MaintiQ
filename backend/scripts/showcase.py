"""Clean showcase plant: wipe every record, then create one realistic organization.

    uv run python -m scripts.showcase            # only if the showcase plant is not there yet
    uv run python -m scripts.showcase --force    # wipe and recreate even if it is

On Render, set SHOWCASE_RESET=true and start.sh runs this on boot. The first boot wipes the
database and creates the plant; later boots see the plant already exists and leave it alone,
so restarts never erase the work done during a demo.

THIS DELETES EVERY ORGANIZATION, USER, MACHINE, INCIDENT, PHOTO AND MESSAGE in the database.

Passwords come from environment variables (never from this file, which is public):
    SHOWCASE_ADMIN_PASSWORD, SHOWCASE_SUPERVISOR_PASSWORD,
    SHOWCASE_TECH1_PASSWORD, SHOWCASE_TECH2_PASSWORD
Any that are missing are generated and printed once to the log.
"""

import argparse
import os
import secrets
import shutil
from datetime import timedelta

from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import Base, utcnow
from app.db.session import SessionLocal
from app.models import Incident, Machine, MaintenanceOutcome, Organization, User
from app.models.enums import AnalysisSource, ProcessingStatus, Role, TranscriptSource
from app.services.accounts import PASSWORD_ALPHABET
from app.services.pipeline import refresh_search_text
from app.services.symptoms import tag_symptoms

ORG_NAME = "Deccan Auto Components – Chakan Plant"
ORG_SLUG = "deccan-auto"

# key, name, login, role, password variable
USERS = [
    ("admin", "Meera Kulkarni", "meera.kulkarni@deccan-auto.mantiq", Role.admin, "SHOWCASE_ADMIN_PASSWORD"),
    ("sup", "Vikram Shinde", "vikram.shinde@deccan-auto.mantiq", Role.supervisor, "SHOWCASE_SUPERVISOR_PASSWORD"),
    ("arjun", "Arjun Patil", "arjun.patil@deccan-auto.mantiq", Role.technician, "SHOWCASE_TECH1_PASSWORD"),
    ("imran", "Imran Shaikh", "imran.shaikh@deccan-auto.mantiq", Role.technician, "SHOWCASE_TECH2_PASSWORD"),
]

# code, name, type, maker, model, location, status
MACHINES = [
    ("CNC-101", "CNC turning centre 1", "CNC machining centre", "Ace Micromatic", "LT-20", "Machine shop, Cell A", "operational"),
    ("CNC-102", "Vertical machining centre", "CNC machining centre", "BFW", "BMV-45", "Machine shop, Cell A", "degraded"),
    ("HP-201", "200 t hydraulic press", "hydraulic press", "Sangli Hydraulics", "HPS-200", "Press shop", "degraded"),
    ("IMM-301", "Injection moulding machine 1", "injection moulding machine", "Milacron", "Magna-T 150", "Moulding shop", "operational"),
    ("AC-401", "Screw air compressor", "screw compressor", "Kirloskar Pneumatic", "KES-37", "Compressor house", "degraded"),
    ("PU-501", "Coolant pump – machine shop", "centrifugal pump", "Kirloskar Brothers", "KDS-516", "Coolant sump", "operational"),
    ("PU-502", "Cooling tower pump", "centrifugal pump", "Kirloskar Brothers", "KDS-725", "Utility yard", "operational"),
    ("CT-601", "Cooling tower", "cooling tower", "Paharpur", "PCT-150", "Utility yard", "operational"),
    ("MO-701", "Main conveyor drive motor", "electric motor", "Crompton Greaves", "ND-160M 11 kW", "Assembly line 1", "operational"),
    ("CV-702", "Assembly line conveyor", "conveyor", "Konark Conveyors", "BC-900", "Assembly line 1", "operational"),
    ("GB-703", "Conveyor gear reducer", "gearbox", "Elecon", "SN-125", "Assembly line 1", "operational"),
    ("RB-801", "MIG welding robot cell", "industrial robot", "Fanuc", "ARC Mate 100iD", "Weld shop", "operational"),
    ("DC-802", "Weld fume extractor", "dust collector", "Thermax", "DCX-24", "Weld shop", "operational"),
    ("CH-901", "Mould chiller", "chiller", "Voltas", "VCH-30", "Moulding shop", "operational"),
    ("TR-902", "1000 kVA transformer", "transformer", "Kirloskar Electric", "KET-1000", "Substation", "operational"),
    ("MCC-903", "Press shop MCC panel", "motor control centre panel", "L&T", "MCC-415", "Electrical room", "operational"),
    ("FL-904", "Forklift 2.5 t", "forklift", "Godrej", "GX-25D", "Dispatch", "operational"),
]

# Each incident: (code, days_ago, reporter, language, transcript, summary, symptoms, observations,
#                 actions, suspected, checks, urgency, review, outcome)
# outcome: (status, verified_cause, action_performed, parts, days_to_fix) or None
INCIDENTS = [
    # --- AC-401 compressor: repeating overheating story (the memory demo) ---
    ("AC-401", 160, "arjun", "en-IN",
     ("AC-401 compressor tripped on high discharge temperature at 2 pm. Discharge temp showed 112 degrees. "
     "Room was very hot, the exhaust louvre was half closed."),
     "AC-401 tripped on high discharge temperature (112 °C); compressor room hot, exhaust louvre half closed.",
     ["high temperature alarm trip", "overheating"], ["Discharge temperature 112 °C", "Exhaust louvre half closed"],
     ["Reset the trip after cooling"], ["Poor room ventilation", "Restricted cooler airflow"],
     ["Check after-cooler fins", "Check room exhaust louvre"], "urgent", "confirmed",
     ("resolved", "Hot-air recirculation: exhaust louvre jammed half shut",
      "Freed and greased louvre linkage; added louvre check to weekly round", [], 1)),
    ("AC-401", 95, "imran", "en-IN",
     ("Compressor AC-401 running hot again, 104 degrees and rising. Oil level is okay in the sight glass. "
     "Cooler fins are covered with oily dust."),
     "AC-401 running hot (104 °C); oil level normal; oil cooler fins clogged with oily dust.",
     ["overheating"], ["Oil level normal in sight glass", "Oil cooler fins clogged"], [],
     ["Clogged oil cooler", "Thermostatic valve stuck"], ["Clean cooler", "Check thermostatic valve"],
     "needs_review", "confirmed",
     ("resolved", "Oil cooler fins clogged with oily dust",
      "Cleaned oil cooler with degreaser and low-pressure air; cooler cleaning moved to monthly PM", ["Degreaser 5 L"], 1)),
    ("AC-401", 12, "arjun", "en-IN",
     ("AC-401 tripped twice this shift on high temperature. Cooler is clean this time. "
     "Oil looks dark and the oil filter delta-P indicator is in the red."),
     "AC-401 two high-temperature trips this shift; cooler clean; oil dark; oil filter differential indicator red.",
     ["overheating", "high temperature alarm trip"], ["Cooler clean", "Oil dark", "Oil filter ΔP indicator red"], [],
     ["Choked oil filter", "Degraded oil"], ["Check oil filter", "Check oil condition and hours"], "urgent", "confirmed",
     ("monitoring", "Choked oil filter and oil past change interval",
      "Changed oil filter and oil; temperature back to 86 °C, monitoring for one week",
      ["Oil filter KP-OF-37", "Compressor oil 20 L"], 1)),

    # --- PU-501 coolant pump: seal leak repeats ---
    ("PU-501", 140, "imran", "en-IN",
     "Coolant pump PU-501 is leaking at the mechanical seal, about one drop per second. Pump is also a bit noisy.",
     "PU-501 leaking at mechanical seal (~1 drop/s); slight noise.",
     ["leak at mechanical seal", "noise"], ["About one drop per second at seal"], [],
     ["Worn mechanical seal"], ["Check seal faces", "Check for dry running"], "needs_review", "confirmed",
     ("resolved", "Mechanical seal faces worn; coolant had metal fines",
      "Replaced mechanical seal; cleaned sump and replaced coolant filter bag", ["Mechanical seal 28 mm", "Filter bag 25 µm"], 2)),
    ("PU-501", 40, "arjun", "hi-IN",
     "PU-501 पंप की सील से फिर से कूलेंट टपक रहा है। पंप चलते समय आवाज़ भी आ रही है। सम्प में चिप्स बहुत हैं।",
     "PU-501 seal leaking coolant again; noise while running; heavy chips in the sump.",
     ["leak at mechanical seal", "noise"], ["Many chips in sump"], [],
     ["Seal damage from chips in coolant", "Low sump level causing dry running"],
     ["Check sump level", "Check chip filter"], "needs_review", "confirmed",
     ("resolved", "Chip filter torn, chips reached the seal",
      "Replaced seal and torn chip filter; added sump-cleaning every Saturday", ["Mechanical seal 28 mm", "Chip filter mesh"], 1)),

    # --- MO-701 motor bearing ---
    ("MO-701", 180, "arjun", "en-IN",
     "MO-701 conveyor motor is vibrating and the non-drive end is hot to touch. Rumbling noise from the back.",
     "MO-701 vibration with hot non-drive end and rumbling noise.",
     ["vibration", "hot motor housing", "rumbling noise at non-drive end"], ["Non-drive end hot to touch"], [],
     ["NDE bearing wear"], ["Measure vibration", "Check bearing temperature"], "needs_review", "confirmed",
     ("resolved", "NDE bearing worn (outer race pitting)", "Replaced NDE bearing 6309-2Z and re-greased", ["Bearing 6309-2Z"], 1)),
    ("MO-701", 30, "imran", "en-IN",
     "Grinding sound from MO-701 at start-up, goes away after five minutes. Grease nipple was dry.",
     "MO-701 grinding sound at start-up that clears after warm-up; grease point dry.",
     ["grinding noise at start-up"], ["Grease nipple dry", "Noise clears after warm-up"], [],
     ["Insufficient lubrication"], ["Check greasing schedule"], "routine", "confirmed",
     ("resolved", "Missed greasing interval", "Greased both bearings; added motor to monthly lube route", ["Grease EP2 400 g"], 0)),

    # --- HP-201 press: currently open, the "fix it" demo ---
    ("HP-201", 75, "imran", "en-IN",
     "HP-201 press is slow on the down stroke and oil is leaking from the main cylinder rod seal.",
     "HP-201 slow down stroke; oil leaking at main cylinder rod seal.",
     ["slow stroke", "oil leak"], ["Oil leaking at main cylinder rod"], [],
     ["Worn rod seal", "Internal bypass"], ["Check system pressure", "Check rod for scoring"], "needs_review", "confirmed",
     ("resolved", "Rod seal worn, rod surface fine", "Replaced main cylinder rod seal kit", ["Rod seal kit 125 mm"], 2)),
    ("HP-201", 3, "arjun", "en-IN",
     ("HP-201 is not building full pressure, gauge stops at 160 bar instead of 210. Pump is louder than normal, "
     "like a whining sound. Oil tank feels warm."),
     "HP-201 pressure only 160 bar (normal 210); pump whining; oil tank warm.",
     ["pressure drop", "noise", "overheating"], ["Gauge 160 bar vs 210 bar", "Pump whine", "Oil tank warm"], [],
     ["Suction strainer clogged", "Relief valve set low or leaking", "Pump wear"],
     ["Check suction strainer", "Check relief valve setting", "Check oil level"], "urgent", "confirmed", None),

    # --- CNC-102 spindle ---
    ("CNC-102", 60, "arjun", "en-IN",
     "CNC-102 spindle is making a high-pitch noise above 6000 rpm and surface finish is bad on the parts.",
     "CNC-102 high-pitch spindle noise above 6000 rpm; poor surface finish.",
     ["noise", "vibration", "poor surface finish"], ["Only above 6000 rpm"], [],
     ["Spindle bearing preload loss", "Tool holder imbalance"], ["Try another tool holder", "Check spindle runout"],
     "needs_review", "confirmed",
     ("resolved", "Tool holder imbalanced (damaged pull stud)", "Replaced pull stud and balanced holder; runout 4 µm", ["Pull stud BT40"], 0)),
    ("CNC-102", 6, "imran", "en-IN",
     "CNC-102 showing spindle over-temperature alarm after one hour running. Spindle chiller fan is not running.",
     "CNC-102 spindle over-temperature alarm after 1 h; spindle chiller fan not running.",
     ["overheating", "alarm"], ["Chiller fan not running"], [],
     ["Chiller fan motor or capacitor failure"], ["Check fan supply", "Check fan capacitor"], "urgent", "confirmed",
     ("open", None, "Running at reduced spindle speed until fan arrives", [], 0)),

    # --- IMM-301 moulding ---
    ("IMM-301", 50, "imran", "en-IN",
     "IMM-301 parts have short shots on the left cavity. Barrel zone 3 temperature is 20 degrees below set.",
     "IMM-301 short shots in left cavity; barrel zone 3 is 20 °C below set point.",
     ["short shots", "low temperature"], ["Zone 3 20 °C below set"], [],
     ["Heater band failure on zone 3"], ["Check heater band current"], "needs_review", "confirmed",
     ("resolved", "Zone 3 heater band open circuit", "Replaced heater band; zone 3 holds set point", ["Heater band 220 V 800 W"], 0)),

    # --- CV-702 conveyor ---
    ("CV-702", 25, "arjun", "en-IN",
     "CV-702 belt is drifting to the right side and the edge is getting frayed.",
     "CV-702 belt tracking to the right; belt edge fraying.",
     ["belt misalignment", "belt edge wear"], ["Edge frayed on right side"], [],
     ["Tail pulley misaligned", "Material build-up on pulley"], ["Check pulley alignment", "Clean pulleys"],
     "routine", "confirmed",
     ("resolved", "Build-up on tail pulley", "Cleaned tail pulley and re-tracked belt; fitted scraper", ["Belt scraper"], 0)),

    # --- RB-801 robot ---
    ("RB-801", 18, "imran", "en-IN",
     "Robot RB-801 weld spatter is high and wire is feeding unevenly. Contact tip looks burned.",
     "RB-801 high spatter and uneven wire feed; contact tip burned.",
     ["wire feed problem", "high spatter"], ["Contact tip burned"], [],
     ["Worn contact tip", "Liner blocked"], ["Replace tip", "Blow out liner"], "routine", "confirmed",
     ("resolved", "Worn contact tip and dirty liner", "Replaced contact tip, cleaned liner and drive rolls", ["Contact tip 1.2 mm ×10"], 0)),

    # --- CH-901 chiller ---
    ("CH-901", 9, "arjun", "en-IN",
     "Mould chiller CH-901 outlet water is 18 degrees, set point is 12. Condenser looks dusty.",
     "CH-901 outlet water 18 °C against 12 °C set point; condenser dusty.",
     ["overheating", "low cooling"], ["Outlet 18 °C vs 12 °C set", "Condenser dusty"], [],
     ["Dirty condenser", "Low refrigerant"], ["Clean condenser", "Check refrigerant pressure"], "needs_review", "confirmed",
     ("resolved", "Condenser coil choked with dust", "Cleaned condenser coil; outlet back to 12 °C", [], 0)),

    # --- PU-502 / CT-601: utility ---
    ("PU-502", 4, "imran", "en-IN",
     "Cooling tower pump PU-502 discharge pressure is low and the pump is making a gravel noise.",
     "PU-502 low discharge pressure with gravel-like noise.",
     ["pressure drop", "noise"], ["Gravel-like noise"], [],
     ["Cavitation from low sump level", "Blocked suction strainer"], ["Check tower basin level", "Clean strainer"],
     "needs_review", "draft", None),
    ("CT-601", 110, "arjun", "en-IN",
     "Cooling tower CT-601 fan is vibrating heavily. One blade has scale deposits.",
     "CT-601 fan heavy vibration; scale deposits on one blade.",
     ["vibration"], ["Scale on one blade"], [], ["Fan imbalance from scale"], ["Clean blades", "Check blade pitch"],
     "needs_review", "confirmed",
     ("resolved", "Fan imbalance due to scale on blade", "Descaled blades and reset pitch", [], 1)),

    # --- DC-802 fume extractor ---
    ("DC-802", 15, "imran", "en-IN",
     "Fume extractor DC-802 suction is weak, smoke staying in the weld cell. Filter delta P is high.",
     "DC-802 weak suction; fumes stay in weld cell; high filter differential pressure.",
     ["low suction", "high differential pressure"], ["Filter ΔP high"], [],
     ["Clogged filter cartridges", "Pulse cleaning not working"], ["Check pulse valves", "Check cartridges"],
     "needs_review", "confirmed",
     ("resolved", "Pulse-jet solenoid failed, cartridges not cleaning",
      "Replaced pulse solenoid and two cartridges", ["Solenoid valve 24 V", "Filter cartridge ×2"], 1)),

    # --- FL-904 forklift ---
    ("FL-904", 2, "arjun", "en-IN",
     "Forklift FL-904 mast is drifting down slowly with load. Hydraulic oil level is on the low mark.",
     "FL-904 mast drifts down under load; hydraulic oil at low mark.",
     ["oil leak", "drift under load"], ["Oil at low mark"], [],
     ["Lift cylinder seal leak", "Control valve leak"], ["Check lift cylinders for oil", "Top up and observe"],
     "needs_review", "draft", None),
]


def password_for(var: str) -> tuple[str, bool]:
    """(password, generated?). A generated one uses the same unambiguous alphabet as worker passwords."""
    value = os.environ.get(var, "").strip()
    if value:
        return value, False
    chars = [secrets.choice(PASSWORD_ALPHABET) for _ in range(12)]
    return "-".join("".join(chars[i:i + 4]) for i in range(0, 12, 4)), True


def wipe(db) -> None:
    """Delete every row in every application table (the schema and migration history stay)."""
    tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    db.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    db.commit()
    storage = get_settings().storage_dir
    for sub in ("audio", "photos"):
        shutil.rmtree(storage / sub, ignore_errors=True)


def showcase(force: bool = False) -> None:
    with SessionLocal() as db:
        if not force and db.scalar(select(Organization).where(Organization.slug == ORG_SLUG)):
            print(f"Showcase plant '{ORG_NAME}' already exists; leaving the database as it is.")
            return
        wipe(db)

        org = Organization(name=ORG_NAME, slug=ORG_SLUG)
        db.add(org)
        db.flush()
        users, generated = {}, []
        for key, name, email, role, var in USERS:
            pw, gen = password_for(var)
            if gen:
                generated.append((email, pw))
            u = User(organization_id=org.id, name=name, email=email, password_hash=hash_password(pw), role=role,
                     preferred_language="en", must_change_password=False)
            db.add(u)
            users[key] = u
        machines = {}
        for code, name, mtype, mfr, model, loc, status in MACHINES:
            m = Machine(organization_id=org.id, asset_code=code, name=name, type=mtype, manufacturer=mfr,
                        model=model, location=loc, status=status)
            db.add(m)
            machines[code] = m
        db.flush()

        sup = users["sup"]
        for (code, days, who, lang, transcript, summary, symptoms, obs, actions, suspected, checks, urgency,
             review, outcome) in INCIDENTS:
            when = utcnow() - timedelta(days=days, hours=secrets.randbelow(8))
            inc = Incident(
                organization_id=org.id, machine_id=machines[code].id, reporter_id=users[who].id, occurred_at=when,
                transcript_original=transcript, transcript_source=TranscriptSource.manual, transcript_language=lang,
                summary=summary, symptoms=symptoms, observations=obs, actions_taken=actions,
                suspected_causes=suspected, missing_information=[], suggested_checks=checks, urgency=urgency,
                symptom_tags=tag_symptoms(transcript, " ".join(symptoms)),
                analysis_source=AnalysisSource.manual, processing_status=ProcessingStatus.awaiting_review,
                review_status=review,
            )
            inc.machine = machines[code]
            if review == "confirmed":
                inc.confirmed_by_id, inc.confirmed_at = sup.id, when + timedelta(hours=1)
            if outcome:
                status, cause, action, parts, fix_days = outcome
                done = when + timedelta(days=fix_days, hours=4)
                inc.outcomes.append(MaintenanceOutcome(
                    verified_cause=cause, action_performed=action, parts_used=parts, resolution_status=status,
                    verified_by_id=users[who].id, resolved_at=done if status == "resolved" else None, created_at=done,
                ))
                inc.resolution_status = status
            refresh_search_text(inc)
            db.add(inc)
        db.commit()

        print(f"Showcase plant ready: '{ORG_NAME}', {len(USERS)} users, {len(MACHINES)} machines, "
              f"{len(INCIDENTS)} incidents. All earlier data was removed.")
        for email, pw in generated:
            print(f"  generated password  {email}  {pw}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="wipe and recreate even if the showcase plant exists")
    showcase(parser.parse_args().force)
