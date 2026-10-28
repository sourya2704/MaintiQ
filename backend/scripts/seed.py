"""Seed a clearly labelled FICTIONAL demo dataset (PRD section 17).

Usage:  uv run python -m scripts.seed [--reset]

Creates one demo organization with three users, five machines and a set of
historical incidents covering repeated symptoms, different outcomes, an
unresolved case and an incident with no recorded outcome. All rows are marked
is_seed / source=seed so they are never mistaken for live provider output.
"""

import argparse
import os
from datetime import timedelta

from sqlalchemy import select

from app.db.base import utcnow
from app.db.session import SessionLocal
from app.core.security import hash_password
from app.models import Incident, Machine, MaintenanceOutcome, Organization, User
from app.models.enums import AnalysisSource, ProcessingStatus, ReviewStatus, Role, TranscriptSource
from app.services.pipeline import refresh_search_text
from app.services.symptoms import tag_symptoms

ORG_NAME = "Demo Plant (fictional data)"
PASSWORD = os.environ.get("SEED_PASSWORD", "MantiqDemo#2026")

USERS = [
    ("Asha Admin", "admin@demo-mantiq.example.com", Role.admin),
    ("Sam Supervisor", "supervisor@demo-mantiq.example.com", Role.supervisor),
    ("Ravi Technician", "tech@demo-mantiq.example.com", Role.technician),
]

MACHINES = [
    ("M-104", "Line 1 conveyor drive motor", "electric motor", "Demo Motors", "DM-7.5kW", "Line 1, Bay A"),
    ("M-105", "Mixer drive motor", "electric motor", "Demo Motors", "DM-11kW", "Line 2, Bay C"),
    ("P-201", "Coolant circulation pump", "centrifugal pump", "Demo Pumps", "CP-40", "Utility room"),
    ("C-301", "Packaging conveyor", "conveyor", "Demo Conveyors", "BC-1200", "Packing hall"),
    ("K-401", "Plant air compressor", "air compressor", "Demo Air", "SC-22", "Compressor house"),
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


def seed(reset: bool = False) -> None:
    with SessionLocal() as db:
        org = db.scalar(select(Organization).where(Organization.name == ORG_NAME))
        if org and not reset:
            print(f"Seed organization already exists ({org.id}); use --reset to recreate.")
            return
        if org and reset:
            for inc in db.scalars(select(Incident).where(Incident.organization_id == org.id)):
                db.delete(inc)
            db.flush()
            db.delete(org)
            db.commit()

        org = Organization(name=ORG_NAME)
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
                confidence_notes="Fictional demo record.",
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
