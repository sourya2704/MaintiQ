import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IncidentIcon, MicIcon, SearchBoltIcon } from "../components/icons/MachineIcons";
import { IncidentRow } from "../components/incident/IncidentRow";
import { PageHeader } from "../components/layout/AppShell";
import { Button3D } from "../components/ui/Button3D";
import { EmptyState, ErrorBox, Input, Panel, Select, Skeleton } from "../components/ui/kit";
import { api } from "../lib/api";
import { humanize } from "../lib/format";
import { t } from "../lib/i18n";
import type { IncidentListItem, Machine, Page } from "../lib/types";

const FILTERS = {
  resolution_status: ["open", "monitoring", "resolved", "unresolved"],
  review_status: ["draft", "confirmed"],
  processing_status: ["transcribing", "transcription_failed", "transcribed", "analyzing", "analysis_failed", "awaiting_review"],
  urgency: ["urgent", "needs_review", "routine", "unknown"],
} as const;

export default function Incidents() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [qInput, setQInput] = useState(params.get("q") ?? "");
  const get = (k: string) => params.get(k) ?? "";
  const page = Number(get("page") || 1);
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  const machines = useQuery({ queryKey: ["machines", "all"], queryFn: () => api.get<Page<Machine>>("/api/machines", { page_size: 100 }) });
  const tags = useQuery({ queryKey: ["symptom-tags"], queryFn: () => api.get<string[]>("/api/memory/symptom-tags"), staleTime: Infinity });
  const query = Object.fromEntries(params.entries());
  const list = useQuery({
    queryKey: ["incidents", query],
    queryFn: () => api.get<Page<IncidentListItem>>("/api/incidents", { ...query, page, page_size: 15 }),
    placeholderData: (prev) => prev,
  });
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.page_size)) : 1;
  const filtered = [...params.keys()].some((k) => k !== "page");

  return (
    <div>
      <PageHeader
        kicker="Incident log"
        title="Incidents"
        icon={<IncidentIcon size={28} />}
        actions={<Button3D variant="primary" icon={<MicIcon size={16} />} onClick={() => navigate("/report")}>Report fault</Button3D>}
      />

      <div className="surface mb-6 space-y-3 rounded-xl p-3">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            setParam("q", qInput.trim());
          }}
        >
          <SearchBoltIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
          <Input aria-label={t("Search incidents")} placeholder={t("Search transcripts, symptoms, actions, outcomes… (press Enter)")} className="pl-9" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        </form>
        <div className="flex flex-wrap gap-2 [&>*]:min-w-[150px] [&>*]:flex-1">
          <Select aria-label={t("Machine")} value={get("machine_id")} onChange={(e) => setParam("machine_id", e.target.value)}>
            <option value="">{t("All machines")}</option>
            {machines.data?.items.map((m) => <option key={m.id} value={m.id}>{m.asset_code}</option>)}
          </Select>
          <Select aria-label={t("Symptom")} value={get("symptom")} onChange={(e) => setParam("symptom", e.target.value)}>
            <option value="">{t("Any symptom")}</option>
            {tags.data?.map((tag) => <option key={tag} value={tag}>{t(humanize(tag))}</option>)}
          </Select>
          {(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((k) => (
            <Select key={k} aria-label={t(humanize(k))} value={get(k)} onChange={(e) => setParam(k, e.target.value)}>
              <option value="">{t("{field}: any", { field: t(humanize(k).replace(" status", "")) })}</option>
              {FILTERS[k].map((v) => <option key={v} value={v}>{t(humanize(v))}</option>)}
            </Select>
          ))}
          <label className="flex h-10 items-center gap-2 rounded-lg border border-line bg-sunk/80 px-3 text-sm text-ink-dim">
            <input type="checkbox" checked={get("mine") === "true"} onChange={(e) => setParam("mine", e.target.checked ? "true" : "")} className="accent-[#a0522d]" />
            {t("Mine only")}
          </label>
        </div>
        {filtered && (
          <button
            className="text-xs text-brass hover:underline"
            onClick={() => {
              setQInput("");
              setParams(new URLSearchParams(), { replace: true });
            }}
          >
            {t("Clear filters")}
          </button>
        )}
      </div>

      {list.error && <ErrorBox error={list.error} onRetry={() => list.refetch()} />}
      <Panel title={list.data ? t(list.data.total === 1 ? "{n} incident" : "{n} incidents", { n: list.data.total }) : "Incidents"} icon={<IncidentIcon size={18} />}>
        {list.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : list.data?.items.length === 0 ? (
          <EmptyState
            title={filtered ? "No incidents match" : "No incidents yet"}
            body={filtered ? "Try widening the filters." : "Report a fault by voice to create the first record."}
          />
        ) : (
          <ul className="-mx-3">{list.data?.items.map((inc, i) => <IncidentRow key={inc.id} inc={inc} index={i} />)}</ul>
        )}
      </Panel>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button3D size="sm" variant="neutral" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>Prev</Button3D>
          <span className="font-mono text-xs text-ink-mute">{page} / {pages}</span>
          <Button3D size="sm" variant="neutral" disabled={page >= pages} onClick={() => setParam("page", String(page + 1))}>Next</Button3D>
        </div>
      )}
    </div>
  );
}
