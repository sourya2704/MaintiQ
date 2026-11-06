import type { ReactNode } from "react";

/**
 * Plain card that fades up once when it appears and lifts slightly on hover when clickable.
 * The entry is a CSS animation (no observer, no script per card); `delay` staggers a group
 * and is capped so the last card of a long list is never left waiting.
 */
export function Card({
  children,
  className = "",
  delay = 0,
  onClick,
  alert,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  onClick?: () => void;
  alert?: boolean;
}) {
  return (
    <div
      style={delay ? { animationDelay: `${Math.min(delay, 0.24)}s` } : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`surface enter group h-full rounded-xl ${alert ? "!border-alert/50" : ""} ${
        onClick ? "cursor-pointer transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
