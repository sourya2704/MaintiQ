import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClockIcon, EditIcon, MachineTypeIcon, MicIcon, SymptomIcon, WrenchIcon, machineKind } from "../components/icons/MachineIcons";
import { MachineForm, type MachineInput } from "../components/MachineForm";
import { Loader } from "../components/ui/Loader";
import { Button3D } from "../components/ui/Button3D";
import { EmptyState, ErrorBox, Panel, Pill, StatusPill, useToast } from "../components/ui/kit";
import { api } from "../lib/api";
import { t } from "../lib/i18n";
import { fmtDate, humanize, machineStatusTone, resolutionTone, timeAgo, urgencyTone } from "../lib/format";
import type { IncidentListItem, Machine, MachineDetail as MD, Page } from "../lib/types";

const MachineViewer = lazy(() => import("../components/three/MachineViewer"));
const OPEN = new Set(["open", "monitoring", "unresolved"]);

export default function MachineDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const { data: m, isLoading, error, refetch } = useQuery({ queryKey: ["machine", id], queryFn: () => api.get<MD>(`/api/machines/${id}`) });
  const openIncidents = useQuery({
    queryKey: ["incidents", "machine", id],
    queryFn: () => api.get<Page<IncidentListItem>>("/api/incidents", { machine_id: id, page_size: 100 }),
  });
  const update = useMutation({
    mutationFn: (body: MachineInput) => api.patch<Machine>(`/api/machines/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine", id] });
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast("ok", "Machine updated");
      setEditing(false);
    },
  });

  if (isLoading) return <Loader label="Loading machine" />;
  if (error || !m) return <ErrorBox error={error ?? new Error("Machine not found")} onRetry={() => refetch()} />;

  // Effects on the 3D model come from symptoms on this machine's still-open incidents.
  const openTags = new Set(
    (openIncidents.data?.items ?? []).filter((i) => OPEN.has(i.resolution_status)).flatMap((i) => i.symptom_tags),
  );

  return (
    <div className="space-y-6">
      <Link to="/machines" className="inline-flex items-center gap-2 text-sm text-ink-mute hover:text-ink">
        <ArrowLeft size={16} /> {t("Machines")}
      </Link>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="surface relative h-[380px] overflow-hidden rounded-xl sm:h-[440px]">
          <Suspense fallback={<Loader label="Rendering model" />}>
            <MachineViewer className="absolute inset-0" kind={machineKind(m.type)} status={m.status} symptoms={[...openTags]} />
          </Suspense>
          <div className="pointer-events-none absolute left-4 top-4 font-mono text-[10px] text-ink-mute">
            {t("Drag to orbit · scroll to turn")}
          </div>
          {openTags.size > 0 && (
            <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap gap-1.5">
              {[...openTags].map((tag) => (
                <span key={tag} className="flex items-center gap-1 rounded-md bg-canvas/80 px-2 py-1 text-[11px] text-rust backdrop-blur">
                  <SymptomIcon tag={tag} size={13} /> {t(humanize(tag))}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="surface rounded-xl p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="group flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-line bg-sunk text-brass">
                  <MachineTypeIcon type={m.type} size={26} />
                </div>
                <div>
                  <div className="font-mono text-lg font-bold text-rust">{m.asset_code}</div>
                  <h1 className="font-display text-xl font-bold">{m.name}</h1>
                </div>
              </div>
              <StatusPill value={m.status} tones={machineStatusTone} />
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                ["Type", m.type],
                ["Location", m.location],
                ["Manufacturer", m.manufacturer],
                ["Model", m.model],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] text-ink-mute">{t(k ?? "")}</dt>
                  <dd className="capitalize text-ink">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-sunk p-3">
                <div className="text-[11px] text-ink-mute">{t("Incidents")}</div>
                <div className="font-display text-2xl font-bold text-brass">{m.incident_count}</div>
              </div>
              <div className="rounded-xl border border-line bg-sunk p-3">
                <div className="text-[11px] text-ink-mute">{t("Open")}</div>
                <div className={`font-display text-2xl font-bold ${m.open_incident_count ? "text-rust" : "text-ok"}`}>{m.open_incident_count}</div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button3D variant="primary" icon={<MicIcon size={16} />} onClick={() => navigate(`/report?machine=${m.id}`)}>
                Report fault
              </Button3D>
              <Button3D variant="neutral" icon={<EditIcon size={16} />} onClick={() => setEditing((e) => !e)}>
                Edit
              </Button3D>
            </div>
          </div>

          <Panel title="Recurring symptoms" icon={<WrenchIcon size={18} />}>
            {m.recurring_symptoms.length === 0 ? (
              <p className="text-sm text-ink-mute">{t("No symptoms recorded on this machine yet.")}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {m.recurring_symptoms.map((s) => (
                  <li key={s.tag} className="group flex items-center gap-2 rounded-lg border border-line bg-sunk px-3 py-2 text-sm">
                    <SymptomIcon tag={s.tag} size={16} className="text-rust" />
                    <span className="capitalize">{t(humanize(s.tag))}</span>
                    <span className="rounded bg-card-2 px-1.5 font-mono text-xs text-brass">×{s.count}</span>
                    <span className="text-[11px] text-ink-mute">{timeAgo(s.last_seen)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </section>

      {editing && (
        <Panel title="Edit machine" icon={<EditIcon size={18} />}>
          <MachineForm initial={m} submitLabel="Save changes" onSubmit={update.mutateAsync} onCancel={() => setEditing(false)} />
        </Panel>
      )}

      <Panel title="Incident timeline" icon={<ClockIcon size={18} />}>
        {m.timeline.length === 0 ? (
          <EmptyState title="No history yet" body="Incidents reported on this machine will appear here in order." />
        ) : (
          <ol className="relative ml-3 border-l border-line-strong">
            {m.timeline.map((e) => (
              <li
                key={e.id}
                className="relative pb-6 pl-6 last:pb-0"
              >
                <span
                  className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-canvas ${
                    e.resolution_status === "resolved" ? "bg-ok" : e.resolution_status === "unresolved" ? "bg-alert" : "bg-rust"
                  }`}
                />
                <Link to={`/incidents/${e.id}`} className="group block rounded-xl border border-transparent p-3 transition hover:border-line hover:bg-card-2/50">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-ink-mute">{fmtDate(e.occurred_at, true)}</span>
                    <StatusPill value={e.resolution_status} tones={resolutionTone} />
                    {e.urgency === "urgent" && <StatusPill value="urgent" tones={urgencyTone} />}
                    {e.review_status === "draft" && <Pill tone="warn">unreviewed</Pill>}
                  </div>
                  <div className="mt-1.5 text-sm text-ink group-hover:text-rust-deep">{e.summary ?? t("Awaiting transcript…")}</div>
                  <div className="mt-1 text-xs text-ink-mute">
                    {e.outcome_summary ? (
                      <span className="text-ok">{t("Outcome")} · {e.outcome_summary}</span>
                    ) : (
                      t("Outcome unknown/unrecorded")
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
