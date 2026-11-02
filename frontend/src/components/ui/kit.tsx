import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { humanize, type Tone } from "../../lib/format";
import { CheckIcon, GearsIcon, IncidentIcon, SymptomIcon, XIcon } from "../icons/MachineIcons";
import { Button3D } from "./Button3D";

const toneClasses: Record<Tone, string> = {
  ok: "text-ok border-ok/40 bg-ok/10",
  warn: "text-warn border-warn/40 bg-warn/10",
  alert: "text-alert border-alert/40 bg-alert/10",
  plasma: "text-plasma border-plasma/40 bg-plasma/10",
  ember: "text-ember border-ember/40 bg-ember/10",
  mute: "text-ink-mute border-line bg-panel",
  violet: "text-violet border-violet/40 bg-violet/10",
};

export function Pill({ tone = "mute", children, dot, className = "" }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${toneClasses[tone]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />}
      {children}
    </span>
  );
}

export function StatusPill({ value, tones }: { value: string; tones: Record<string, Tone> }) {
  return (
    <Pill tone={tones[value] ?? "mute"} dot>
      {humanize(value)}
    </Pill>
  );
}

export function SymptomChip({ tag }: { tag: string }) {
  return (
    <span className="group inline-flex items-center gap-1.5 rounded-md border border-line bg-panel-2/70 px-2 py-1 text-xs text-ink-dim">
      <SymptomIcon tag={tag} size={14} className="text-ember" />
      {humanize(tag)}
    </span>
  );
}

export function Panel({
  title,
  icon,
  actions,
  children,
  className = "",
  tag,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  tag?: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.45 }}
      className={`glass relative rounded-2xl ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="group flex items-center gap-2.5">
            {icon && <span className="text-plasma">{icon}</span>}
            <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.14em] text-ink">{title}</h2>
            {tag}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </motion.section>
  );
}

const fieldBase =
  "w-full rounded-lg border border-line bg-deck/80 px-3 py-2 text-sm text-ink placeholder:text-ink-mute outline-none transition focus:border-plasma focus:shadow-[0_0_0_3px_rgb(34_211_238/0.15)] disabled:opacity-60";

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-dim">{label}</span>
      {children}
      {error ? <span className="block text-xs text-alert">{error}</span> : hint ? <span className="block text-xs text-ink-mute">{hint}</span> : null}
    </label>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${fieldBase} h-10 ${p.className ?? ""}`} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={`${fieldBase} min-h-24 resize-y leading-relaxed ${p.className ?? ""}`} />
);
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={`${fieldBase} h-10 ${p.className ?? ""}`} />
);

export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <div className="text-ink-mute">{icon ?? <GearsIcon size={40} />}</div>
      <p className="font-display text-sm font-bold uppercase tracking-widest text-ink-dim">{title}</p>
      {body && <p className="max-w-md text-sm text-ink-mute">{body}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
      <IncidentIcon size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <Button3D size="sm" variant="ghost" onClick={onRetry}>
          Retry
        </Button3D>
      )}
    </div>
  );
}

export function Stat({ label, value, sub, tone = "plasma" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "plasma" | "ember" | "alert" | "ok" | "warn" }) {
  const color = { plasma: "text-plasma", ember: "text-ember", alert: "text-alert", ok: "text-ok", warn: "text-warn" }[tone];
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-mute">{label}</div>
      <div className={`mt-1 font-display text-3xl font-extrabold ${color} drop-shadow-[0_0_12px_currentColor]`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-mute">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- confirm dialog

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ scale: 0.9, rotateX: 18, y: 20 }}
            animate={{ scale: 1, rotateX: 0, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            style={{ perspective: 800 }}
            className="glass w-full max-w-md overflow-hidden rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {danger && <div className="hazard-stripe h-1.5" />}
            <div className="space-y-3 p-6">
              <h3 className="font-display text-base font-bold uppercase tracking-widest">{title}</h3>
              <div className="text-sm text-ink-dim">{body}</div>
            </div>
            <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
              <Button3D variant="ghost" onClick={onClose}>
                Cancel
              </Button3D>
              <Button3D variant={danger ? "danger" : "ember"} loading={busy} onClick={onConfirm} autoFocus>
                {confirmLabel}
              </Button3D>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------- toasts

type Toast = { id: number; tone: "ok" | "alert" | "plasma"; text: string };
const ToastCtx = createContext<(tone: Toast["tone"], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, rotateY: -30 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className={`glass pointer-events-auto flex items-start gap-3 rounded-xl p-3.5 text-sm ${
                t.tone === "alert" ? "border-alert/50" : t.tone === "ok" ? "border-ok/40" : "border-plasma/40"
              }`}
            >
              <span className={t.tone === "alert" ? "text-alert" : t.tone === "ok" ? "text-ok" : "text-plasma"}>
                {t.tone === "alert" ? <XIcon size={18} /> : <CheckIcon size={18} />}
              </span>
              <span className="flex-1 text-ink">{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export function errorText(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}
