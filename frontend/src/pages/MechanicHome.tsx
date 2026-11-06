import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { CameraIcon, ChevronRight, KeyboardIcon, MachineTypeIcon, MicIcon } from "../components/icons/MachineIcons";
import { IncidentRow } from "../components/incident/IncidentRow";
import { EmptyState, ErrorBox, Panel, Skeleton, StatusPill } from "../components/ui/kit";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { machineStatusTone } from "../lib/format";
import { dateLocale, t } from "../lib/i18n";
import type { IncidentListItem, Machine, Page } from "../lib/types";

const OPEN = new Set(["open", "monitoring", "unresolved"]);

/** Home screen for mechanics: report quickly, then see what still needs their hands. */
export default function MechanicHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mine = useQuery({
    queryKey: ["incidents", "mine-home"],
    queryFn: () => api.get<Page<IncidentListItem>>("/api/incidents", { mine: true, page_size: 50 }),
  });
  const machines = useQuery({
    queryKey: ["machines", "all"],
    queryFn: () => api.get<Page<Machine>>("/api/machines", { page_size: 100 }),
  });

  const items = mine.data?.items ?? [];
  const toConfirm = items.filter((i) => i.review_status === "draft" && i.processing_status === "awaiting_review");
  const open = items.filter((i) => OPEN.has(i.resolution_status) && !toConfirm.includes(i));
  const attention = (machines.data?.items ?? []).filter((m) => m.status === "down" || m.status === "degraded");
  const today = new Date().toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month: "long" });

  const actions = [
    { to: "/report?mode=record", icon: MicIcon, title: "Speak the fault", body: "Record a voice note", primary: true },
    { to: "/report?mode=photo", icon: CameraIcon, title: "Take photos", body: "Show what is wrong" },
    { to: "/report?mode=type", icon: KeyboardIcon, title: "Type it", body: "When it is too noisy" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="text-sm text-ink-mute">{today}</div>
        <h1 className="mt-1 font-display text-3xl font-bold">{t("Hello, {name}", { name: user?.name.split(" ")[0] ?? "" })}</h1>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {actions.map(({ to, icon: Icon, title, body, primary }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={`flex flex-col items-start gap-3 rounded-xl p-4 text-left transition active:scale-[0.98] ${
              primary ? "bg-rust text-cream shadow-md" : "surface text-ink"
            }`}
          >
            <Icon size={28} className={primary ? "text-cream" : "text-rust"} />
            <div>
              <div className="text-[15px] font-semibold leading-tight">{t(title)}</div>
              <div className={`mt-0.5 text-xs ${primary ? "text-cream/75" : "text-ink-mute"}`}>{t(body)}</div>
            </div>
          </button>
        ))}
      </div>

      {mine.error && <ErrorBox error={mine.error} onRetry={() => mine.refetch()} />}

      {toConfirm.length > 0 && (
        <Panel title="Check and confirm">
          <p className="-mt-1 mb-3 text-sm text-ink-mute">{t("Mantiq wrote these up from your reports. Check that they are right.")}</p>
          <ul className="-mx-3">{toConfirm.map((inc, i) => <IncidentRow key={inc.id} inc={inc} index={i} compact />)}</ul>
        </Panel>
      )}

      <Panel title="My open jobs" actions={<Link to="/incidents" className="text-sm font-medium text-brass">{t("See all")}</Link>}>
        {mine.isLoading ? (
          <Skeleton className="h-32" />
        ) : open.length === 0 ? (
          <EmptyState title="Nothing open" body="Faults you report will show here until they are fixed." />
        ) : (
          <ul className="-mx-3">{open.map((inc, i) => <IncidentRow key={inc.id} inc={inc} index={i} compact />)}</ul>
        )}
      </Panel>

      {attention.length > 0 && (
        <Panel title="Machines needing attention">
          <ul className="divide-y divide-line">
            {attention.map((m) => (
              <li key={m.id}>
                <Link to={`/machines/${m.id}`} className="flex items-center gap-3 py-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-sunk text-brass">
                    <MachineTypeIcon type={m.type} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-sm font-bold text-rust">{m.asset_code}</span>
                    <span className="block truncate text-sm text-ink-dim">{m.name}</span>
                  </span>
                  <StatusPill value={m.status} tones={machineStatusTone} />
                  <ChevronRight size={16} className="text-ink-mute" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
