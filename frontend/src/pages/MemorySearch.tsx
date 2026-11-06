import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { MemoryIcon, SearchBoltIcon, SymptomIcon } from "../components/icons/MachineIcons";
import { RelatedList } from "../components/incident/parts";
import { PageHeader } from "../components/layout/AppShell";
import { Button3D } from "../components/ui/Button3D";
import { Input, Panel, Select } from "../components/ui/kit";
import { api } from "../lib/api";
import { humanize } from "../lib/format";
import { t } from "../lib/i18n";
import type { Machine, Page, RelatedResponse } from "../lib/types";


const EXAMPLES = ["motor vibrating and running hot", "pump seal leaking", "compressor high temperature alarm", "conveyor belt slipping"];

export default function MemorySearch() {
  const [text, setText] = useState("");
  const [machineId, setMachineId] = useState("");
  const [submitted, setSubmitted] = useState<{ q: string; machine_id: string } | null>(null);
  const machines = useQuery({ queryKey: ["machines", "all"], queryFn: () => api.get<Page<Machine>>("/api/machines", { page_size: 100 }) });
  const results = useQuery({
    queryKey: ["memory", submitted],
    queryFn: () => api.get<RelatedResponse>("/api/memory/search", { q: submitted!.q, machine_id: submitted!.machine_id, limit: 10 }),
    enabled: Boolean(submitted),
  });
  const run = (q = text) => q.trim().length >= 2 && setSubmitted({ q: q.trim(), machine_id: machineId });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader kicker="Investigate a recurring problem" title="Failure Memory" icon={<MemoryIcon size={28} />} />

      <section className="surface mb-6 rounded-xl">
        <form
          className="space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <p className="max-w-xl text-sm text-ink-dim">
            {t("Describe what you're seeing. Mantiq searches only your organisation's own incident history and explains every match.")}
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <div className="relative">
              <SearchBoltIcon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brass" />
              <Input aria-label={t("Describe the symptoms")} className="!h-12 pl-10 text-base" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("e.g. grinding noise and vibration at start-up")} />
            </div>
            <Select aria-label={t("Machine (optional)")} className="!h-12" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
              <option value="">{t("Any machine")}</option>
              {machines.data?.items.map((m) => <option key={m.id} value={m.id}>{m.asset_code} · {m.type}</option>)}
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button3D type="submit" variant="dark" size="lg" icon={<MemoryIcon size={18} />} loading={results.isFetching} disabled={text.trim().length < 2}>
              Search memory
            </Button3D>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setText(ex);
                  run(ex);
                }}
                className="rounded-full border border-line px-3 py-1 text-xs text-ink-mute transition hover:border-brass/50 hover:text-brass"
              >
                {/* label in the interface language; the search runs on the English example */}
                {t(ex)}
              </button>
            ))}
          </div>
        </form>
      </section>

      {submitted && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Panel
            title="Matches"
            icon={<MemoryIcon size={18} />}
            tag={
              results.data && results.data.query_symptoms.length > 0 ? (
                <span className="flex flex-wrap gap-1.5">
                  {results.data.query_symptoms.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 text-[11px] text-rust">
                      <SymptomIcon tag={tag} size={12} /> {t(humanize(tag))}
                    </span>
                  ))}
                </span>
              ) : undefined
            }
          >
            <RelatedList data={results.data} loading={results.isLoading} error={results.error} />
          </Panel>
        </motion.div>
      )}
    </div>
  );
}
