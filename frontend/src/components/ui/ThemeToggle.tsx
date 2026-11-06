import { t } from "../../lib/i18n";
import { useTheme, type ThemeChoice } from "../../lib/theme";

export function SunIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </svg>
  );
}

export function MoonIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden>
      <path d="M20.2 14.6A8.3 8.3 0 0 1 9.4 3.8a8.3 8.3 0 1 0 10.8 10.8Z" />
      <path d="M16.5 4.2l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MonitorIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
      <rect x="3" y="4" width="18" height="12.5" rx="2" />
      <path d="M8.5 20.5h7M12 16.5v4" />
    </svg>
  );
}

/** Round icon button: the sun turns into a moon. `tone="light"` is for dark bands such as the website header. */
export function ThemeToggle({ tone = "auto", className = "" }: { tone?: "auto" | "light"; className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  const label = dark ? t("Switch to light mode") : t("Switch to dark mode");
  const colours =
    tone === "light"
      ? "border-cream/20 text-cream/80 hover:border-cream/50 hover:text-cream"
      : "border-line text-ink-dim hover:border-line-strong hover:text-ink bg-card";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`relative grid h-9 w-9 place-items-center overflow-hidden rounded-full border transition ${colours} ${className}`}
    >
      <span className={`absolute transition duration-300 ${dark ? "-translate-y-6 rotate-90 opacity-0" : "translate-y-0 rotate-0 opacity-100"}`}>
        <SunIcon />
      </span>
      <span className={`absolute transition duration-300 ${dark ? "translate-y-0 rotate-0 opacity-100" : "translate-y-6 -rotate-90 opacity-0"}`}>
        <MoonIcon />
      </span>
    </button>
  );
}

/** Three-way choice for the Settings page. */
export function ThemeChooser() {
  const { choice, setChoice } = useTheme();
  const options: { value: ThemeChoice; label: string; icon: typeof SunIcon }[] = [
    { value: "light", label: "Light", icon: SunIcon },
    { value: "dark", label: "Dark", icon: MoonIcon },
    { value: "system", label: "Match device", icon: MonitorIcon },
  ];
  return (
    <div className="inline-grid grid-cols-3 rounded-lg border border-line bg-sunk p-1" role="radiogroup" aria-label={t("Appearance")}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={choice === o.value}
          onClick={() => setChoice(o.value)}
          className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
            choice === o.value ? "bg-card text-ink shadow-sm" : "text-ink-mute hover:text-ink"
          }`}
        >
          <o.icon size={16} />
          {t(o.label)}
        </button>
      ))}
    </div>
  );
}
