import { Link } from "react-router-dom";
import { t } from "../lib/i18n";
import type { FixPayload } from "../lib/types";
import { ShieldIcon, WrenchIcon, XIcon } from "./icons/MachineIcons";

/** A fix as a mechanic sees it: numbered steps first, then parts, stop conditions and don'ts. */
export function FixCard({ fix, incidentId, incidentLabel }: { fix: FixPayload; incidentId?: string | null; incidentLabel?: string | null }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-rust-deep">
        <WrenchIcon size={16} /> {t("Fix to carry out")}
      </div>
      {incidentId && (
        <Link to={`/incidents/${incidentId}`} className="block truncate text-xs font-medium text-brass underline-offset-2 hover:underline">
          {incidentLabel}
        </Link>
      )}
      {fix.summary && <p className="text-sm text-ink">{fix.summary}</p>}
      <ol className="space-y-2">
        {fix.steps.map((s, i) => (
          <li key={i} className="flex gap-3 rounded-lg bg-canvas/70 p-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rust text-xs font-bold text-cream">{i + 1}</span>
            <div className="min-w-0 text-sm">
              <div className="font-medium text-ink">{s.action}</div>
              {s.expected_finding && <div className="mt-0.5 text-xs text-ink-mute">{t("Expect:")} {s.expected_finding}</div>}
              {s.safety && <div className="mt-1 text-xs font-semibold text-alert">{s.safety}</div>}
            </div>
          </li>
        ))}
      </ol>
      {fix.parts_to_have.length > 0 && (
        <p className="text-xs text-ink-dim">
          <span className="font-semibold">{t("Bring:")}</span> {fix.parts_to_have.join(", ")}
        </p>
      )}
      {fix.escalate_if.length > 0 && (
        <ul className="space-y-1 text-xs text-ink-dim">
          {fix.escalate_if.map((e) => (
            <li key={e} className="flex gap-1.5">
              <ShieldIcon size={13} className="mt-0.5 shrink-0 text-alert" /> {e}
            </li>
          ))}
        </ul>
      )}
      {fix.do_not.length > 0 && (
        <ul className="space-y-1 text-xs text-ink-dim">
          {fix.do_not.map((d) => (
            <li key={d} className="flex gap-1.5">
              <XIcon size={13} className="mt-0.5 shrink-0 text-alert" /> {d}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
