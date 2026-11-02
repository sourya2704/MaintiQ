import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { fmtDate, humanize, resolutionTone } from "../../lib/format";
import type { IncidentDetail, RelatedResponse, ResolutionStatus } from "../../lib/types";
import {
  BearingIcon,
  CheckIcon,
  GearIcon,
  LinkIcon,
  MachineTypeIcon,
  MemoryIcon,
  MicIcon,
  PlusIcon,
  ShieldIcon,
  WaveIcon,
  WrenchIcon,
  XIcon,
} from "../icons/MachineIcons";
import { Button3D } from "../ui/Button3D";
import { EmptyState, ErrorBox, Field, Input, Pill, Select, StatusPill, SymptomChip, Textarea } from "../ui/kit";

// ---------------------------------------------------------------- pipeline stepper

const STAGES = [
  { key: "capture", label: "Captured", icon: MicIcon },
  { key: "prisma", label: "Prisma STT", icon: WaveIcon },
  { key: "evon", label: "Evon draft", icon: BearingIcon },
  { key: "review", label: "Human review", icon: ShieldIcon },
  { key: "outcome", label: "Outcome", icon: WrenchIcon },
] as const;

function stageState(inc: IncidentDetail): Record<string, "done" | "active" | "failed" | "todo" | "skipped"> {
  const p = inc.processing_status;
  const hasTranscript = Boolean(inc.transcript_original);
  const analysed = Boolean(inc.analysis_source) && p !== "analyzing";
  return {
    capture: "done",
    prisma:
      inc.transcript_source === "manual" || inc.transcript_source === "seed"
        ? "skipped"
        : p === "transcribing" ? "active" : p === "transcription_failed" ? "failed" : hasTranscript ? "done" : "todo",
    evon: p === "analyzing" ? "active" : p === "analysis_failed" ? "failed" : analysed ? "done" : hasTranscript ? "active" : "todo",
    review: inc.review_status === "confirmed" ? "done" : p === "awaiting_review" ? "active" : "todo",
    outcome: inc.resolution_status === "resolved" ? "done" : inc.outcomes.length ? "active" : inc.review_status === "confirmed" ? "active" : "todo",
  };
}

