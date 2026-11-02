import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { IntegrationStatus } from "../../lib/types";
import {
  FactoryIcon,
  GaugeIcon,
  GearIcon,
  IncidentIcon,
  LogoutIcon,
  MemoryIcon,
  MenuIcon,
  MicIcon,
  XIcon,
} from "../icons/MachineIcons";

const NAV = [
  { to: "/", label: "Control Room", icon: GaugeIcon, end: true },
  { to: "/report", label: "Report Fault", icon: MicIcon },
  { to: "/incidents", label: "Incidents", icon: IncidentIcon },
  { to: "/machines", label: "Machines", icon: FactoryIcon },
  { to: "/memory", label: "Failure Memory", icon: MemoryIcon },
  { to: "/settings", label: "Settings", icon: GearIcon },
];

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="group flex items-center gap-2.5">
      <div className="relative grid h-9 w-9 place-items-center rounded-xl border border-ember/40 bg-gradient-to-br from-ember/25 to-transparent glow-ember">
        <GearIcon size={20} className="text-ember" />
        <span className="absolute h-1.5 w-1.5 rounded-full bg-plasma shadow-[0_0_8px_#22d3ee]" />
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-lg font-extrabold tracking-[0.22em] text-ink">MANTIQ</div>
          <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.3em] text-ink-mute">Maintenance memory</div>
        </div>
      )}
    </div>
  );
}

function ProviderChips() {
  const { data } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => api.get<IntegrationStatus>("/api/settings/integrations"),
    staleTime: 60_000,
  });
  if (!data) return null;
  return (
    <div className="hidden items-center gap-1.5 md:flex" aria-label="AI provider status">
      {data.providers.map((p) => {
        const live = p.mode === "live";
        const off = p.mode === "disabled";
        return (
          <span
            key={p.provider}
            title={p.label}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
              live ? "border-ok/40 text-ok" : off ? "border-line text-ink-mute" : "border-warn/40 text-warn"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-ok shadow-[0_0_6px_#34d399]" : off ? "bg-ink-mute" : "bg-warn"}`} />
            {p.provider} {live ? "live" : p.mode}
          </span>
        );
      })}
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isActive ? "bg-panel-2 text-ink" : "text-ink-dim hover:bg-panel/70 hover:text-ink"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-ember shadow-[0_0_12px_#ff8a1f]" />
              )}
              <Icon size={19} className={isActive ? "text-ember" : "text-ink-mute group-hover:text-plasma"} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppShell(): ReactNode {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-deck/80 p-4 backdrop-blur-xl lg:flex">
        <div className="mb-8 px-1 pt-1">
          <Logo />
        </div>
        <NavItems />
        <div className="mt-auto rounded-xl border border-line bg-panel/60 p-3">
          <div className="truncate text-sm font-semibold">{user?.name}</div>
          <div className="truncate text-xs text-ink-mute">{user?.organization?.name}</div>
          <div className="mt-2 flex items-center justify-between">
            <span className="rounded border border-plasma/30 px-1.5 py-0.5 font-mono text-[10px] uppercase text-plasma">{user?.role}</span>
            <button onClick={logout} className="flex items-center gap-1 text-xs text-ink-mute hover:text-alert">
              <LogoutIcon size={14} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-40 bg-void/80 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className="h-full w-72 border-r border-line bg-deck p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-8 flex items-center justify-between">
                <Logo />
                <button aria-label="Close menu" onClick={() => setOpen(false)} className="text-ink-dim">
                  <XIcon />
                </button>
              </div>
              <NavItems onNavigate={() => setOpen(false)} />
              <button onClick={logout} className="mt-6 flex items-center gap-2 px-3 text-sm text-ink-mute hover:text-alert">
                <LogoutIcon size={16} /> Sign out
              </button>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-void/70 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button aria-label="Open menu" className="text-ink-dim lg:hidden" onClick={() => setOpen(true)}>
              <MenuIcon />
            </button>
            <div className="lg:hidden">
              <Logo compact />
            </div>
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-ink-mute sm:block">
              {user?.organization?.name}
            </span>
          </div>
          <ProviderChips />
        </header>
        <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, kicker, actions, icon }: { title: string; kicker?: string; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="group">
        {kicker && <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.25em] text-plasma">{kicker}</div>}
        <h1 className="flex items-center gap-3 font-display text-2xl font-extrabold uppercase tracking-[0.1em] sm:text-3xl">
          {icon && <span className="text-ember">{icon}</span>}
          {title}
        </h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
