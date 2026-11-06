import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { t, tNode, useLanguage } from "../../lib/i18n";
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
  { to: "/", label: "Overview", icon: GaugeIcon, end: true },
  { to: "/report", label: "Report fault", icon: MicIcon },
  { to: "/incidents", label: "Incidents", icon: IncidentIcon },
  { to: "/machines", label: "Machines", icon: FactoryIcon },
  { to: "/memory", label: "Failure memory", icon: MemoryIcon },
  { to: "/settings", label: "Settings", icon: GearIcon },
];

export function Logo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <div className="group flex items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-rust text-cream">
        <GearIcon size={20} />
      </div>
      {!compact && (
        <div className="leading-none">
          <div className={`font-display text-xl font-bold uppercase tracking-wider ${light ? "text-cream" : "text-ink"}`}>Mantiq</div>
          <div className={`mt-0.5 text-[10px] font-semibold uppercase tracking-wider ${light ? "text-cream/60" : "text-ink-mute"}`}>
            {t("Maintenance memory")}
          </div>
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
            className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] ${
              live ? "border-ok/40 bg-ok/10 text-ok" : off ? "border-line text-ink-mute" : "border-warn/40 bg-warn/10 text-warn"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-ok" : off ? "bg-ink-mute" : "bg-warn"}`} />
            {p.provider} {t(live ? "live" : p.mode)}
          </span>
        );
      })}
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-0.5">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition ${
              isActive ? "bg-cream/10 text-cream" : "text-cream/65 hover:bg-cream/5 hover:text-cream"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-rust" />}
              <Icon size={19} className={isActive ? "text-[#d9b98a]" : "text-cream/50 group-hover:text-cream/80"} />
              {t(label)}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppShell(): ReactNode {
  const { user, logout } = useAuth();
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);

  const userCard = (
    <div className="rounded-lg bg-cream/5 p-3">
      <div className="truncate text-sm font-semibold text-cream">{user?.name}</div>
      <div className="truncate text-xs text-cream/55">{user?.organization?.name}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="rounded bg-cream/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#d9b98a]">{user?.role && t(user.role)}</span>
        <button onClick={logout} className="flex items-center gap-1 text-xs text-cream/55 hover:text-cream">
          <LogoutIcon size={14} /> {t("Sign out")}
        </button>
      </div>
      <button
        onClick={() => setLang(lang === "en" ? "hi" : "en")}
        lang={lang === "en" ? "hi" : "en"}
        className="mt-3 w-full rounded-md border border-cream/15 py-1.5 text-xs font-semibold text-cream/75 transition hover:border-cream/40 hover:text-cream"
        title={t("Change language")}
      >
        {lang === "en" ? "हिन्दी में देखें" : "View in English"}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-espresso p-4 lg:flex">
        <div className="mb-8 px-1 pt-1">
          <Logo light />
        </div>
        <NavItems />
        <div className="mt-auto">{userCard}</div>
      </aside>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-40 bg-espresso/40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "tween", duration: 0.2 }}
              className="flex h-full w-72 flex-col bg-espresso p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-8 flex items-center justify-between">
                <Logo light />
                <button aria-label={t("Close menu")} onClick={() => setOpen(false)} className="text-cream/70">
                  <XIcon />
                </button>
              </div>
              <NavItems onNavigate={() => setOpen(false)} />
              <div className="mt-auto">{userCard}</div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button aria-label={t("Open menu")} className="text-ink-dim lg:hidden" onClick={() => setOpen(true)}>
              <MenuIcon />
            </button>
            <div className="lg:hidden">
              <Logo compact />
            </div>
            <span className="hidden text-sm text-ink-mute sm:block">{user?.organization?.name}</span>
          </div>
          <ProviderChips />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, kicker, actions, icon }: { title: string; kicker?: string; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="group">
        {kicker && <div className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-brass">{t(kicker)}</div>}
        <h1 className="flex items-center gap-2.5 font-display text-3xl font-bold uppercase tracking-wide">
          {icon && <span className="text-rust">{icon}</span>}
          {tNode(title)}
        </h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
