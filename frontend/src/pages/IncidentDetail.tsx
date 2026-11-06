import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader } from "../components/ui/Loader";
import {
  ArrowLeft,
  BearingIcon,
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  EditIcon,
  GearIcon,
  IncidentIcon,
  KeyboardIcon,
  MachineTypeIcon,
  MemoryIcon,
  RefreshIcon,
  ShieldIcon,
  SpeakerIcon,
  TrashIcon,
  WaveIcon,
  WrenchIcon,
} from "../components/icons/MachineIcons";
import { GuidePanel } from "../components/incident/GuidePanel";
import { AudioPlayer, ListBlock, OutcomeForm, PipelineStepper, RelatedList } from "../components/incident/parts";
import { Button3D } from "../components/ui/Button3D";
import { ConfirmDialog, ErrorBox, Panel, Pill, Select, StatusPill, SymptomChip, Textarea, errorText, useToast } from "../components/ui/kit";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { t } from "../lib/i18n";
import { PROCESSING_ACTIVE, fileSize, fmtDate, humanize, processingTone, resolutionTone, timeAgo, urgencyTone } from "../lib/format";
import type { AuditEvent, IncidentDetail as Inc, RelatedResponse, Urgency } from "../lib/types";

type Draft = Pick<Inc, "summary" | "symptoms" | "observations" | "actions_taken" | "suspected_causes" | "missing_information" | "suggested_checks" | "urgency">;

const draftOf = (i: Inc): Draft => ({
  summary: i.summary ?? "",
  symptoms: i.symptoms,
  observations: i.observations,
  actions_taken: i.actions_taken,
  suspected_causes: i.suspected_causes,
  missing_information: i.missing_information,
  suggested_checks: i.suggested_checks,
  urgency: i.urgency,
});

