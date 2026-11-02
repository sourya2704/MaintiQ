import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { processingTone, resolutionTone, timeAgo, urgencyTone } from "../../lib/format";
import type { IncidentListItem } from "../../lib/types";
import { ChevronRight, MachineTypeIcon } from "../icons/MachineIcons";
import { Pill, StatusPill, SymptomChip } from "../ui/kit";

export function IncidentRow({ inc, index = 0, compact }: { inc: IncidentListItem; index?: number; compact?: boolean }) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -14 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
    >
      <Link
        to={`/incidents/${inc.id}`}
        className="group flex items-center gap-4 rounded-xl border border-transparent px-3 py-3 transition hover:border-line hover:bg-panel-2/60"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-deck text-plasma transition group-hover:border-plasma/50 group-hover:shadow-[0_0_16px_-4px_#22d3ee]">
          <MachineTypeIcon type={inc.machine.type} size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-ember">{inc.machine.asset_code}</span>
            <span className="truncate text-sm text-ink">{inc.summary ?? "Awaiting transcript…"}</span>
          </div>
          {!compact && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {inc.symptom_tags.slice(0, 4).map((t) => (
                <SymptomChip key={t} tag={t} />
              ))}
              {inc.is_seed && <Pill tone="mute">demo data</Pill>}
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
        <ChevronRight size={16} className="shrink-0 text-ink-mute transition group-hover:translate-x-1 group-hover:text-ember" />
      </Link>
    </motion.li>
  );
}
