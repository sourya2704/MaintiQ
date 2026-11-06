import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { t, tNode, useLanguage } from "../../lib/i18n";
import {
  ChatIcon,
  FactoryIcon,
  GaugeIcon,
  MantiqMark,
  SlidersIcon,
  IncidentIcon,
  LogoutIcon,
  MemoryIcon,
  MicIcon,
  XIcon,
} from "../icons/MachineIcons";

type NavEntry = { to: string; label: string; icon: (p: { size?: number; className?: string }) => ReactNode; end?: boolean };

/** Supervisors and admins run the plant; mechanics get a shorter, task-first menu. */
function navFor(isMechanic: boolean): NavEntry[] {
  return isMechanic
    ? [
        { to: "/", label: "My work", icon: GaugeIcon, end: true },
        { to: "/report", label: "Report fault", icon: MicIcon },
        { to: "/incidents", label: "My reports", icon: IncidentIcon },
        { to: "/messages", label: "Messages", icon: ChatIcon },
        { to: "/machines", label: "Machines", icon: FactoryIcon },
        { to: "/memory", label: "Past fixes", icon: MemoryIcon },
        { to: "/settings", label: "Settings", icon: SlidersIcon },
      ]
    : [
        { to: "/", label: "Overview", icon: GaugeIcon, end: true },
        { to: "/report", label: "Report fault", icon: MicIcon },
        { to: "/incidents", label: "Incidents", icon: IncidentIcon },
        { to: "/messages", label: "Messages", icon: ChatIcon },
        { to: "/machines", label: "Machines", icon: FactoryIcon },
        { to: "/memory", label: "Failure memory", icon: MemoryIcon },
        { to: "/settings", label: "Settings", icon: SlidersIcon },
      ];
}

export function Logo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-rust text-cream">
        <MantiqMark size={20} />
      </div>
      {!compact && (
        <div className="leading-none">
          <div className={`font-display text-xl font-bold tracking-wide ${light ? "text-cream" : "text-ink"}`}>Mantiq</div>
          <div className={`mt-0.5 text-[11px] font-medium ${light ? "text-cream/55" : "text-ink-mute"}`}>{t("Maintenance memory")}</div>
        </div>
      )}
    </div>
  );
}

/** Unread message count, polled so a sent fix shows up without a reload. */
function useUnread() {
  const { data } = useQuery({
    queryKey: ["unread"],
    queryFn: () => api.get<{ unread: number }>("/api/messages/unread-count"),
    refetchInterval: 30_000,
  });
  return data?.unread ?? 0;
}

function Badge({ n, dark }: { n: number; dark?: boolean }) {
  if (!n) return null;
  return (
    <span className={`ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold ${dark ? "bg-rust text-cream" : "bg-rust text-cream"}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

function SideNav({ items }: { items: NavEntry[] }) {
  const unread = useUnread();
  return (
    <nav className="space-y-0.5">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition ${
              isActive ? "bg-cream/10 text-cream" : "text-cream/65 hover:bg-cream/5 hover:text-cream"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-rust" />}
              <Icon size={19} className={isActive ? "text-[#d9b98a]" : "text-cream/50"} />
              {t(label)}
              {to === "/messages" && <Badge n={unread} dark />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/** Phone navigation: a thumb-reachable bar with the report button in the middle. */
function BottomBar({ items }: { items: NavEntry[] }) {
  const [home, report, list, messages, machines] = items;
  const unread = useUnread();
  const tab = (e: NavEntry) => (
    <NavLink
      key={e.to}
      to={e.to}
      end={e.end}
      className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] font-medium ${isActive ? "text-rust" : "text-ink-mute"}`}
    >
      <span className="relative">
        <e.icon size={22} />
        {e.to === "/messages" && unread > 0 && (
          <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rust px-1 text-[10px] font-bold text-cream">{unread}</span>
        )}
      </span>
      <span className="max-w-full truncate px-1">{t(e.label)}</span>
    </NavLink>
  );
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex items-end border-t border-line bg-card/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label={t("Main menu")}
    >
      {tab(home)}
      {tab(list)}
      <NavLink to={report.to} className="flex flex-1 flex-col items-center pb-1.5" aria-label={t(report.label)}>
        <span className="-mt-5 grid h-14 w-14 place-items-center rounded-full bg-rust text-cream shadow-lg ring-4 ring-canvas">
          <MicIcon size={24} />
        </span>
        <span className="mt-0.5 text-[11px] font-semibold text-rust">{t("Report")}</span>
      </NavLink>
      {tab(messages)}
      {tab(machines)}
    </nav>
  );
}

export default function AppShell(): ReactNode {
  const { user, logout } = useAuth();
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const items = navFor(user?.role === "technician");

  const userCard = (dark: boolean) => (
    <div className={`rounded-lg p-3 ${dark ? "bg-cream/5" : "bg-sunk"}`}>
      <div className={`truncate text-sm font-semibold ${dark ? "text-cream" : "text-ink"}`}>{user?.name}</div>
      <div className={`truncate text-xs ${dark ? "text-cream/55" : "text-ink-mute"}`}>
        {user?.role && t(user.role)} · {user?.organization?.name}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => setLang(lang === "en" ? "hi" : "en")}
          lang={lang === "en" ? "hi" : "en"}
          className={`rounded-md border py-1.5 text-xs font-semibold transition ${
            dark ? "border-cream/15 text-cream/75 hover:border-cream/40 hover:text-cream" : "border-line text-ink-dim hover:border-line-strong"
          }`}
        >
          {lang === "en" ? "हिन्दी" : "English"}
        </button>
        <button
          onClick={logout}
          className={`flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-semibold transition ${
            dark ? "border-cream/15 text-cream/75 hover:border-cream/40 hover:text-cream" : "border-line text-ink-dim hover:border-line-strong"
          }`}
        >
          <LogoutIcon size={14} /> {t("Sign out")}
        </button>
      </div>
    </div>
  );
  const initials = (user?.name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-espresso p-4 lg:flex">
        <div className="mb-8 px-1 pt-1">
          <Logo light />
        </div>
        <SideNav items={items} />
        <div className="mt-auto">{userCard(true)}</div>
      </aside>

      {/* phone: account sheet opened from the avatar */}
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-40 bg-espresso/40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-x-3 top-3 rounded-xl bg-card p-3 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex justify-end">
                <button aria-label={t("Close menu")} onClick={() => setOpen(false)} className="text-ink-mute">
                  <XIcon />
                </button>
              </div>
              {userCard(false)}
              {items
                .filter((i) => i.to === "/memory" || i.to === "/settings")
                .map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-dim hover:bg-sunk">
                    <Icon size={18} /> {t(label)}
                  </NavLink>
                ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur sm:px-6">
          <div className="lg:hidden">
            <Logo compact />
          </div>
          <span className="hidden text-sm font-medium text-ink-dim lg:block">{user?.organization?.name}</span>
          <button
            aria-label={t("Account")}
            onClick={() => setOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-full bg-espresso text-xs font-bold text-cream lg:hidden"
          >
            {initials}
          </button>
        </header>
        <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
          <Outlet />
        </main>
      </div>
      <BottomBar items={items} />
    </div>
  );
}

export function PageHeader({ title, kicker, actions, icon }: { title: string; kicker?: string; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="group">
        {kicker && <div className="mb-1 text-[13px] font-medium text-brass">{t(kicker)}</div>}
        <h1 className="flex items-center gap-2.5 font-display text-3xl font-bold">
          {icon && <span className="text-rust">{icon}</span>}
          {tNode(title)}
        </h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
