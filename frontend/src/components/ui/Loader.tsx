import { GearIcon } from "../icons/MachineIcons";

export function Loader({ label = "Spinning up" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-ink-mute" role="status">
      <GearIcon size={42} className="animate-spin text-ember" style={{ animationDuration: "2.5s" }} />
      <span className="font-mono text-xs uppercase tracking-[0.3em]">{label}…</span>
    </div>
  );
}
