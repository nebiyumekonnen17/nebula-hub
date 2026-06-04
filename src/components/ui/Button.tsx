import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "../../lib/styles";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  children?: ReactNode;
  icon?: ReactNode;
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-cyan-300/45 bg-cyan-300/15 text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,0.18)] hover:border-cyan-200 hover:bg-cyan-300/22",
  secondary:
    "border-white/12 bg-white/[0.07] text-white hover:border-white/25 hover:bg-white/[0.11]",
  ghost:
    "border-transparent bg-transparent text-slate-300 hover:border-white/12 hover:bg-white/[0.06] hover:text-white",
  danger:
    "border-rose-300/35 bg-rose-400/10 text-rose-100 hover:border-rose-200/60 hover:bg-rose-400/16",
};

export function Button({
  children,
  icon,
  className,
  variant = "secondary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ y: props.disabled ? 0 : -1 }}
      whileTap={{ scale: props.disabled ? 1 : 0.98 }}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        className,
      )}
      type={type}
      {...props}
    >
      {icon}
      {children}
    </motion.button>
  );
}
