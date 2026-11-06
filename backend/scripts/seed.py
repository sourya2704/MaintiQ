"""Seed a sample plant with history (PRD section 17).

Usage:  uv run python -m scripts.seed [--reset]

Creates one organization with three users, thirty-one machines (one of each modelled type) and a set of
historical incidents covering repeated symptoms, different outcomes, an
unresolved case and an incident with no recorded outcome. All rows are marked
is_seed / source=seed so they are never mistaken for live provider output.
"""

import argparse
import os
from datetime import timedelta

from sqlalchemy import select

from app.core.config import get_settings
from app.db.base import utcnow
from app.db.session import SessionLocal
from app.core.security import hash_password
from app.models import Incident, Machine, MaintenanceOutcome, Organization, User
from app.models.enums import AnalysisSource, ProcessingStatus, ReviewStatus, Role, TranscriptSource
from app.services.pipeline import refresh_search_text
from app.services.symptoms import tag_symptoms

ORG_NAME = "Narmada Steel Works – Plant 2"
PASSWORD = os.environ.get("SEED_PASSWORD", "MantiqDemo#2026")

USERS = [
    ("Asha Verma", "asha.verma@narmadasteel.example.com", Role.admin),
    ("Sunil Rao", "sunil.rao@narmadasteel.example.com", Role.supervisor),
    ("Ravi Kumar", "ravi.kumar@narmadasteel.example.com", Role.technician),
]

# Earlier releases seeded these names; seed() renames them in place so an existing
# database keeps its history instead of getting a second copy.
LEGACY_ORG_NAME = "Demo Plant (fictional data)"
LEGACY_EMAILS = {
    "admin@demo-mantiq.example.com": USERS[0],
    "supervisor@demo-mantiq.example.com": USERS[1],
    "tech@demo-mantiq.example.com": USERS[2],
}
LEGACY_MAKERS = {"Demo Motors": "Vindhya Motors", "Demo Pumps": "Ganga Pumps", "Demo Conveyors": "Konark Conveyors",
                 "Demo Air": "Sahyadri Air"}

MACHINES = [
    ("M-104", "Line 1 conveyor drive motor", "electric motor", "Vindhya Motors", "VM-7.5kW", "Line 1, Bay A"),
    ("M-105", "Mixer drive motor", "electric motor", "Vindhya Motors", "VM-11kW", "Line 2, Bay C"),
    ("P-201", "Coolant circulation pump", "centrifugal pump", "Ganga Pumps", "CP-40", "Utility room"),
    ("C-301", "Packaging conveyor", "conveyor", "Konark Conveyors", "BC-1200", "Packing hall"),
    ("K-401", "Plant air compressor", "air compressor", "Sahyadri Air", "SC-22", "Compressor house"),
    ("R-106", "Mixer gear reducer", "gearbox", "Vindhya Gears", "HR-125", "Line 2, Bay C"),
    ("F-501", "Boiler induced-draft fan", "centrifugal fan", "Konark Air Systems", "ID-450", "Boiler house"),
    ("G-601", "Standby diesel generator", "diesel generator", "Sahyadri Power", "DG-125", "DG yard"),
    ("H-701", "Bearing press", "hydraulic press", "Narmada Hydraulics", "HP-100", "Maintenance workshop"),
    ("L-801", "Tool room lathe", "centre lathe", "Vindhya Machine Tools", "CL-460", "Tool room"),
    ("B-901", "Process steam boiler", "steam boiler", "Ganga Thermal", "FT-2000", "Boiler house"),
    ("V-110", "Machining centre 1", "CNC machining centre", "Vindhya Machine Tools", "VMC-850", "Machine shop"),
    ("V-111", "Milling machine", "milling machine", "Vindhya Machine Tools", "UM-1250", "Tool room"),
    ("V-112", "Radial drill", "radial drilling machine", "Vindhya Machine Tools", "RD-50", "Machine shop"),
    ("V-113", "Surface grinder", "surface grinder", "Vindhya Machine Tools", "SG-600", "Tool room"),
    ("V-114", "Bar cutting saw", "band saw", "Konark Tools", "BS-260", "Stores"),
    ("J-210", "Moulding machine 1", "injection moulding machine", "Narmada Plastics Machinery", "IM-120", "Moulding shop"),
    ("J-211", "Profile extruder", "extruder", "Narmada Plastics Machinery", "SE-65", "Moulding shop"),
    ("W-310", "Welding robot cell", "industrial robot", "Sahyadri Automation", "R6-10", "Fabrication bay"),
    ("T-410", "Forklift 3 t", "forklift", "Ganga Material Handling", "FD-30", "Dispatch"),
    ("T-411", "Workshop jib crane", "jib crane", "Konark Cranes", "JC-1000", "Maintenance workshop"),
    ("U-510", "Cooling tower cell 1", "cooling tower", "Ganga Thermal", "CT-300", "Utility yard"),
    ("U-511", "Process chiller", "chiller", "Sahyadri Cooling", "SC-350", "Utility room"),
    ("U-512", "Main transformer", "transformer", "Vindhya Electricals", "TR-1000", "Substation"),
    ("U-513", "MCC-02", "motor control centre panel", "Vindhya Electricals", "MCC-415", "Electrical room"),
    ("U-514", "Plant air compressor 2", "screw compressor", "Sahyadri Air", "SA-37", "Compressor house"),
    ("P-610", "Batch mixer", "mixing vessel", "Narmada Process", "MV-5000", "Process bay"),
    ("P-611", "Grain elevator", "bucket elevator", "Konark Conveyors", "BE-40", "Raw material bay"),
    ("P-612", "Dust collector", "dust collector", "Konark Air Systems", "DC-36", "Process bay"),
    ("P-613", "Cooler exchanger", "heat exchanger", "Ganga Thermal", "HX-48", "Process bay"),
    ("P-614", "Packing line 1", "packing machine", "Narmada Packaging", "VFFS-520", "Packing hall"),
]

