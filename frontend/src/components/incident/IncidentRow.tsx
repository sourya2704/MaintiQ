import { Link } from "react-router-dom";
import { processingTone, resolutionTone, timeAgo, urgencyTone } from "../../lib/format";
import { t } from "../../lib/i18n";
import type { IncidentListItem } from "../../lib/types";
import { ChevronRight, MachineTypeIcon } from "../icons/MachineIcons";
import { StatusPill, SymptomChip } from "../ui/kit";

export function IncidentRow({ inc, compact }: { inc: IncidentListItem; index?: number; compact?: boolean }) {
  return (
    <li>
      <Link
        to={`/incidents/${inc.id}`}
        className="group flex items-center gap-4 rounded-xl border border-transparent px-3 py-3 transition hover:border-line hover:bg-card-2/60"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-sunk text-brass transition group-hover:border-brass/50">
          <MachineTypeIcon type={inc.machine.type} size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-rust">{inc.machine.asset_code}</span>
            <span className="truncate text-sm text-ink">{inc.summary ?? t("Awaiting transcript…")}</span>
          </div>
          {!compact && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {inc.symptom_tags.slice(0, 4).map((t) => (
                <SymptomChip key={t} tag={t} />
              ))}
            </div>
          )}
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
          <div className="flex gap-1.5">
            {inc.urgency === "urgent" && <StatusPill value="urgent" tones={urgencyTone} />}
            {inc.processing_status !== "awaiting_review" && inc.review_status === "draft" ? (
              <StatusPill value={inc.processing_status} tones={processingTone} />
            ) : (
              <StatusPill value={inc.resolution_status} tones={resolutionTone} />
            )}
          </div>
          <span className="font-mono text-[11px] text-ink-mute">{timeAgo(inc.occurred_at)}</span>
        </div>
        <ChevronRight size={16} className="shrink-0 text-ink-mute transition group-hover:translate-x-1 group-hover:text-rust" />
      </Link>
    </li>
  );
}
