import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fmtDate, timeAgo } from "../../lib/format";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { t, useLanguage } from "../../lib/i18n";
import type { Contact, TroubleshootingGuide } from "../../lib/types";
import type { IncidentDetail } from "../../lib/types";
import { BearingIcon, CheckIcon, GearIcon, IncidentIcon, LinkIcon, RefreshIcon, SendIcon, ShieldIcon, WrenchIcon, XIcon } from "../icons/MachineIcons";
import { Button3D } from "../ui/Button3D";
import { ErrorBox, Field, Panel, Pill, Select, Textarea, errorText, useToast } from "../ui/kit";

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

/** Supervisor picks a mechanic; the steps arrive in the mechanic's messages, in their language. */
function SendFixDialog({ incidentId, onClose }: { incidentId: string; onClose: () => void }) {
  const toast = useToast();
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: () => api.get<Contact[]>("/api/messages/contacts") });
  const people = [...(contacts.data ?? [])].sort((a, b) => Number(b.role === "technician") - Number(a.role === "technician"));
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const send = useMutation({
    mutationFn: () => api.post("/api/messages", { recipient_id: to || people[0]?.id, body: note, incident_id: incidentId, send_fix: true }),
    onSuccess: () => {
      toast("ok", "Fix sent");
      onClose();
    },
    onError: (e) => toast("alert", errorText(e)),
  });
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-espresso/50 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={t("Send fix to a mechanic")}
        initial={{ y: 30 }}
        animate={{ y: 0 }}
        exit={{ y: 30 }}
        className="surface w-full max-w-md space-y-4 rounded-t-2xl p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-xl font-semibold">{t("Send fix to a mechanic")}</h3>
        <p className="text-sm text-ink-dim">{t("They get these steps in Messages, translated into the language they use.")}</p>
        {contacts.error && <ErrorBox error={contacts.error} />}
        <Field label="Send to">
          <Select value={to || people[0]?.id || ""} onChange={(e) => setTo(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({t(p.role)})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note" hint="Optional">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("e.g. Please do this before the night shift")} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button3D variant="ghost" onClick={onClose}>
            Cancel
          </Button3D>
          <Button3D variant="primary" icon={<SendIcon size={16} />} loading={send.isPending} disabled={!people.length} onClick={() => send.mutate()}>
            Send fix
          </Button3D>
        </div>
      </motion.div>
    </motion.div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  gemini: "Suggested by Gemini, checked against the web",
  evon: "Suggested by Gnani Evon",
  evon_mock: "Built-in maintenance guide",
};

export function GuidePanel({ inc, onGenerate, busy }: { inc: IncidentDetail; onGenerate: () => void; busy: boolean }) {
  const { lang } = useLanguage();
  const { can } = useAuth();
  const [sending, setSending] = useState(false);
  // Shown in the reader's language; the server translates once and keeps it.
  const translated = useQuery({
    queryKey: ["guide", inc.id, inc.guide_generated_at, lang],
    queryFn: () => api.get<{ guide: TroubleshootingGuide; translated: boolean }>(`/api/incidents/${inc.id}/guide`, { lang }),
    enabled: Boolean(inc.guide) && !inc.guide_generating && lang !== "en",
    staleTime: Infinity,
  });
  const g = translated.data?.guide ?? inc.guide;
  const [ticks, toggle] = useTicks(inc.id, inc.guide_generated_at);
  const hasTranscript = Boolean(inc.transcript_original || inc.transcript_edited);
  const generating = inc.guide_generating || busy;
  const lastFailure = inc.jobs.filter((j) => j.task === "troubleshooting").at(-1);

  return (
    <Panel
      title="Troubleshooting guide"
      icon={<WrenchIcon size={18} />}
      tag={g ? <Pill tone="taupe">{SOURCE_LABEL[inc.guide_source ?? ""] ?? "AI suggestion"}</Pill> : undefined}
      actions={
        g &&
        !generating && (
          <>
            {can("admin", "supervisor") && (
              <Button3D size="sm" variant="dark" icon={<SendIcon size={14} />} onClick={() => setSending(true)}>
                Send to mechanic
              </Button3D>
            )}
            <Button3D size="sm" variant="ghost" icon={<RefreshIcon size={14} />} onClick={onGenerate}>
              Regenerate
            </Button3D>
          </>
        )
      }
    >
      {generating ? (
        <div className="flex items-center gap-3 py-4 text-sm text-ink-dim">
          <GearIcon size={20} className="animate-spin text-rust" /> {t("Checking this plant's past fixes and published repair guidance…")}
        </div>
      ) : !g ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-dim">
            {t("Get ranked likely causes, a safe order of checks, parts to bring and when to escalate. Grounded in this report and in fixes your team has verified before.")}
          </p>
          {lastFailure?.status === "failed" && <p className="text-sm text-alert">{t(lastFailure.safe_error_message ?? "")}</p>}
          <Button3D variant="primary" icon={<BearingIcon size={16} />} disabled={!hasTranscript} onClick={onGenerate}>
            Generate guide
          </Button3D>
          {!hasTranscript && <p className="text-xs text-ink-mute">{t("Available once the incident has a transcript.")}</p>}
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-[15px] text-ink">{g.summary}</p>
          {g.fixed_before && g.fixed_before.length > 0 && (
            <section className="rounded-lg bg-ok/10 p-3">
              <h3 className="mb-2 text-sm font-semibold text-[#4a6129]">{t("Fixed before at this plant")}</h3>
              <ul className="space-y-2">
                {g.fixed_before.map((f) => (
                  <li key={f.ref} className="text-sm text-ink">
                    <Link to={`/incidents/${f.incident_id}`} className="font-mono text-xs font-bold text-rust hover:underline">
                      {f.asset_code} · {fmtDate(f.date)}
                    </Link>
                    <div>{f.outcome_action}</div>
                    {f.verified_cause && <div className="text-xs text-ink-mute">{t("Cause:")} {f.verified_cause}</div>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="flex items-start gap-2 rounded-lg border border-warn/35 bg-warn/10 px-3 py-2 text-xs text-ink-dim">
            <ShieldIcon size={15} className="mt-0.5 shrink-0 text-warn" />
            {t(g.disclaimer)}
          </p>

          <section>
            <h3 className="mb-2 text-xs font-bold text-ink-dim">{t("Likely causes")}</h3>
            <ol className="space-y-2">
              {g.likely_causes.map((c) => (
                <li key={c.cause} className="rounded-lg border border-line bg-sunk/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={LIKELIHOOD_TONE[c.likelihood]}>{t(c.likelihood)}</Pill>
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
                          {t(h.verified_cause ? "Verified fix" : "Past incident")} · {h.asset_code} · {fmtDate(h.date)}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold text-ink-dim">
              {t("Checks, in order")} <span className="font-normal normal-case text-ink-mute">· {t("tick as you go (saved in this browser only)")}</span>
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
                          {s.order}. {t(s.action)}
                        </div>
                        {s.why && <div className="mt-0.5 text-sm text-ink-dim">{t(s.why)}</div>}
                        {s.expected_finding && <div className="mt-0.5 text-xs text-ink-mute">{t("Expect:")} {t(s.expected_finding)}</div>}
                        {s.safety && <Pill tone="alert" className="mt-1.5">{t(s.safety)}</Pill>}
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
                <h3 className="mb-2 text-xs font-bold text-ink-dim">{t("Parts to have on hand")}</h3>
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
                <h3 className="mb-2 text-xs font-bold text-alert">{t("Stop and escalate if")}</h3>
                <ul className="space-y-1 text-sm text-ink-dim">
                  {g.escalate_if.map((e) => (
                    <li key={e} className="flex gap-2">
                      <ShieldIcon size={14} className="mt-0.5 shrink-0 text-alert" /> {t(e)}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          {g.do_not.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold text-ink-dim">{t("Do not")}</h3>
              <ul className="space-y-1 text-sm text-ink-dim">
                {g.do_not.map((d) => (
                  <li key={d} className="flex gap-2">
                    <XIcon size={14} className="mt-0.5 shrink-0 text-alert" /> {t(d)}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {g.sources && g.sources.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold text-ink-dim">{t("Checked against")}</h3>
              <ul className="space-y-1">
                {g.sources.map((src) => (
                  <li key={src.url}>
                    <a href={src.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-sm text-brass hover:underline">
                      <LinkIcon size={13} /> {src.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="space-y-1 border-t border-line pt-3 text-xs text-ink-mute">
            {g.warnings.map((w) => (
              <p key={w} className="flex gap-1.5 text-warn">
                <IncidentIcon size={13} className="mt-0.5 shrink-0" /> {t(w)}
              </p>
            ))}
            {g.confidence_notes && <p>{t(g.confidence_notes)}</p>}
            <p className="flex items-center gap-1">
              <CheckIcon size={12} /> {t("Generated {when}. Record what actually fixed it under Maintenance outcome.", { when: timeAgo(inc.guide_generated_at) })}
            </p>
          </div>
        </div>
      )}
      <AnimatePresence>{sending && <SendFixDialog incidentId={inc.id} onClose={() => setSending(false)} />}</AnimatePresence>
    </Panel>
  );
}