# (asset, days_ago, transcript, summary, symptoms, observations, actions, suspected, outcome | None, urgency, review)
INCIDENTS = [
    ("M-104", 120,
     "M-104 is vibrating a lot more than usual and the motor housing is hot. I checked the belt tension and it was fine. "
     "There is a rumbling sound from the non-drive end.",
     "Excess vibration and hot housing on M-104; belt tension normal; rumble at non-drive end.",
     ["vibration", "hot motor housing", "rumbling noise at non-drive end"],
     ["Belt tension within normal range", "Rumble localised to non-drive end"],
     ["Checked belt tension"], ["Possible bearing wear at non-drive end"],
     ("resolved", "Worn non-drive-end bearing", "Replaced NDE bearing and re-greased", ["6205-2RS bearing"]),
     "needs_review", "confirmed"),
    ("M-104", 60,
     "Grinding noise from M-104 at start-up, goes away after a few minutes. Grease nipple looked dry.",
     "Start-up grinding noise on M-104; grease point appeared dry.",
     ["grinding noise at start-up"], ["Grease nipple appeared dry", "Noise reduces after warm-up"], [],
     ["Possible insufficient lubrication"],
     ("resolved", "Insufficient lubrication", "Lubricated bearings per schedule and corrected greasing interval", []),
     "routine", "confirmed"),
    ("M-105", 45,
     "Mixer motor M-105 shaking at full speed. Coupling guard was in place. Vibration started after the gearbox swap last week.",
     "Vibration on M-105 at full speed, started after a gearbox replacement.",
     ["vibration at full speed"], ["Started after gearbox replacement last week"], [],
     ["Possible coupling misalignment after gearbox replacement"],
     ("resolved", "Coupling misalignment after gearbox replacement", "Laser-aligned motor to gearbox coupling", []),
     "needs_review", "confirmed"),
    ("P-201", 30,
     "Coolant pump P-201 is vibrating and there is a small leak dripping at the mechanical seal.",
     "Vibration and small leak at mechanical seal on P-201.",
     ["vibration", "leak at mechanical seal"], ["Small drip at mechanical seal"], [],
     ["Possible seal wear", "Possible cavitation"],
     ("monitoring", None, "Tightened gland area and placed drip tray; monitoring leak rate each shift", []),
     "needs_review", "confirmed"),
    ("C-301", 20,
     "Packaging conveyor C-301 belt is slipping and running slow under load. Belt surface looks glazed.",
     "C-301 belt slipping and slow under load; belt surface glazed.",
     ["belt slipping", "slow under load"], ["Belt surface appears glazed"], [],
     ["Possible worn belt or low tension"], None, "routine", "confirmed"),
    ("K-401", 10,
     "Air compressor K-401 is overheating and tripped on high temperature alarm twice this shift. Cooler fins are dusty.",
     "K-401 overheating with two high-temperature alarm trips this shift; cooler fins dusty.",
     ["overheating", "high temperature alarm trip"], ["Two alarm trips this shift", "Cooler fins dusty"], [],
     ["Possible restricted cooler airflow"],
     ("unresolved", None, "Cleaned cooler fins with compressed air; still running hot", []),
     "urgent", "confirmed"),
    ("P-201", 5,
     "P-201 discharge pressure dropping during the night shift. No leak visible this time.",
     "Discharge pressure drop on P-201 during night shift; no visible leak.",
     ["discharge pressure drop"], ["No visible leak"], [],
     ["Possible impeller wear", "Possible suction restriction"], None, "needs_review", "draft"),
]


