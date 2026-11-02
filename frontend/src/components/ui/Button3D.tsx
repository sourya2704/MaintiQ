import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { GearIcon } from "../icons/MachineIcons";

type Variant = "primary" | "dark" | "neutral" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const faces: Record<Variant, string> = {
  primary: "bg-rust text-cream border-rust-deep",
  dark: "bg-espresso text-cream border-black/40",
  neutral: "bg-card text-ink border-line-strong",
  danger: "bg-alert text-cream border-[#7f261d]",
  ghost: "bg-transparent text-ink-dim border-transparent hover:bg-card-2 hover:text-ink",
};
const depths: Record<Variant, string> = {
  primary: "bg-rust-deep",
  dark: "bg-black/70",
  neutral: "bg-line-strong",
  danger: "bg-[#7f261d]",
  ghost: "",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
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

/** Push button with a solid base: lifts slightly on hover and presses down on click. */
export const Button3D = forwardRef<HTMLButtonElement, Button3DProps>(function Button3D(
  { variant = "neutral", size = "md", icon, loading, block, children, className = "", disabled, ...rest },
  ref,
) {
  const flat = variant === "ghost";
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`group relative inline-flex select-none rounded-lg disabled:cursor-not-allowed disabled:opacity-50 ${block ? "w-full" : ""} ${
        flat ? "" : "pb-1"
      } ${className}`}
      {...rest}
    >
      {!flat && <span aria-hidden className={`absolute inset-x-0 bottom-0 top-1 rounded-lg ${depths[variant]}`} />}
      <span
        className={`relative flex w-full items-center justify-center rounded-lg border font-semibold transition-transform duration-100 ${faces[variant]} ${sizes[size]} ${
          flat ? "" : "group-hover:-translate-y-px group-active:translate-y-[3px] group-disabled:translate-y-0"
        }`}
      >
        {loading ? <GearIcon size={16} className="animate-spin" /> : icon}
        {children && <span>{children}</span>}
      </span>
    </button>
  );
});
