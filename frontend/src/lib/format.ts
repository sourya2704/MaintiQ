import { dateLocale, t } from "./i18n";
import type { MachineStatus, ProcessingStatus, ResolutionStatus, Urgency } from "./types";

export function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(dateLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return t("just now");
  const units: [number, string][] = [
    [60, "{n}min ago"],
    [3600, "{n}h ago"],
    [86400, "{n}d ago"],
    [2592000, "{n}mo ago"],
    [31536000, "{n}y ago"],
  ];
  let label = "{n}min ago";
  let value = s / 60;
  for (let i = units.length - 1; i >= 0; i--) {
    if (s >= units[i][0]) {
      value = s / units[i][0];
      label = units[i][1];
      break;
    }
  }
  return t(label, { n: Math.floor(value) });
}

export const humanize = (s: string) => s.replace(/_/g, " ");

type Tone = "ok" | "warn" | "alert" | "brass" | "rust" | "mute" | "taupe";

export const machineStatusTone: Record<MachineStatus, Tone> = {
  operational: "ok",
  degraded: "warn",
  down: "alert",
  retired: "mute",
};

export const resolutionTone: Record<ResolutionStatus, Tone> = {
  open: "rust",
  monitoring: "warn",
  resolved: "ok",
  unresolved: "alert",
};

export const urgencyTone: Record<Urgency, Tone> = {
  unknown: "mute",
  needs_review: "warn",
  routine: "brass",
  urgent: "alert",
};

export const processingTone: Record<ProcessingStatus, Tone> = {
  uploaded: "mute",
  transcribing: "brass",
  transcription_failed: "alert",
  transcribed: "brass",
  analyzing: "taupe",
  analysis_failed: "alert",
  awaiting_review: "warn",
};

export const PROCESSING_ACTIVE: ProcessingStatus[] = ["transcribing", "analyzing"];

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export type { Tone };