export default function IncidentDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { user, can } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [transcriptEdit, setTranscriptEdit] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState<null | "incident" | string>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const q = useQuery({
    queryKey: ["incident", id],
    queryFn: () => api.get<Inc>(`/api/incidents/${id}`),
    refetchInterval: (query) => {
      const d = query.state.data;
      return d && (PROCESSING_ACTIVE.includes(d.processing_status) || d.guide_generating) ? 1500 : false;
    },
  });
  const inc = q.data;
  const related = useQuery({
    queryKey: ["related", id, inc?.updated_at],
    queryFn: () => api.get<RelatedResponse>(`/api/incidents/${id}/related`),
    enabled: Boolean(inc?.transcript_original || inc?.transcript_edited),
  });
  const audit = useQuery({
    queryKey: ["audit", id, inc?.updated_at],
    queryFn: () => api.get<AuditEvent[]>(`/api/incidents/${id}/audit`),
    enabled: showAudit,
  });

  // Notify when a background step finishes.
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  useEffect(() => {
    if (!inc) return;
    if (lastStatus && lastStatus !== inc.processing_status) {
      const msgs: Record<string, [ "ok" | "alert", string ]> = {
        transcribed: ["ok", "Transcript ready. Review it, then analyse."],
        awaiting_review: ["ok", "Draft ready for your review."],
        transcription_failed: ["alert", "Transcription failed. Retry or type the transcript."],
        analysis_failed: ["alert", "Analysis failed. Your transcript is safe; retry when ready."],
      };
      const m = msgs[inc.processing_status];
      if (m) toast(m[0], m[1]);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
    setLastStatus(inc.processing_status);
  }, [inc?.processing_status]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = (data?: Inc) => {
    if (data) qc.setQueryData(["incident", id], data);
    else qc.invalidateQueries({ queryKey: ["incident", id] });
    qc.invalidateQueries({ queryKey: ["incidents"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const onErr = (e: unknown) => toast("alert", errorText(e));

  const patch = useMutation({ mutationFn: (body: Partial<Draft> & { transcript_edited?: string }) => api.patch<Inc>(`/api/incidents/${id}`, body), onSuccess: refresh, onError: onErr });
  const analyze = useMutation({ mutationFn: () => api.post(`/api/incidents/${id}/analyze`), onSuccess: () => refresh(), onError: onErr });
  const troubleshoot = useMutation({ mutationFn: () => api.post(`/api/incidents/${id}/troubleshoot`), onSuccess: () => refresh(), onError: onErr });
  const retranscribe = useMutation({ mutationFn: () => api.post(`/api/incidents/${id}/transcribe`), onSuccess: () => refresh(), onError: onErr });
  const confirm = useMutation({
    mutationFn: () => api.post<Inc>(`/api/incidents/${id}/confirm`),
    onSuccess: (d) => {
      refresh(d);
      setConfirmOpen(false);
      toast("ok", "Incident confirmed by technician");
    },
    onError: onErr,
  });
  const outcome = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post(`/api/incidents/${id}/outcome`, body),
    onSuccess: () => {
      refresh();
      toast("ok", "Outcome recorded. It now informs future searches.");
    },
  });
  const remove = useMutation({
    mutationFn: (target: string) =>
      target === "incident" ? api.del(`/api/incidents/${id}`, { confirm: true }) : api.del(`/api/incidents/${id}/audio/${target}`, { confirm: true }),
    onSuccess: (_, target) => {
      setDeleteOpen(null);
      if (target === "incident") {
        qc.invalidateQueries({ queryKey: ["incidents"] });
        toast("ok", "Incident deleted");
        navigate("/incidents");
      } else {
        refresh();
        toast("ok", "Recording deleted");
      }
    },
    onError: onErr,
  });

  const download = async (format: "markdown" | "json") => {
    try {
      const { blob, headers } = await api.blob("GET", `/api/incidents/${id}/export`, { format });
      const name = /filename="([^"]+)"/.exec(headers.get("Content-Disposition") ?? "")?.[1] ?? `incident.${format === "json" ? "json" : "md"}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      onErr(e);
    }
  };
  const speak = async () => {
    setSpeaking(true);
    try {
      const { blob, headers } = await api.blob("POST", `/api/incidents/${id}/speak`);
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onended = () => setSpeaking(false);
      await audio.play();
      if (headers.get("X-Mantiq-Provider-Mode") === "mock") toast("info", "Timbre is in mock mode: playing a test tone.");
    } catch (e) {
      setSpeaking(false);
      onErr(e);
    }
  };

  if (q.isLoading) return <Loader label="Loading incident" />;
  if (q.error || !inc) return <ErrorBox error={q.error ?? new Error("Incident not found")} onRetry={() => q.refetch()} />;

  const busy = PROCESSING_ACTIVE.includes(inc.processing_status);
  const confirmed = inc.review_status === "confirmed";
  const locked = confirmed && user?.role === "technician";
  const transcript = inc.transcript_edited ?? inc.transcript_original;
  const hasDraft = Boolean(inc.analysis_source);
  const d = editing && draft ? draft : draftOf(inc);
  const setD = (k: keyof Draft) => (v: unknown) => setDraft({ ...(draft ?? draftOf(inc)), [k]: v });
  const audio = inc.audio_assets[0];

  return (
    <div className="space-y-6">
      <Link to="/incidents" className="inline-flex items-center gap-2 text-sm text-ink-mute hover:text-ink">
        <ArrowLeft size={16} /> {t("Incidents")}
      </Link>

      {/* header */}
      <section className="surface relative overflow-hidden rounded-xl p-6">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <Link to={`/machines/${inc.machine.id}`} className="group flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-xl border border-line bg-sunk text-brass transition group-hover:">
              <MachineTypeIcon type={inc.machine.type} size={30} />
            </div>
            <div>
              <div className="font-mono text-lg font-bold text-rust">{inc.machine.asset_code}</div>
              <div className="text-sm text-ink-dim">{inc.machine.name}</div>
              <div className="font-mono text-[11px] text-ink-mute">
                {fmtDate(inc.occurred_at, true)} · {t("reported by {name}", { name: inc.reporter?.name ?? t("unknown") })}
              </div>
            </div>
          </Link>
          <div className="flex flex-wrap gap-2">
            <StatusPill value={inc.processing_status} tones={processingTone} />
            <Pill tone={confirmed ? "ok" : "warn"} dot>
              {confirmed ? "technician-confirmed" : "unreviewed"}
            </Pill>
            <StatusPill value={inc.resolution_status} tones={resolutionTone} />
            {inc.urgency !== "unknown" && <StatusPill value={inc.urgency} tones={urgencyTone} />}
            {inc.is_seed && <Pill tone="mute">demo data</Pill>}
          </div>
        </div>
        <div className="relative mt-6">
          <PipelineStepper inc={inc} />
        </div>
      </section>

      {inc.safety_notice && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} role="alert" className="overflow-hidden rounded-xl border border-alert/50 bg-alert/10">
          <div className="hazard-stripe h-1.5" />
          <div className="flex items-start gap-3 p-4 text-sm text-ink">
            <ShieldIcon size={22} className="shrink-0 text-alert" />
            <span>{t(inc.safety_notice)}</span>
          </div>
        </motion.div>
      )}

      {/* failure states */}
      {inc.processing_status === "transcription_failed" && (
        <Panel title="Transcription failed" icon={<IncidentIcon size={18} />}>
          <p className="text-sm text-ink-dim">{t(inc.jobs.filter((j) => j.provider === "prisma").at(-1)?.safe_error_message ?? "Prisma could not transcribe this recording.")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {audio?.retention_status === "retained" && (
              <Button3D variant="dark" icon={<RefreshIcon size={16} />} loading={retranscribe.isPending} onClick={() => retranscribe.mutate()}>
                Retry Prisma
              </Button3D>
            )}
            <Button3D variant="neutral" icon={<KeyboardIcon size={16} />} onClick={() => setTranscriptEdit("")}>
              Type transcript instead
            </Button3D>
          </div>
        </Panel>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          {/* transcript */}
          <Panel
            title="Transcript"
            icon={<WaveIcon size={18} />}
            tag={<span className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">{(inc.provenance?.transcript ?? "").split("; ").map((part) => t(part)).join("; ")}</span>}
            actions={
              transcript &&
              !busy &&
              !locked &&
              transcriptEdit === null && (
                <Button3D size="sm" variant="ghost" icon={<EditIcon size={14} />} onClick={() => setTranscriptEdit(transcript)}>
                  Correct
                </Button3D>
              )
            }
          >
            {inc.processing_status === "transcribing" ? (
              <div className="flex items-center gap-3 py-6 text-sm text-brass">
                <GearIcon size={22} className="animate-spin" /> {t("Gnani Prisma is transcribing the voice note…")}
              </div>
            ) : transcriptEdit !== null ? (
              <div className="space-y-3">
                <Textarea rows={6} value={transcriptEdit} onChange={(e) => setTranscriptEdit(e.target.value)} aria-label={t("Transcript")} autoFocus />
                {inc.transcript_original && <p className="text-xs text-ink-mute">{t("The original transcript is kept for provenance. Clearing the box reverts to it.")}</p>}
                <div className="flex justify-end gap-2">
                  <Button3D size="sm" variant="ghost" onClick={() => setTranscriptEdit(null)}>Cancel</Button3D>
                  <Button3D
                    size="sm"
                    variant="dark"
                    loading={patch.isPending}
                    onClick={() => patch.mutate({ transcript_edited: transcriptEdit }, { onSuccess: () => setTranscriptEdit(null) })}
                  >
                    Save transcript
                  </Button3D>
                </div>
              </div>
            ) : transcript ? (
              <div className="space-y-3">
                <blockquote className="rounded-xl border-l-2 border-brass bg-sunk/80 p-4 text-[15px] leading-relaxed text-ink">{transcript}</blockquote>
                {inc.transcript_edited && inc.transcript_original && (
                  <details className="text-xs text-ink-mute">
                    <summary className="cursor-pointer hover:text-ink">{t("Original transcript")}</summary>
                    <p className="mt-2 rounded-lg bg-sunk p-3 leading-relaxed">{inc.transcript_original}</p>
                  </details>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-mute">{t("No transcript yet.")}</p>
            )}
            {audio && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                {audio.retention_status === "retained" ? (
                  <>
                    <div className="min-w-[220px] flex-1">
                      <AudioPlayer incidentId={inc.id} audioId={audio.id} />
                    </div>
                    <span className="font-mono text-[11px] text-ink-mute">
                      {audio.duration_seconds ? `${audio.duration_seconds.toFixed(1)}s · ` : ""}
                      {fileSize(audio.size_bytes)} · {t("auto-deletes {date}", { date: fmtDate(audio.delete_after) })}
                    </span>
                    <Button3D size="sm" variant="ghost" icon={<TrashIcon size={14} />} onClick={() => setDeleteOpen(audio.id)} aria-label={t("Delete recording")} />
                  </>
                ) : (
                  <span className="text-xs text-ink-mute">{t("Recording deleted {when} under the retention policy. The transcript is kept.", { when: timeAgo(audio.deleted_at) })}</span>
                )}
              </div>
            )}
            {transcript && !busy && !confirmed && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <Button3D variant="primary" icon={<BearingIcon size={16} />} loading={analyze.isPending} onClick={() => analyze.mutate()}>
                  {hasDraft ? "Re-run Evon analysis" : "Analyse with Evon"}
                </Button3D>
                <span className="text-xs text-ink-mute">{t("Correct the transcript first. Evon only works from what is written here.")}</span>
              </div>
            )}
          </Panel>

          {/* draft */}
          <Panel
            title="Incident draft"
            icon={<BearingIcon size={18} />}
            tag={
              <Pill tone={confirmed ? "ok" : "warn"} className="!normal-case !tracking-normal">
                {t(inc.provenance?.structured_fields ?? "")}
              </Pill>
            }
            actions={
              hasDraft &&
              !busy &&
              !locked &&
              (editing ? (
                <>
                  <Button3D size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(null); }}>Cancel</Button3D>
                  <Button3D
                    size="sm"
                    variant="dark"
                    loading={patch.isPending}
                    onClick={() => draft && patch.mutate(draft, { onSuccess: () => { setEditing(false); setDraft(null); toast("ok", "Draft saved"); } })}
                  >
                    Save
                  </Button3D>
                </>
              ) : (
                <Button3D size="sm" variant="ghost" icon={<EditIcon size={14} />} onClick={() => { setDraft(draftOf(inc)); setEditing(true); }}>
                  Edit
                </Button3D>
              ))
            }
          >
            {inc.processing_status === "analyzing" ? (
              <div className="flex items-center gap-3 py-6 text-sm text-taupe">
                <GearIcon size={22} className="animate-spin" /> {t("Gnani Evon is drafting the incident and checking it against failure memory…")}
              </div>
            ) : inc.processing_status === "analysis_failed" ? (
              <div className="space-y-3">
                <ErrorBox error={new Error(inc.jobs.filter((j) => j.provider === "evon").at(-1)?.safe_error_message ?? "Analysis failed")} />
                <p className="text-sm text-ink-mute">{t("Your transcript is safe. Retry the analysis from the transcript panel.")}</p>
              </div>
            ) : !hasDraft ? (
              <p className="text-sm text-ink-mute">{t("Not analysed yet. Review the transcript, then run Evon.")}</p>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-dim">{t("Summary")}</h3>
                  {editing ? (
                    <Textarea rows={2} value={d.summary ?? ""} onChange={(e) => setD("summary")(e.target.value)} />
                  ) : (
                    <p className="text-base text-ink">{inc.summary}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {inc.symptom_tags.map((t) => <SymptomChip key={t} tag={t} />)}
                  {editing ? (
                    <Select value={d.urgency} onChange={(e) => setD("urgency")(e.target.value as Urgency)} className="!h-8 !w-auto text-xs" aria-label={t("Urgency")}>
                      {["unknown", "needs_review", "routine", "urgent"].map((u) => <option key={u} value={u}>{t(humanize(u))}</option>)}
                    </Select>
                  ) : null}
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <ListBlock title="Symptoms" items={d.symptoms} editing={editing} onChange={setD("symptoms")} tone="rust" />
                  <ListBlock title="Observations (reported)" items={d.observations} editing={editing} onChange={setD("observations")} />
                  <ListBlock title="Actions already taken" items={d.actions_taken} editing={editing} onChange={setD("actions_taken")} tone="ok" />
                  <ListBlock
                    title="Suspected causes"
                    items={d.suspected_causes}
                    editing={editing}
                    onChange={setD("suspected_causes")}
                    tone="taupe"
                    badge={<Pill tone="taupe">hypotheses, not verified</Pill>}
                  />
                  <ListBlock title="Missing information" items={d.missing_information} editing={editing} onChange={setD("missing_information")} tone="warn" empty="Nothing flagged" />
                  <ListBlock
                    title="Suggested checks"
                    items={d.suggested_checks}
                    editing={editing}
                    onChange={setD("suggested_checks")}
                    badge={<Pill tone="mute">advisory · follow site procedures</Pill>}
                  />
                </div>
                {(inc.analysis_warnings.length > 0 || inc.confidence_notes) && (
                  <div className="space-y-1.5 rounded-xl border border-line bg-sunk/70 p-3 text-xs text-ink-mute">
                    {inc.analysis_warnings.map((w) => <p key={w} className="text-warn">⚠ {t(w)}</p>)}
                    {inc.confidence_notes && <p>{t(inc.confidence_notes)}</p>}
                  </div>
                )}
                {!confirmed && !editing && (
                  <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                    <Button3D variant="primary" size="lg" icon={<CheckIcon size={18} />} onClick={() => setConfirmOpen(true)}>
                      Confirm incident
                    </Button3D>
                    <span className="text-xs text-ink-mute">{t("Confirming marks these fields as technician-reviewed.")}</span>
                  </div>
                )}
                {confirmed && (
                  <p className="text-xs text-ok">
                    {t("Confirmed by {name} {when}.", { name: inc.confirmed_by?.name ?? t("a technician"), when: timeAgo(inc.confirmed_at) })}
                  </p>
                )}
              </div>
            )}
          </Panel>

          {/* outcomes */}
          <Panel title="Maintenance outcome" icon={<WrenchIcon size={18} />} tag={<span className="text-[11px] text-ink-mute">{t(inc.provenance?.outcome ?? "")}</span>}>
            {inc.outcomes.length > 0 && (
              <ol className="mb-5 space-y-3">
                {inc.outcomes.map((o) => (
                  <li key={o.id} className="rounded-xl border border-line bg-sunk/70 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill value={o.resolution_status} tones={resolutionTone} />
                      <span className="font-mono text-xs text-ink-mute">
                        {fmtDate(o.resolved_at ?? o.created_at, true)} · {o.verified_by?.name}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ink">{o.action_performed}</p>
                    <p className="mt-1 text-xs">
                      {o.verified_cause ? <span className="text-ok">{t("Verified cause:")} {o.verified_cause}</span> : <span className="text-ink-mute">{t("Cause not verified")}</span>}
                      {o.parts_used.length > 0 && <span className="text-ink-mute"> · {t("Parts:")} {o.parts_used.join(", ")}</span>}
                    </p>
                    {o.notes && <p className="mt-1 text-xs text-ink-mute">{o.notes}</p>}
                  </li>
                ))}
              </ol>
            )}
            {inc.resolution_status !== "resolved" ? (
              <OutcomeForm onSubmit={outcome.mutateAsync} />
            ) : (
              <p className="text-sm text-ink-mute">{t("Resolved. Record another outcome only if the fault returns, as a new incident.")}</p>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <GuidePanel inc={inc} onGenerate={() => troubleshoot.mutate()} busy={troubleshoot.isPending} />
          <Panel title="Failure memory" icon={<MemoryIcon size={18} />} tag={<span className="text-[11px] text-ink-mute">{t("related past incidents")}</span>}>
            {transcript ? (
              <RelatedList data={related.data} loading={related.isLoading} error={related.error} />
            ) : (
              <p className="text-sm text-ink-mute">{t("Related history appears once a transcript exists.")}</p>
            )}
          </Panel>

          <Panel title="Actions" icon={<GearIcon size={18} />}>
            <div className="flex flex-wrap gap-2">
              <Button3D size="sm" variant="neutral" icon={<DownloadIcon size={14} />} onClick={() => download("markdown")}>Export report</Button3D>
              <Button3D size="sm" variant="neutral" icon={<DownloadIcon size={14} />} onClick={() => download("json")}>JSON</Button3D>
              {inc.summary && (
                <Button3D size="sm" variant="dark" icon={<SpeakerIcon size={14} />} loading={speaking} onClick={speak}>
                  Read aloud
                </Button3D>
              )}
              {can("admin", "supervisor") && (
                <Button3D size="sm" variant="danger" icon={<TrashIcon size={14} />} onClick={() => setDeleteOpen("incident")}>Delete</Button3D>
              )}
            </div>
          </Panel>

          <Panel title="AI processing log" icon={<ClockIcon size={18} />}>
            {inc.jobs.length === 0 ? (
              <p className="text-sm text-ink-mute">{t("No AI calls yet.")}</p>
            ) : (
              <ul className="space-y-2">
                {inc.jobs.map((j) => (
                  <li key={j.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-sunk/70 px-3 py-2 text-xs">
                    <span className="font-mono font-bold uppercase text-ink">{j.provider}</span>
                    <Pill tone={j.mode === "live" ? "ok" : "warn"}>{j.mode}</Pill>
                    <Pill tone={j.status === "succeeded" ? "ok" : j.status === "failed" ? "alert" : "brass"}>{j.status}</Pill>
                    <span className="font-mono text-ink-mute">{j.model}</span>
                    {j.latency_ms != null && <span className="ml-auto font-mono text-ink-mute">{j.latency_ms} ms</span>}
                    {j.safe_error_message && <span className="w-full text-alert">{t(j.safe_error_message)}</span>}
                  </li>
                ))}
              </ul>
            )}
            <button className="mt-4 text-xs text-brass hover:underline" onClick={() => setShowAudit((s) => !s)}>
              {t(showAudit ? "Hide audit trail" : "Show audit trail")}
            </button>
            <AnimatePresence>
              {showAudit && (
                <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 space-y-1.5 overflow-hidden">
                  {audit.data?.map((a) => (
                    <li key={a.id} className="flex gap-2 text-xs">
                      <span className="w-28 shrink-0 font-mono text-ink-mute">{fmtDate(a.created_at, true)}</span>
                      <span className="text-ink-dim">
                        {a.actor?.name ?? t("system")} · <span className="text-ink">{t(humanize(a.action))}</span>
                      </span>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm this incident?"
        body="You are confirming that the summary, symptoms, observations and actions match what happened. Suspected causes stay labelled as hypotheses."
        confirmLabel="Confirm"
        busy={confirm.isPending}
        onConfirm={() => confirm.mutate()}
        onClose={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={deleteOpen !== null}
        danger
        title={deleteOpen === "incident" ? "Delete incident permanently?" : "Delete recording?"}
        body={
          deleteOpen === "incident"
            ? "The incident, its outcomes and its recording will be removed and cannot be recovered."
            : "The audio file will be deleted. The transcript and incident stay."
        }
        confirmLabel="Delete"
        busy={remove.isPending}
        onConfirm={() => deleteOpen && remove.mutate(deleteOpen)}
        onClose={() => setDeleteOpen(null)}
      />
    </div>
  );
}
