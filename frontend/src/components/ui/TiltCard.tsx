import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Card that tilts in 3D toward the cursor, with a moving glare,
 * and rises into place when scrolled into view.
 */
export function TiltCard({
  children,
  className = "",
  intensity = 10,
  delay = 0,
  onClick,
  glow,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
  delay?: number;
  onClick?: () => void;
  glow?: "ember" | "plasma" | "alert";
}) {
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rx = useSpring(useTransform(y, [0, 1], [intensity, -intensity]), { stiffness: 220, damping: 18 });
  const ry = useSpring(useTransform(x, [0, 1], [-intensity, intensity]), { stiffness: 220, damping: 18 });
  const glareX = useTransform(x, [0, 1], ["0%", "100%"]);
  const glareY = useTransform(y, [0, 1], ["0%", "100%"]);
  const glowClass = glow === "ember" ? "glow-ember" : glow === "plasma" ? "glow-plasma" : glow === "alert" ? "shadow-[0_0_0_1px_rgb(244_63_94/0.4),0_0_28px_-6px_rgb(244_63_94/0.6)]" : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, rotateX: -12 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ perspective: 900 }}
      className={onClick ? "cursor-pointer" : ""}
      onClick={onClick}
    >
      <motion.div
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          x.set((e.clientX - r.left) / r.width);
          y.set((e.clientY - r.top) / r.height);
        }}
        onMouseLeave={() => {
          x.set(0.5);
          y.set(0.5);
        }}
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className={`glass group relative h-full overflow-hidden rounded-2xl ${glowClass} ${className}`}
      >
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: "radial-gradient(circle, rgb(255 255 255 / 0.09) 0%, transparent 40%)",
            left: glareX,
            top: glareY,
            translateX: "-50%",
            translateY: "-50%",
            width: "200%",
            height: "200%",
          }}
        />
        <div style={{ transform: "translateZ(30px)" }} className="relative h-full">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
