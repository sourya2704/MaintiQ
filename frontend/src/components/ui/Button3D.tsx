import { forwardRef, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { GearIcon } from "../icons/MachineIcons";

type Variant = "ember" | "plasma" | "steel" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const faces: Record<Variant, string> = {
  ember: "bg-gradient-to-b from-[#ffa64d] to-[#ff7a00] text-[#1a0d00] border-[#ffc285]/60",
  plasma: "bg-gradient-to-b from-[#5ee7f7] to-[#10b5d4] text-[#001a20] border-[#a5f3fc]/60",
  steel: "bg-gradient-to-b from-[#2a3a60] to-[#18233f] text-ink border-[#4b5f91]/60",
  danger: "bg-gradient-to-b from-[#fb7185] to-[#e11d48] text-white border-[#fecdd3]/50",
  ghost: "bg-transparent text-ink-dim border-line hover:text-ink",
};
const depths: Record<Variant, string> = {
  ember: "bg-[#8a3f00]",
  plasma: "bg-[#0b5563]",
  steel: "bg-[#0a1124]",
  danger: "bg-[#7f1029]",
  ghost: "bg-transparent",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2.5",
};

export interface Button3DProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
  block?: boolean;
}

/**
 * Physical-looking push button: a face layer sitting on a depth layer.
 * Hover lifts the face, press sinks it, and a light spot follows the cursor.
 */
export const Button3D = forwardRef<HTMLButtonElement, Button3DProps>(function Button3D(
  { variant = "steel", size = "md", icon, loading, block, children, className = "", disabled, onMouseMove, ...rest },
  ref,
) {
  const faceRef = useRef<HTMLSpanElement>(null);
  const flat = variant === "ghost";
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        faceRef.current?.style.setProperty("--mx", `${e.clientX - r.left}px`);
        faceRef.current?.style.setProperty("--my", `${e.clientY - r.top}px`);
        onMouseMove?.(e);
      }}
      className={`group relative inline-flex select-none rounded-lg disabled:cursor-not-allowed disabled:opacity-50 ${
        block ? "w-full" : ""
      } ${flat ? "" : "pb-[5px]"} ${className}`}
      {...rest}
    >
      {!flat && <span aria-hidden className={`absolute inset-x-0 bottom-0 top-[5px] rounded-lg ${depths[variant]}`} />}
      <span
        ref={faceRef}
        className={`relative flex w-full items-center justify-center overflow-hidden rounded-lg border font-semibold tracking-wide transition-transform duration-100 ease-out ${
          faces[variant]
        } ${sizes[size]} ${
          flat
            ? "border hover:bg-panel-2"
            : "group-hover:-translate-y-[2px] group-active:translate-y-[4px] group-disabled:translate-y-0"
        }`}
      >
        {!flat && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
            style={{
              background: "radial-gradient(120px circle at var(--mx) var(--my), rgb(255 255 255 / 0.35), transparent 60%)",
            }}
          />
        )}
        {!flat && <span aria-hidden className="absolute inset-x-2 top-0 h-px bg-white/50" />}
        {loading ? <GearIcon size={16} className="animate-spin" /> : icon}
        {children && <span className="relative">{children}</span>}
      </span>
    </button>
  );
});