export function PipelineStepper({ inc }: { inc: IncidentDetail }) {
  const s = stageState(inc);
  return (
    <ol className="grid grid-cols-5 gap-1 sm:gap-2" aria-label="Processing pipeline">
      {STAGES.map(({ key, label, icon: Icon }, i) => {
        const st = s[key];
        const color =
          st === "done" ? "border-ok/60 text-ok" : st === "active" ? "border-brass/70 text-brass" : st === "failed" ? "border-alert/70 text-alert" : st === "skipped" ? "border-dashed border-line text-ink-mute" : "border-line text-ink-mute";
        const spinning = (key === "prisma" && inc.processing_status === "transcribing") || (key === "evon" && inc.processing_status === "analyzing");
        return (
          <li key={key} className="relative flex flex-col items-center gap-2 text-center">
            {i > 0 && (
              <span className={`absolute right-1/2 top-6 -z-0 h-0.5 w-full ${s[STAGES[i - 1].key] === "done" ? "bg-ok/60" : "bg-line"}`} />
            )}
            <div
              className={`relative z-10 grid h-12 w-12 place-items-center rounded-xl border-2 bg-sunk ${color} ${
                st === "active" ? "" : ""
              }`}
            >
              {spinning ? <GearIcon size={22} className="animate-spin" /> : st === "done" ? <CheckIcon size={22} /> : st === "failed" ? <XIcon size={22} /> : <Icon size={22} />}
            </div>
            <span className={`text-[10px] font-semibold uppercase tracking-wider sm:text-[11px] ${st === "todo" || st === "skipped" ? "text-ink-mute" : "text-ink-dim"}`}>
              {st === "skipped" ? (key === "prisma" ? "Typed (no STT)" : "Skipped") : label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- editable list

export function ListBlock({
  title,
  items,
  editing,
  onChange,
  tone = "brass",
  empty = "None recorded",
  badge,
}: {
  title: string;
  items: string[];
  editing: boolean;
  onChange: (next: string[]) => void;
  tone?: "brass" | "rust" | "warn" | "taupe" | "ok";
  empty?: string;
  badge?: React.ReactNode;
}) {
  const [draft, setDraft] = useState("");
  const dot = { brass: "bg-brass", rust: "bg-rust", warn: "bg-warn", taupe: "bg-taupe", ok: "bg-ok" }[tone];
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-ink-dim">{title}</h3>
        {badge}
      </div>
      {items.length === 0 && !editing ? (
        <p className="text-sm italic text-ink-mute">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="group flex items-start gap-2.5 text-sm text-ink">
              <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              {editing ? (
                <>
                  <Input
                    value={item}
                    onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
                    className="!h-8 flex-1"
                    aria-label={`${title} item ${i + 1}`}
                  />
                  <button type="button" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))} className="mt-1.5 text-ink-mute hover:text-alert">
                    <XIcon size={16} />
                  </button>
                </>
              ) : (
                <span className="leading-relaxed">{item}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) onChange([...items, draft.trim()]);
            setDraft("");
          }}
        >
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add item…" className="!h-8" aria-label={`Add to ${title}`} />
          <Button3D type="submit" size="sm" variant="neutral" icon={<PlusIcon size={14} />} aria-label="Add" />
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- failure memory results

export function RelatedList({ data, loading, error }: { data?: RelatedResponse; loading?: boolean; error?: unknown }) {
  if (error) return <ErrorBox error={error} />;
  if (loading || !data)
    return (
      <div className="flex items-center gap-3 py-6 text-sm text-ink-mute">
        <MemoryIcon size={22} className="animate-pulse text-brass" /> Scanning failure memory…
      </div>
    );
  if (data.no_match)
    return (
      <EmptyState
        icon={<MemoryIcon size={40} />}
        title="No related history"
        body="No earlier incident in this organisation shares this machine or these symptoms. Nothing is shown rather than unrelated records."
      />
    );
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">
        <ShieldIcon size={15} className="mt-0.5 shrink-0" />
        {data.disclaimer}
      </p>
      <ol className="space-y-3">
        {data.results.map((r) => (
          <li key={r.incident_id}>
            <Link
              to={`/incidents/${r.incident_id}`}
              className="group block rounded-xl border border-line bg-sunk/70 p-4 transition hover:-translate-y-0.5 hover:border-brass/50 hover:shadow-md"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-brass/15 font-display text-xs font-bold text-brass">#{r.rank}</span>
                <MachineTypeIcon type={r.machine.type} size={18} className="text-ink-dim" />
                <span className="font-mono text-sm font-bold text-rust">{r.machine.asset_code}</span>
                <span className="text-xs capitalize text-ink-mute">{r.machine.type}</span>
                <span className="ml-auto font-mono text-xs text-ink-mute">{fmtDate(r.occurred_at)}</span>
              </div>
              <p className="mt-2 text-sm text-ink">{r.summary}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.rationale.map((why) => (
                  <span key={why} className="rounded-md border border-brass/30 bg-brass/5 px-2 py-0.5 text-[11px] text-brass">
                    {why}
                  </span>
                ))}
              </div>
              {r.actions_taken.length > 0 && <p className="mt-2 text-xs text-ink-dim">Actions then: {r.actions_taken.join("; ")}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs">
                {r.outcome ? (
                  <>
                    <StatusPill value={r.outcome.resolution_status} tones={resolutionTone} />
                    <span className="text-ink-dim">
                      {r.outcome.action_performed}
                      {r.outcome.verified_cause ? (
                        <>
                          {" "}
                          · <span className="text-ok">verified cause: {r.outcome.verified_cause}</span>
                        </>
                      ) : (
                        " · cause not verified"
                      )}
                    </span>
                  </>
                ) : (
                  <Pill tone="mute">Outcome unknown/unrecorded</Pill>
                )}
                {r.is_seed && <Pill tone="mute">demo data</Pill>}
                <LinkIcon size={14} className="ml-auto text-ink-mute group-hover:text-brass" />
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- outcome form

export function OutcomeForm({ onSubmit }: { onSubmit: (body: Record<string, unknown>) => Promise<unknown> }) {
  const [f, setF] = useState({ action_performed: "", resolution_status: "resolved" as ResolutionStatus, verified_cause: "", parts: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        action_performed: f.action_performed,
        resolution_status: f.resolution_status,
        verified_cause: f.verified_cause || null,
        parts_used: f.parts.split(",").map((p) => p.trim()).filter(Boolean),
        notes: f.notes || null,
      });
      setF({ action_performed: "", resolution_status: "resolved", verified_cause: "", parts: "", notes: "" });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="What was done?">
          <Textarea required rows={2} value={f.action_performed} onChange={(e) => setF({ ...f, action_performed: e.target.value })} placeholder="Replaced NDE bearing and re-greased" />
        </Field>
      </div>
      <Field label="Result">
        <Select value={f.resolution_status} onChange={(e) => setF({ ...f, resolution_status: e.target.value as ResolutionStatus })}>
          <option value="resolved">Resolved</option>
          <option value="monitoring">Monitoring</option>
          <option value="unresolved">Unresolved</option>
        </Select>
      </Field>
      <Field label="Verified cause" hint="Only if confirmed by inspection; leave blank if unknown">
        <Input value={f.verified_cause} onChange={(e) => setF({ ...f, verified_cause: e.target.value })} />
      </Field>
      <Field label="Parts used" hint="Comma separated">
        <Input value={f.parts} onChange={(e) => setF({ ...f, parts: e.target.value })} placeholder="6205-2RS bearing" />
      </Field>
      <Field label="Notes">
        <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </Field>
      {Boolean(error) && (
        <div className="sm:col-span-2">
          <ErrorBox error={error} />
        </div>
      )}
      <div className="flex justify-end sm:col-span-2">
        <Button3D type="submit" variant="dark" loading={busy} icon={<WrenchIcon size={16} />}>
          Record outcome
        </Button3D>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- audio player (authenticated fetch)

export function AudioPlayer({ incidentId, audioId }: { incidentId: string; audioId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    api
      .blob("GET", `/api/incidents/${incidentId}/audio/${audioId}`)
      .then(({ blob }) => {
        revoked = URL.createObjectURL(blob);
        setUrl(revoked);
      })
      .catch((e) => setError(e.message));
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [incidentId, audioId]);
  if (error) return <span className="text-xs text-ink-mute">{error}</span>;
  if (!url) return <span className="text-xs text-ink-mute">Loading audio…</span>;
  return <audio controls src={url} className="h-10 w-full" />;
}

export { SymptomChip, humanize };
