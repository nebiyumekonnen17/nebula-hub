import { KeyRound, TerminalSquare } from "lucide-react";
import { GlassPanel } from "../ui/GlassPanel";

type SetupStateProps = {
  missingKeys: string[];
};

export function SetupState({ missingKeys }: SetupStateProps) {
  return (
    <GlassPanel className="relative overflow-hidden p-8" glow="amber">
      <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="relative grid gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">
            <KeyRound className="h-4 w-4" />
            Local setup required
          </div>
          <h1 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight text-white md:text-5xl">
            Connect Supabase to bring Nebula-Hub online.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
            The interface is ready, but the read-only backend keys are missing. Add
            them to a local `.env` file and restart Vite.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/35 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <TerminalSquare className="h-4 w-4 text-cyan-200" />
            Required keys
          </div>
          <div className="space-y-2">
            {missingKeys.map((key) => (
              <code
                className="block rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-amber-100"
                key={key}
              >
                {key}
              </code>
            ))}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
