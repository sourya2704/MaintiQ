import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fmtDate, timeAgo } from "../../lib/format";
import type { IncidentDetail } from "../../lib/types";
import { BearingIcon, CheckIcon, GearIcon, RefreshIcon, ShieldIcon, WrenchIcon, XIcon } from "../icons/MachineIcons";
import { Button3D } from "../ui/Button3D";
import { Panel, Pill } from "../ui/kit";

const LIKELIHOOD_TONE = { higher: "rust", possible: "warn", "less likely": "mute" } as const;

/** Per-viewer step ticks, kept in this browser only (a working checklist, not part of the record). */
function useTicks(incidentId: string, generatedAt: string | null) {
  const key = `mantiq.guide.${incidentId}.${generatedAt}`;
  const [ticks, setTicks] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(ticks));
    } catch {
      /* storage unavailable */
    }
  }, [key, ticks]);
  return [ticks, (n: number) => setTicks((t) => (t.includes(n) ? t.filter((x) => x !== n) : [...t, n]))] as const;
}

export function GuidePanel({ inc, onGenerate, busy }: { inc: IncidentDetail; onGenerate: () => void; busy: boolean }) {
  const g = inc.guide;
  const [ticks, toggle] = useTicks(inc.id, inc.guide_generated_at);
  const hasTranscript = Boolean(inc.transcript_original || inc.transcript_edited);
  const generating = inc.guide_generating || busy;
  const lastFailure = inc.jobs.filter((j) => j.task === "troubleshooting").at(-1);

  return (
    <Panel
      title="Troubleshooting guide"
      icon={<WrenchIcon size={18} />}
      tag={<Pill tone="taupe">{inc.guide_source === "evon_mock" ? "AI-suggested · Evon mock" : "AI-suggested · advisory"}</Pill>}
      actions={
        g &&
        !generating && (
          <Button3D size="sm" variant="ghost" icon={<RefreshIcon size={14} />} onClick={onGenerate}>
            Regenerate
          </Button3D>
        )
      }
    >
      {generating ? (
        <div className="flex items-center gap-3 py-4 text-sm text-ink-dim">
          <GearIcon size={20} className="animate-spin text-rust" /> Gnani Evon is working through the report and this plant's history…
        </div>
      ) : !g ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-dim">
            Get ranked likely causes, a safe order of checks, parts to bring and when to escalate. Grounded in this report and in
            fixes your team has verified before.
          </p>
          {lastFailure?.status === "failed" && <p className="text-sm text-alert">{lastFailure.safe_error_message}</p>}
          <Button3D variant="primary" icon={<BearingIcon size={16} />} disabled={!hasTranscript} onClick={onGenerate}>
            Generate guide
          </Button3D>
          {!hasTranscript && <p className="text-xs text-ink-mute">Available once the incident has a transcript.</p>}
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-[15px] text-ink">{g.summary}</p>
          <p className="flex items-start gap-2 rounded-lg border border-warn/35 bg-warn/10 px-3 py-2 text-xs text-ink-dim">
            <ShieldIcon size={15} className="mt-0.5 shrink-0 text-warn" />
            {g.disclaimer}
          </p>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-dim">Likely causes</h3>
            <ol className="space-y-2">
              {g.likely_causes.map((c) => (
                <li key={c.cause} className="rounded-lg border border-line bg-sunk/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={LIKELIHOOD_TONE[c.likelihood]}>{c.likelihood}</Pill>
                    <span className="font-semibold text-ink">{c.cause}</span>
                  </div>
                  {c.evidence.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-sm text-ink-dim">
                      {c.evidence.map((e) => (
                        <li key={e}>· {e}</li>
                      ))}
                    </ul>
                  )}
                  {c.history.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.history.map((h) => (
                        <Link
                          key={h.ref}
                          to={`/incidents/${h.incident_id}`}
                          className="rounded-md border border-ok/35 bg-ok/10 px-2 py-0.5 text-xs text-ok hover:underline"
                        >
                          {h.verified_cause ? "Verified fix" : "Past incident"} · {h.asset_code} · {fmtDate(h.date)}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-dim">
              Checks, in order <span className="font-normal normal-case text-ink-mute">· tick as you go (saved in this browser only)</span>
            </h3>
            <ol className="space-y-2">
              {g.steps.map((s) => {
                const done = ticks.includes(s.order);
                return (
                  <li key={s.order}>
                    <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${done ? "border-ok/35 bg-ok/5" : "border-line hover:bg-card-2"}`}>
                      <input type="checkbox" checked={done} onChange={() => toggle(s.order)} className="mt-1 accent-[#5f7a3a]" />
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-semibold ${done ? "text-ink-mute line-through" : "text-ink"}`}>
                          {s.order}. {s.action}
                        </div>
                        {s.why && <div className="mt-0.5 text-sm text-ink-dim">{s.why}</div>}
                        {s.expected_finding && <div className="mt-0.5 text-xs text-ink-mute">Expect: {s.expected_finding}</div>}
                        {s.safety && <Pill tone="alert" className="mt-1.5">{s.safety}</Pill>}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ol>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            {g.parts_to_have.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-dim">Parts to have on hand</h3>
                <div className="flex flex-wrap gap-1.5">
                  {g.parts_to_have.map((p) => (
                    <span key={p} className="rounded-md border border-line bg-sunk px-2 py-1 text-xs text-ink-dim">
                      {p}
                    </span>
                  ))}
                </div>
              </section>
            )}
            {g.escalate_if.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-alert">Stop and escalate if</h3>
                <ul className="space-y-1 text-sm text-ink-dim">
                  {g.escalate_if.map((e) => (
                    <li key={e} className="flex gap-2">
                      <ShieldIcon size={14} className="mt-0.5 shrink-0 text-alert" /> {e}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          {g.do_not.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-dim">Do not</h3>
              <ul className="space-y-1 text-sm text-ink-dim">
                {g.do_not.map((d) => (
                  <li key={d} className="flex gap-2">
                    <XIcon size={14} className="mt-0.5 shrink-0 text-alert" /> {d}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="space-y-1 border-t border-line pt-3 text-xs text-ink-mute">
            {g.warnings.map((w) => (
              <p key={w} className="text-warn">
                ⚠ {w}
              </p>
            ))}
            {g.confidence_notes && <p>{g.confidence_notes}</p>}
            <p className="flex items-center gap-1">
              <CheckIcon size={12} /> Generated {timeAgo(inc.guide_generated_at)}. Record what actually fixed it under Maintenance outcome.
            </p>
          </div>
        </div>
      )}
    </Panel>
  );
}
