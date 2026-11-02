"""Bulk machine import from a CSV asset list (e.g. exported from Excel or a CMMS).

Rows are validated with the same schema as the create form. A dry run reports
exactly what would happen (created / updated / skipped / errors per row)
without writing anything.
"""

import csv
import io
import re
import uuid
from dataclasses import dataclass, field
from typing import Literal

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import Machine
from app.schemas.machines import MachineCreate
from app.services import audit

MAX_BYTES = 1_000_000
MAX_ROWS = 2000
FIELDS = ("asset_code", "name", "type", "manufacturer", "model", "location", "status")
TEMPLATE = (
    "asset_code,name,type,manufacturer,model,location,status\n"
    "M-104,Line 1 conveyor drive motor,electric motor,ABB,M3BP 132,Line 1 Bay A,operational\n"
    "P-201,Coolant circulation pump,centrifugal pump,Grundfos,NB 40-200,Utility room,operational\n"
)

# Header aliases seen in real asset registers, normalised to our field names.
ALIASES = {
    "asset_code": {"asset_code", "asset", "asset_id", "asset_no", "asset_number", "tag", "tag_no", "equipment_id", "equipment_no", "code", "id"},
    "name": {"name", "machine", "machine_name", "equipment", "equipment_name", "description", "asset_name"},
    "type": {"type", "machine_type", "equipment_type", "category", "class", "asset_type"},
    "manufacturer": {"manufacturer", "make", "brand", "oem", "vendor"},
    "model": {"model", "model_no", "model_number"},
    "location": {"location", "area", "line", "site", "plant_area", "functional_location"},
    "status": {"status", "state", "condition"},
}
STATUS_ALIASES = {
    "running": "operational", "ok": "operational", "active": "operational", "in service": "operational", "": "operational",
    "faulty": "degraded", "warning": "degraded", "stopped": "down", "breakdown": "down", "out of service": "down",
    "scrapped": "retired", "inactive": "retired", "decommissioned": "retired",
}


@dataclass
class ImportReport:
    total_rows: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[dict] = field(default_factory=list)
    unknown_columns: list[str] = field(default_factory=list)
    dry_run: bool = True


def _norm_header(h: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (h or "").strip().lower()).strip("_")


def _map_headers(headers: list[str]) -> tuple[dict[str, str], list[str]]:
    mapping, unknown = {}, []
    for raw in headers:
        key = _norm_header(raw)
        target = next((f for f, names in ALIASES.items() if key in names), None)
        if target and target not in mapping.values():
            mapping[raw] = target
        elif raw and raw.strip():
            unknown.append(raw.strip())
    return mapping, unknown


def _decode(content: bytes) -> str:
    for enc in ("utf-8-sig", "cp1252"):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    raise AppError(400, "invalid_csv", "Could not read the file; save it as UTF-8 CSV")


def import_machines(
    db: Session,
    organization_id: uuid.UUID,
    actor_id: uuid.UUID,
    content: bytes,
    *,
    on_conflict: Literal["skip", "update"] = "skip",
    dry_run: bool = True,
) -> ImportReport:
    if not content.strip():
        raise AppError(400, "empty_file", "The file is empty")
    if len(content) > MAX_BYTES:
        raise AppError(413, "file_too_large", "CSV must be under 1 MB")
    text = _decode(content)
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    mapping, unknown = _map_headers(reader.fieldnames or [])
    missing = [f for f in ("asset_code", "name", "type") if f not in mapping.values()]
    if missing:
        raise AppError(422, "missing_columns", f"CSV needs columns for: {', '.join(missing)}", {"found": reader.fieldnames})

    report = ImportReport(unknown_columns=unknown, dry_run=dry_run)
    existing = {m.asset_code: m for m in db.scalars(select(Machine).where(Machine.organization_id == organization_id))}
    seen: set[str] = set()

    for line_no, raw in enumerate(reader, start=2):  # header is line 1
        if report.total_rows >= MAX_ROWS:
            raise AppError(413, "too_many_rows", f"Import at most {MAX_ROWS} machines per file")
        row = {mapping[k]: (v or "").strip() for k, v in raw.items() if k in mapping}
        if not any(row.values()):
            continue
        report.total_rows += 1
        row["status"] = STATUS_ALIASES.get(row.get("status", "").lower(), row.get("status", "").lower())
        try:
            data = MachineCreate.model_validate({k: (row.get(k) or None) for k in FIELDS} | {"status": row["status"]})
        except ValidationError as exc:
            msg = "; ".join(f"{'.'.join(str(x) for x in e['loc'])}: {e['msg']}" for e in exc.errors())
            report.errors.append({"line": line_no, "asset_code": row.get("asset_code"), "message": msg})
            continue
        if data.asset_code in seen:
            report.errors.append({"line": line_no, "asset_code": data.asset_code, "message": "Duplicate asset code in this file"})
            continue
        seen.add(data.asset_code)

        current = existing.get(data.asset_code)
        if current is None:
            report.created += 1
            if not dry_run:
                db.add(Machine(organization_id=organization_id, **data.model_dump()))
        elif on_conflict == "update":
            report.updated += 1
            if not dry_run:
                for k, v in data.model_dump().items():
                    if v is not None:
                        setattr(current, k, v)
        else:
            report.skipped += 1

    if not dry_run and (report.created or report.updated):
        audit.record(db, organization_id=organization_id, actor_id=actor_id, entity_type="organization",
                     entity_id=organization_id, action="machines_imported",
                     details={"created": report.created, "updated": report.updated, "skipped": report.skipped,
                              "errors": len(report.errors)})
        db.flush()
    return report
