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
import { t, tNode } from "../../lib/i18n";
import { CheckIcon, GearsIcon, IncidentIcon, SymptomIcon, XIcon } from "../icons/MachineIcons";
import { Button3D } from "./Button3D";

// Solid tinted labels: readable at a glance, no outline or status dot.
const toneClasses: Record<Tone, string> = {
  ok: "text-ok-ink bg-ok/15",
  warn: "text-warn-ink bg-warn/15",
  alert: "text-alert bg-alert/12",
  brass: "text-brass-deep bg-brass/12",
  rust: "text-rust-deep bg-rust/12",
  mute: "text-ink-dim bg-ink/[0.06]",
  taupe: "text-taupe bg-taupe/12",
};

export function Pill({ tone = "mute", children, className = "" }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-[5px] px-2 py-[3px] text-xs font-semibold leading-none ${toneClasses[tone]} ${className}`}>
      {typeof children === "string" ? sentence(t(children)) : children}
    </span>
  );
}

function sentence(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusPill({ value, tones }: { value: string; tones: Record<string, Tone> }) {
  return <Pill tone={tones[value] ?? "mute"}>{sentence(t(humanize(value)))}</Pill>;
}

export function SymptomChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[5px] bg-ink/[0.05] px-2 py-1 text-xs font-medium text-ink-dim">
      <SymptomIcon tag={tag} size={14} className="text-rust" />
      {sentence(t(humanize(tag)))}
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
    <section className={`surface rounded-xl ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="group flex flex-wrap items-center gap-2.5">
            {icon && <span className="text-rust">{icon}</span>}
            <h2 className="font-display text-lg font-semibold text-ink">{tNode(title)}</h2>
            {tag}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const fieldBase =
  "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-mute outline-none transition focus:border-rust focus:ring-2 focus:ring-rust/15 disabled:opacity-60";

export function Field({ label, hint, error, children }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-semibold text-ink-dim">{tNode(label)}</span>
      {children}
      {error ? <span className="block text-xs text-alert">{t(error)}</span> : hint ? <span className="block text-xs text-ink-mute">{tNode(hint)}</span> : null}
    </label>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${fieldBase} h-10 ${p.className ?? ""}`} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={`${fieldBase} min-h-24 resize-y leading-relaxed ${p.className ?? ""}`} />
);
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${fieldBase} h-10 ${p.className ?? ""}`} />;

export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
      <div className="text-ink-mute">{icon ?? <GearsIcon size={36} />}</div>
      <p className="font-display text-lg font-semibold text-ink-dim">{t(title)}</p>
      {body && <p className="max-w-md text-sm text-ink-mute">{t(body)}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = errorText(error);
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

export function Stat({ label, value, sub, tone = "brass" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "brass" | "rust" | "alert" | "ok" | "warn" }) {
  const color = { brass: "text-brass", rust: "text-rust", alert: "text-alert", ok: "text-ok", warn: "text-warn" }[tone];
  return (
    <div>
      <div className="text-[13px] font-medium text-ink-mute">{t(label)}</div>
      <div className={`mt-1 font-display text-4xl font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-mute">{sub}</div>}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t(title)}
            initial={{ scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0 }}
            className="surface w-full max-w-md overflow-hidden rounded-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {danger && <div className="hazard-stripe h-1.5" />}
            <div className="space-y-2 p-6">
              <h3 className="font-display text-xl font-semibold">{t(title)}</h3>
              <div className="text-sm text-ink-dim">{tNode(body)}</div>
            </div>
            <div className="flex justify-end gap-3 border-t border-line bg-sunk/50 px-6 py-4">
              <Button3D variant="ghost" onClick={onClose}>
                Cancel
              </Button3D>
              <Button3D variant={danger ? "danger" : "primary"} loading={busy} onClick={onConfirm} autoFocus>
                {t(confirmLabel)}
              </Button3D>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------- toasts

type Toast = { id: number; tone: "ok" | "alert" | "info"; text: string };
const ToastCtx = createContext<(tone: Toast["tone"], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, tone, text: t(text) }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-24 right-4 z-[60] lg:bottom-4 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-auto flex items-start gap-3 rounded-lg bg-espresso p-3.5 text-sm text-cream shadow-lg"
            >
              <span className={t.tone === "alert" ? "text-[#f0a49b]" : "text-[#9fd4ae]"}>
                {t.tone === "alert" ? <XIcon size={18} /> : <CheckIcon size={18} />}
              </span>
              <span className="flex-1">{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export function errorText(e: unknown) {
  return t(e instanceof Error ? e.message : "Something went wrong");
}
