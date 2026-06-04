import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { GlassPanel } from "../ui/GlassPanel";

type EmptyStateProps = {
  title: string;
  message: string;
  action?: ReactNode;
};

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <GlassPanel className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-cyan-200">
        <SearchX className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </GlassPanel>
  );
}
