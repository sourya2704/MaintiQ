import { useState, type FormEvent } from "react";
import type { Machine, MachineStatus } from "../lib/types";
import { Button3D } from "./ui/Button3D";
import { ErrorBox, Field, Input, Select } from "./ui/kit";

export type MachineInput = Pick<Machine, "asset_code" | "name" | "type" | "manufacturer" | "model" | "location" | "status">;

const TYPES = ["electric motor", "centrifugal pump", "conveyor", "air compressor", "gearbox", "fan"];

export function MachineForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<MachineInput>;
  submitLabel: string;
  onSubmit: (m: MachineInput) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const [m, setM] = useState<MachineInput>({
    asset_code: "",
    name: "",
    type: "",
    manufacturer: "",
    model: "",
    location: "",
    status: "operational",
    ...initial,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const set = (k: keyof MachineInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setM({ ...m, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...m, manufacturer: m.manufacturer || null, model: m.model || null, location: m.location || null });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Asset code" hint="Unique ID painted on the machine, e.g. M-104">
        <Input required value={m.asset_code} onChange={set("asset_code")} pattern="[A-Za-z0-9][A-Za-z0-9._\-/ ]*" />
      </Field>
      <Field label="Name">
        <Input required value={m.name} onChange={set("name")} placeholder="Line 1 drive motor" />
      </Field>
      <Field label="Type" hint="Machines of the same type are compared in failure memory">
        <Input required list="machine-types" value={m.type} onChange={set("type")} />
        <datalist id="machine-types">
          {TYPES.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </Field>
      <Field label="Status">
        <Select value={m.status} onChange={set("status")}>
          {(["operational", "degraded", "down", "retired"] as MachineStatus[]).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Manufacturer">
        <Input value={m.manufacturer ?? ""} onChange={set("manufacturer")} />
      </Field>
      <Field label="Model">
        <Input value={m.model ?? ""} onChange={set("model")} />
      </Field>
      <Field label="Location">
        <Input value={m.location ?? ""} onChange={set("location")} placeholder="Line 1, Bay A" />
      </Field>
      <div className="flex items-end justify-end gap-2">
        {onCancel && (
          <Button3D type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button3D>
        )}
        <Button3D type="submit" variant="plasma" loading={busy}>
          {submitLabel}
        </Button3D>
      </div>
      {Boolean(error) && (
        <div className="sm:col-span-2">
          <ErrorBox error={error} />
        </div>
      )}
    </form>
  );
}
