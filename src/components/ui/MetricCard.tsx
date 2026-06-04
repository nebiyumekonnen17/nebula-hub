import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/styles";

type MetricCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  accent?: "cyan" | "teal" | "amber" | "rose";
};

const accents = {
  cyan: "from-cyan-300/22 to-cyan-400/0 text-cyan-200",
  teal: "from-teal-300/22 to-teal-400/0 text-teal-200",
  amber: "from-amber-300/22 to-amber-400/0 text-amber-200",
  rose: "from-rose-300/20 to-rose-400/0 text-rose-200",
};

export function MetricCard({ icon, label, value, detail, accent = "cyan" }: MetricCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="group relative min-h-36 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] p-5 backdrop-blur-xl"
    >
      <div className={cn("absolute inset-x-0 top-0 h-24 bg-gradient-to-b", accents[accent])} />
      <div className="relative flex items-start justify-between gap-4">
        <div className={cn("rounded-xl border border-white/10 bg-black/25 p-3", accents[accent])}>
          {icon}
        </div>
        <ArrowUpRight className="h-4 w-4 text-slate-500 transition group-hover:text-slate-200" />
      </div>
      <div className="relative mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {label}
        </p>
        <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
      </div>
    </motion.div>
  );
}
