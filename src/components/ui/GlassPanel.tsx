import type { HTMLAttributes } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "../../lib/styles";

type GlassPanelProps = HTMLAttributes<HTMLDivElement> &
  HTMLMotionProps<"div"> & {
    glow?: "cyan" | "teal" | "amber" | "none";
  };

const glows = {
  cyan: "shadow-[0_24px_80px_rgba(8,145,178,0.16)]",
  teal: "shadow-[0_24px_80px_rgba(20,184,166,0.14)]",
  amber: "shadow-[0_24px_80px_rgba(245,158,11,0.12)]",
  none: "",
};

export function GlassPanel({ children, className, glow = "cyan", ...props }: GlassPanelProps) {
  return (
    <motion.div
      className={cn(
        "rounded-2xl border border-white/10 bg-slate-950/58 backdrop-blur-2xl",
        "ring-1 ring-white/[0.03]",
        glows[glow],
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