def add_missing_machines(db, org: Organization) -> int:
    """Machines added to the sample plant in later releases appear on existing databases too."""
    have = set(db.scalars(select(Machine.asset_code).where(Machine.organization_id == org.id)))
    added = 0
    for code, name, mtype, mfr, model, loc in MACHINES:
        if code not in have:
            db.add(Machine(organization_id=org.id, asset_code=code, name=name, type=mtype, manufacturer=mfr,
                           model=model, location=loc, is_seed=True))
            added += 1
    db.commit()
    return added


def rename_legacy(db) -> bool:
    """Rename a plant seeded by an earlier release. Returns True if one was found."""
    org = db.scalar(select(Organization).where(Organization.name == LEGACY_ORG_NAME))
    if org is None:
        return False
    org.name = ORG_NAME
    for user in db.scalars(select(User).where(User.organization_id == org.id)):
        if user.email in LEGACY_EMAILS:
            user.name, user.email, _ = LEGACY_EMAILS[user.email]
    for m in db.scalars(select(Machine).where(Machine.organization_id == org.id)):
        m.manufacturer = LEGACY_MAKERS.get(m.manufacturer or "", m.manufacturer)
        m.model = (m.model or "").replace("DM-", "VM-") or None
    for inc in db.scalars(select(Incident).where(Incident.organization_id == org.id)):
        if inc.confidence_notes == "Fictional demo record.":
            inc.confidence_notes = None
    db.commit()
    add_missing_machines(db, org)
    print(f"Renamed '{LEGACY_ORG_NAME}' to '{ORG_NAME}'.")
    return True


def seed(reset: bool = False) -> None:
    if get_settings().environment == "production" and not os.environ.get("SEED_PASSWORD"):
        print("Skipping seed: set SEED_PASSWORD (the default password is public in the repository).")
        return
    with SessionLocal() as db:
        if rename_legacy(db):
            return
        org = db.scalar(select(Organization).where(Organization.name == ORG_NAME))
        if org and not reset:
            added = add_missing_machines(db, org)
            print(f"Seed organization already exists ({org.id}); added {added} new machine(s). Use --reset to recreate.")
            return
        if org and reset:
            for inc in db.scalars(select(Incident).where(Incident.organization_id == org.id)):
                db.delete(inc)
            db.flush()
            db.delete(org)
            db.commit()

        org = Organization(name=ORG_NAME, slug="narmada-steel")
        db.add(org)
        db.flush()
        users = {}
        for name, email, role in USERS:
            u = User(organization_id=org.id, name=name, email=email, password_hash=hash_password(PASSWORD), role=role)
            db.add(u)
            users[role] = u
        machines = {}
        for code, name, mtype, mfr, model, loc in MACHINES:
            m = Machine(organization_id=org.id, asset_code=code, name=name, type=mtype, manufacturer=mfr,
                        model=model, location=loc, is_seed=True)
            db.add(m)
            machines[code] = m
        db.flush()

        tech, sup = users[Role.technician], users[Role.supervisor]
        for (code, days, transcript, summary, symptoms, obs, actions, suspected, outcome, urgency, review) in INCIDENTS:
            when = utcnow() - timedelta(days=days)
            inc = Incident(
                organization_id=org.id, machine_id=machines[code].id, reporter_id=tech.id, occurred_at=when,
                transcript_original=transcript, transcript_source=TranscriptSource.seed, transcript_language="en-IN",
                summary=summary, symptoms=symptoms, observations=obs, actions_taken=actions,
                suspected_causes=suspected, missing_information=[], suggested_checks=[], urgency=urgency,
                symptom_tags=tag_symptoms(transcript, " ".join(symptoms)),
                analysis_source=AnalysisSource.seed, processing_status=ProcessingStatus.awaiting_review,
                review_status=review, is_seed=True,
            )
            inc.machine = machines[code]
            if review == ReviewStatus.confirmed:
                inc.confirmed_by_id, inc.confirmed_at = sup.id, when + timedelta(hours=2)
            if outcome:
                status, cause, action, parts = outcome
                inc.outcomes.append(MaintenanceOutcome(
                    verified_cause=cause, action_performed=action, parts_used=parts, resolution_status=status,
                    verified_by_id=tech.id, resolved_at=when + timedelta(days=1) if status == "resolved" else None,
                    created_at=when + timedelta(days=1),
                ))
                inc.resolution_status = status
            refresh_search_text(inc)
            db.add(inc)
        db.commit()
        print(f"Seeded '{ORG_NAME}': {len(USERS)} users, {len(MACHINES)} machines, {len(INCIDENTS)} incidents.")
        print("Logins: " + ", ".join(e for _, e, _ in USERS) + f"  (password from SEED_PASSWORD, default in scripts/seed.py)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true")
    seed(parser.parse_args().reset)
