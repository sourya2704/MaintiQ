import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FactoryIcon, MachineTypeIcon, PlusIcon, SearchBoltIcon, UploadIcon } from "../components/icons/MachineIcons";
import { MachineImport } from "../components/MachineImport";
import { useAuth } from "../lib/auth";
import { PageHeader } from "../components/layout/AppShell";
import { MachineForm, type MachineInput } from "../components/MachineForm";
import { Button3D } from "../components/ui/Button3D";
import { EmptyState, ErrorBox, Input, Panel, Select, Skeleton, StatusPill, useToast } from "../components/ui/kit";
import { Card } from "../components/ui/Card";
import { api } from "../lib/api";
import { machineStatusTone, timeAgo } from "../lib/format";
import { t } from "../lib/i18n";
import type { Machine, Page } from "../lib/types";

export default function Machines() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const { can } = useAuth();

  const types = useQuery({ queryKey: ["machine-types"], queryFn: () => api.get<string[]>("/api/machines/types") });
  const list = useQuery({
    queryKey: ["machines", { q, type, status, page }],
    queryFn: () => api.get<Page<Machine>>("/api/machines", { q, type, status, page, page_size: 12 }),
    placeholderData: (prev) => prev,
  });
  const create = useMutation({
    mutationFn: (m: MachineInput) => api.post<Machine>("/api/machines", m),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      qc.invalidateQueries({ queryKey: ["machine-types"] });
      toast("ok", t("{code} commissioned", { code: m.asset_code }));
      setAdding(false);
      navigate(`/machines/${m.id}`);
    },
  });
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.page_size)) : 1;

  return (
    <div>
      <PageHeader
        kicker="Asset registry"
        title="Machines"
        icon={<FactoryIcon size={28} />}
        actions={
          <>
            {can("admin", "supervisor") && (
              <Button3D variant="neutral" icon={<UploadIcon size={16} />} onClick={() => { setImporting((v) => !v); setAdding(false); }}>
                Import CSV
              </Button3D>
            )}
            {can("admin", "supervisor") && (
              <Button3D variant="primary" icon={<PlusIcon size={16} />} onClick={() => { setAdding((a) => !a); setImporting(false); }}>
                Add machine
              </Button3D>
            )}
          </>
        }
      />

      <AnimatePresence>
        {importing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-6 overflow-hidden">
            <Panel title="Import machines from CSV" icon={<UploadIcon size={18} />}>
              <MachineImport onDone={() => setImporting(false)} />
            </Panel>
          </motion.div>
        )}
        {adding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-6 overflow-hidden">
            <Panel title="Commission a machine" icon={<PlusIcon size={18} />}>
              <MachineForm submitLabel="Create machine" onSubmit={create.mutateAsync} onCancel={() => setAdding(false)} />
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="surface mb-6 grid gap-3 rounded-xl p-3 sm:grid-cols-[1fr_200px_180px]">
        <div className="relative">
          <SearchBoltIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
          <Input
            aria-label={t("Search machines")}
            placeholder={t("Search asset code, name, location…")}
            className="pl-9"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select aria-label={t("Filter by type")} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">{t("All types")}</option>
          {types.data?.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select aria-label={t("Filter by status")} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">{t("Any status")}</option>
          {["operational", "degraded", "down", "retired"].map((s) => <option key={s} value={s}>{t(s)}</option>)}
        </Select>
      </div>

      {list.error && <ErrorBox error={list.error} onRetry={() => list.refetch()} />}
      {list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : list.data?.items.length === 0 ? (
        <EmptyState
          icon={<FactoryIcon size={44} />}
          title={q || type || status ? "No machines match" : "No machines yet"}
          body={q || type || status ? "Try a different search or filter." : "Commission your first machine to start capturing incidents."}
          action={!q && !type && !status && can("admin", "supervisor") ? <Button3D variant="primary" onClick={() => setAdding(true)}>Add machine</Button3D> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.data?.items.map((m, i) => (
            <Card key={m.id} delay={i * 0.04} onClick={() => navigate(`/machines/${m.id}`)} alert={m.status === "down"}>
              <div className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-14 w-14 place-items-center rounded-xl border border-line bg-sunk text-brass">
                    <MachineTypeIcon type={m.type} size={30} />
                  </div>
                  <StatusPill value={m.status} tones={machineStatusTone} />
                </div>
                <div>
                  <div className="font-mono text-sm font-bold text-rust">{m.asset_code}</div>
                  <div className="text-base font-semibold">{m.name}</div>
                  <div className="text-xs capitalize text-ink-mute">
                    {m.type}
                    {m.location ? ` · ${m.location}` : ""}
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-xs text-ink-mute">
                  <span>
                    <span className="font-mono text-ink">{m.incident_count ?? 0}</span> {t("incidents")} ·{" "}
                    <span className={m.open_incident_count ? "font-mono text-rust" : "font-mono text-ink"}>{m.open_incident_count ?? 0}</span> {t("open")}
                  </span>
                  <span>{m.last_incident_at ? timeAgo(m.last_incident_at) : t("no history")}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button3D size="sm" variant="neutral" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button3D>
          <span className="font-mono text-xs text-ink-mute">{page} / {pages}</span>
          <Button3D size="sm" variant="neutral" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button3D>
        </div>
      )}
    </div>
  );
}
