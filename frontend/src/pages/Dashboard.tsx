import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { lazy, Suspense, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IncidentRow } from "../components/incident/IncidentRow";
import { CubeIcon, FactoryIcon, IncidentIcon, MemoryIcon, MicIcon, SymptomIcon, WrenchIcon, machineKind } from "../components/icons/MachineIcons";
import { PageHeader } from "../components/layout/AppShell";
import type { FloorMachine } from "../components/three/PlantFloor";
import { Button3D } from "../components/ui/Button3D";
import { EmptyState, ErrorBox, Panel, Skeleton, Stat } from "../components/ui/kit";
import { TiltCard } from "../components/ui/TiltCard";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { humanize } from "../lib/format";
import type { DashboardSummary, IncidentListItem, Machine, Page } from "../lib/types";

const GearTrain = lazy(() => import("../components/three/GearTrain"));
const PlantFloor = lazy(() => import("../components/three/PlantFloor"));

const OPEN = new Set(["open", "monitoring", "unresolved"]);

function usePlantFloor() {
  const machines = useQuery({
    queryKey: ["machines", "floor"],
    queryFn: () => api.get<Page<Machine>>("/api/machines", { page_size: 100 }),
  });
  const incidents = useQuery({
    queryKey: ["incidents", "floor"],
    queryFn: () => api.get<Page<IncidentListItem>>("/api/incidents", { page_size: 100 }),
  });
  const floor = useMemo<FloorMachine[]>(() => {
    if (!machines.data) return [];
    const active = new Map<string, Set<string>>();
    for (const inc of incidents.data?.items ?? []) {
      if (!OPEN.has(inc.resolution_status)) continue;
      const set = active.get(inc.machine.id) ?? new Set();
      inc.symptom_tags.forEach((t) => set.add(t));
      active.set(inc.machine.id, set);
    }
    return machines.data.items
      .filter((m) => m.status !== "retired")
      .slice(0, 16)
      .map((m) => ({
        id: m.id,
        asset_code: m.asset_code,
        name: m.name,
        kind: machineKind(m.type),
        status: m.status,
        symptoms: [...(active.get(m.id) ?? [])],
        openIncidents: m.open_incident_count ?? 0,
      }));
  }, [machines.data, incidents.data]);
  return { floor, loading: machines.isLoading };
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const track = useRef<HTMLDivElement>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardSummary>("/api/dashboard/summary"),
  });
  const { floor } = usePlantFloor();
  const maxSymptom = Math.max(1, ...(data?.top_symptoms.map((s) => s.count) ?? [1]));

  return (
    <div className="space-y-8">
      {/* hero */}
      <section className="glass relative overflow-hidden rounded-3xl">
        <div className="blueprint absolute inset-0" />
        <Suspense fallback={null}>
          <GearTrain className="absolute inset-y-0 right-0 hidden w-[55%] md:block" intensity={0.8} />
        </Suspense>
        <div className="relative max-w-xl p-6 sm:p-8">
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-plasma">Control room</div>
          <h1 className="mt-2 font-display text-3xl font-extrabold uppercase leading-tight tracking-[0.08em] sm:text-4xl">
            Hello, {user?.name.split(" ")[0]}
          </h1>
          <p className="mt-3 text-sm text-ink-dim">
            {data
              ? data.incidents.open > 0
                ? `${data.incidents.open} incident${data.incidents.open > 1 ? "s" : ""} still open across ${data.machines.total} machines.`
                : "No open incidents. All machines clear."
              : "Loading plant status…"}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button3D variant="ember" size="lg" icon={<MicIcon size={18} />} onClick={() => navigate("/report")}>
              Report a fault
            </Button3D>
            <Button3D variant="steel" size="lg" icon={<MemoryIcon size={18} />} onClick={() => navigate("/memory")}>
              Search memory
            </Button3D>
          </div>
        </div>
      </section>

      {error && <ErrorBox error={error} onRetry={() => refetch()} />}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading || !data
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          : [
              { label: "Open incidents", value: data.incidents.open, sub: `${data.incidents.urgent_open} urgent`, tone: "ember" as const, to: "/incidents?resolution_status=open", glow: data.incidents.urgent_open ? ("alert" as const) : undefined },
              { label: "Awaiting review", value: data.incidents.awaiting_review, sub: "AI drafts to confirm", tone: "warn" as const, to: "/incidents?processing_status=awaiting_review" },
              { label: "Resolved · 30d", value: data.incidents.resolved_last_30_days, sub: `${data.incidents.reported_last_30_days} reported in 30d`, tone: "ok" as const, to: "/incidents?resolution_status=resolved" },
              { label: "Machines", value: data.machines.total, sub: `${data.machines.by_status.down ?? 0} down · ${data.machines.by_status.degraded ?? 0} degraded`, tone: "plasma" as const, to: "/machines" },
            ].map((k, i) => (
              <TiltCard key={k.label} delay={i * 0.07} onClick={() => navigate(k.to)} glow={k.glow}>
                <div className="p-5">
                  <Stat label={k.label} value={k.value} sub={k.sub} tone={k.tone} />
                </div>
              </TiltCard>
            ))}
      </div>
      {data && data.incidents.processing_failed > 0 && (
        <Link to="/incidents?processing_status=transcription_failed" className="block rounded-xl border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-alert">
          {data.incidents.processing_failed} incident(s) have a failed AI step. Open them to retry or enter the transcript manually.
        </Link>
      )}

      {/* 3D plant floor, flown through by scrolling */}
      <div ref={track} className="relative h-[230vh]">
        <div className="sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col pb-4 pt-2">
          <PageHeader
            kicker="Live plant floor · scroll to fly in"
            title="Plant Floor"
            icon={<CubeIcon size={26} />}
            actions={<span className="text-xs text-ink-mute">Click a machine to open it</span>}
          />
          <div className="glass relative min-h-0 flex-1 overflow-hidden rounded-3xl">
            {floor.length ? (
              <Suspense fallback={<Skeleton className="h-full" />}>
                <PlantFloor machines={floor} onSelect={(id) => navigate(`/machines/${id}`)} trackRef={track} className="absolute inset-0" />
              </Suspense>
            ) : (
              <div className="grid h-full place-items-center p-6">
                <EmptyState
                  icon={<FactoryIcon size={44} />}
                  title="No machines yet"
                  body="Add your first machine to see it on the 3D plant floor."
                  action={<Button3D variant="plasma" onClick={() => navigate("/machines")}>Add machine</Button3D>}
                />
              </div>
            )}
            <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-lg bg-void/70 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-dim backdrop-blur">
              <span className="text-ok">● operational</span>
              <span className="text-warn">● degraded</span>
              <span className="text-alert">● down</span>
              <span>shake = vibration · glow = heat · drops = leak</span>
            </div>
          </div>
        </div>
      </div>

      {/* insights */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Recurring symptoms" icon={<WrenchIcon size={18} />} className="lg:col-span-2">
          {!data || data.top_symptoms.length === 0 ? (
            <EmptyState title="No symptoms recorded" body="Symptoms appear here once incidents are analysed." />
          ) : (
            <ul className="space-y-3">
              {data.top_symptoms.map((s, i) => (
                <li key={s.tag} className="group">
                  <Link to={`/incidents?symptom=${s.tag}`} className="block">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 capitalize text-ink-dim group-hover:text-ink">
                        <SymptomIcon tag={s.tag} size={16} className="text-ember" />
                        {humanize(s.tag)}
                      </span>
                      <span className="font-mono text-xs text-ink-mute">{s.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-deck">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(s.count / maxSymptom) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, delay: i * 0.08 }}
                        className="h-full rounded-full bg-gradient-to-r from-ember-deep to-ember shadow-[0_0_10px_#ff8a1f]"
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Unresolved" icon={<IncidentIcon size={18} />} className="lg:col-span-3" actions={<Link to="/incidents" className="text-xs text-plasma hover:underline">All incidents</Link>}>
          {!data ? (
            <Skeleton className="h-40" />
          ) : data.unresolved_incidents.length === 0 ? (
            <EmptyState title="Nothing unresolved" body="Every reported incident has a recorded resolution." />
          ) : (
            <ul className="-mx-3">{data.unresolved_incidents.map((inc, i) => <IncidentRow key={inc.id} inc={inc} index={i} />)}</ul>
          )}
        </Panel>
      </div>

      <Panel title="Recent reports" icon={<MicIcon size={18} />}>
        {!data ? (
          <Skeleton className="h-40" />
        ) : data.recent_incidents.length === 0 ? (
          <EmptyState
            title="No incidents yet"
            body="Record a voice note at the machine to create the first incident."
            action={<Button3D variant="ember" icon={<MicIcon size={16} />} onClick={() => navigate("/report")}>Report a fault</Button3D>}
          />
        ) : (
          <ul className="-mx-3">{data.recent_incidents.map((inc, i) => <IncidentRow key={inc.id} inc={inc} index={i} />)}</ul>
        )}
      </Panel>
    </div>
  );
}
