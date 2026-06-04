import { Activity, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "../../lib/styles";

type BeaconTone = "online" | "checking" | "offline" | "setup";

type StatusBeaconProps = {
  tone: BeaconTone;
  label: string;
  detail?: string;
};

const toneStyles: Record<BeaconTone, string> = {
  online: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  checking: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  offline: "border-rose-300/35 bg-rose-300/10 text-rose-100",
  setup: "border-amber-300/35 bg-amber-300/10 text-amber-100",
};

const icons = {
  online: <CheckCircle2 className="h-4 w-4" />,
  checking: <Loader2 className="h-4 w-4 animate-spin" />,
  offline: <AlertTriangle className="h-4 w-4" />,
  setup: <Activity className="h-4 w-4" />,
};

export function StatusBeacon({ tone, label, detail }: StatusBeaconProps) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-3 rounded-full border px-3 py-2 text-xs font-semibold",
        toneStyles[tone],
      )}
    >
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
        <span className="absolute h-5 w-5 rounded-full bg-current opacity-15 blur-sm" />
        {icons[tone]}
      </span>
      <span className="truncate">{label}</span>
      {detail ? <span className="hidden text-slate-300/80 md:inline">{detail}</span> : null}
    </div>
  );
}
