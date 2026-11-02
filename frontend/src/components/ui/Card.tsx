import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Plain card that fades up once when scrolled into view and lifts slightly on hover when clickable. */
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.35, delay }}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`surface group h-full rounded-xl ${alert ? "!border-alert/50" : ""} ${
        onClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md" : ""
      } ${className}`}
    >
      {children}
    </motion.div>
  );
}
