import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { ImportReport } from "../lib/types";
import { CheckIcon, DownloadIcon, UploadIcon } from "./icons/MachineIcons";
import { Button3D } from "./ui/Button3D";
import { ErrorBox, Select, errorText, useToast } from "./ui/kit";

type Conflict = "skip" | "update";

async function runImport(file: File, onConflict: Conflict, dryRun: boolean) {
  const form = new FormData();
  form.set("file", file, file.name);
  const q = new URLSearchParams({ dry_run: String(dryRun), on_conflict: onConflict });
  return api.upload<ImportReport>(`/api/machines/import?${q}`, form);
}

/** CSV asset-list import: preview (dry run) first, then commit. */
export function MachineImport({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [conflict, setConflict] = useState<Conflict>("skip");
  const [preview, setPreview] = useState<ImportReport | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    runImport(file, conflict, true)
      .then((r) => !cancelled && setPreview(r))
      .catch((e) => {
        if (!cancelled) {
          setPreview(null);
          setError(e);
        }
      })
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [file, conflict]);

  const commit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await runImport(file, conflict, false);
      qc.invalidateQueries({ queryKey: ["machines"] });
      qc.invalidateQueries({ queryKey: ["machine-types"] });
      toast("ok", `Imported: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped`);
      onDone();
    } catch (e) {
      toast("alert", errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const template = async () => {
    const { blob } = await api.blob("GET", "/api/machines/import/template");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mantiq-machines-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const willWrite = preview ? preview.created + preview.updated : 0;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-dim">
        Upload your asset list as CSV (Excel: <em>Save as → CSV</em>). Needed columns: asset code, name and type. Optional:
        manufacturer, model, location, status. Common header names like <span className="font-mono">Asset No</span>,{" "}
        <span className="font-mono">Equipment</span> or <span className="font-mono">Category</span> are recognised.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button3D variant="neutral" icon={<UploadIcon size={16} />} onClick={() => input.current?.click()}>
          {file ? "Choose another file" : "Choose CSV file"}
        </Button3D>
        <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Select aria-label="If an asset code already exists" value={conflict} onChange={(e) => setConflict(e.target.value as Conflict)} className="!w-auto">
          <option value="skip">Existing asset codes: skip</option>
          <option value="update">Existing asset codes: update</option>
        </Select>
        <Button3D variant="ghost" icon={<DownloadIcon size={14} />} onClick={template}>
          Template
        </Button3D>
        {file && <span className="text-sm text-ink-mute">{file.name}</span>}
      </div>

      {Boolean(error) && <ErrorBox error={error} />}
      {preview && (
        <div className="space-y-3 rounded-lg border border-line bg-sunk/50 p-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>
              <b className="text-ink">{preview.total_rows}</b> <span className="text-ink-mute">rows</span>
            </span>
            <span className="text-ok">
              <b>{preview.created}</b> new
            </span>
            <span className="text-brass">
              <b>{preview.updated}</b> update
            </span>
            <span className="text-ink-mute">
              <b>{preview.skipped}</b> skip
            </span>
            <span className={preview.errors.length ? "text-alert" : "text-ink-mute"}>
              <b>{preview.errors.length}</b> errors
            </span>
          </div>
          {preview.unknown_columns.length > 0 && (
            <p className="text-xs text-ink-mute">Ignored columns: {preview.unknown_columns.join(", ")}</p>
          )}
          {preview.errors.length > 0 && (
            <div className="max-h-48 overflow-auto rounded-md border border-line bg-card">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-card-2 text-ink-dim">
                  <tr>
                    <th className="px-3 py-1.5">Line</th>
                    <th className="px-3 py-1.5">Asset</th>
                    <th className="px-3 py-1.5">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errors.map((e) => (
                    <tr key={e.line} className="border-t border-line">
                      <td className="px-3 py-1.5 font-mono">{e.line}</td>
                      <td className="px-3 py-1.5 font-mono">{e.asset_code || "—"}</td>
                      <td className="px-3 py-1.5 text-alert">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button3D variant="primary" icon={<CheckIcon size={16} />} loading={busy} disabled={willWrite === 0} onClick={commit}>
              Import {willWrite} machine{willWrite === 1 ? "" : "s"}
            </Button3D>
            {preview.errors.length > 0 && <span className="text-xs text-ink-mute">Rows with errors are left out.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
