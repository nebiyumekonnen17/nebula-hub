import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckSquare,
  Cloud,
  Database,
  FileText,
  LockKeyhole,
  Network,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import type { BlueprintNode, BlueprintSpec } from "../../lib/lab/architectureLab";
import { cn } from "../../lib/styles";

const zoneIcons = {
  entry: Cloud,
  core: ServerCog,
  protected: Database,
};

function getNode(spec: BlueprintSpec, zone: BlueprintNode["zone"]) {
  return spec.nodes.find((node) => node.zone === zone) ?? spec.nodes[0];
}

export function BlueprintPoster({ className, spec }: { className?: string; spec: BlueprintSpec }) {
  const entryNode = getNode(spec, "entry");
  const coreNode = getNode(spec, "core");
  const protectedNode = getNode(spec, "protected");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-sky-100/70 bg-[#07508d] p-3 text-sky-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25),0_24px_80px_rgba(7,80,141,0.26)]",
        className,
      )}
    >
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:14px_14px]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:70px_70px]" />
      <motion.div
        animate={{ x: ["-25%", "130%"] }}
        className="absolute left-0 top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        transition={{ duration: 6.5, ease: "linear", repeat: Infinity }}
      />

      <div className="relative border border-white/80 p-3 md:p-4">
        <BlueprintCorner className="left-3 top-3" />
        <BlueprintCorner className="right-3 top-3" />
        <BlueprintCorner className="bottom-3 left-3" />
        <BlueprintCorner className="bottom-3 right-3" />

        <header className="border-b border-white/70 pb-4 text-center">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-sky-100/80">
            Nebula-Hub Architecture Blueprint
          </p>
          <h2 className="mt-2 text-2xl font-semibold uppercase leading-tight text-white md:text-4xl">
            {spec.title}
          </h2>
          <p className="mt-2 text-sm font-semibold text-sky-100 md:text-base">{spec.subtitle}</p>
        </header>

        <div className="mt-4 grid gap-4 xl:grid-cols-[16rem_1fr]">
          <aside className="rounded-lg border border-white/80 bg-blue-950/10 p-3">
            <p className="border-b border-white/70 pb-2 text-xs font-semibold uppercase tracking-[0.16em]">
              10-step workflow
            </p>
            <div className="mt-2 space-y-2">
              {spec.workflow.slice(0, 10).map((step, index) => (
                <div
                  className="grid grid-cols-[1.65rem_1fr] gap-2 border-b border-dashed border-white/55 pb-2 last:border-b-0 last:pb-0"
                  key={`${step}-${index}`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/90 text-xs font-semibold">
                    {index + 1}
                  </span>
                  <span className="text-xs font-semibold leading-5 text-sky-50">{step}</span>
                </div>
              ))}
            </div>
          </aside>

          <main className="rounded-lg border border-white/80 p-3">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
              AWS architecture boundary
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_0.16fr_1.08fr_0.16fr_1fr] md:items-center">
              <BlueprintNodeCard node={entryNode} />
              <FlowArrow />
              <BlueprintNodeCard featured node={coreNode} />
              <FlowArrow />
              <BlueprintNodeCard node={protectedNode} />
            </div>

            <div className="mt-4 rounded-lg border border-white/80 p-3">
              <div className="flex items-center gap-2 border-b border-white/60 pb-2 text-xs font-semibold uppercase tracking-[0.16em]">
                <Network className="h-4 w-4" />
                Request / Event Path
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {spec.trafficPath.map((item, index) => (
                  <div className="flex items-center gap-2" key={`${item}-${index}`}>
                    <span className="rounded border border-white/70 bg-white/10 px-2 py-1 text-xs font-semibold">
                      {item}
                    </span>
                    {index < spec.trafficPath.length - 1 ? (
                      <ArrowRight className="h-4 w-4 text-sky-100" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <BlueprintMiniPanel
                icon={<ShieldCheck className="h-4 w-4" />}
                rows={["Least privilege", "Private path checked", "Audit signal captured"]}
                title="A. Security"
              />
              <BlueprintMiniPanel
                icon={<LockKeyhole className="h-4 w-4" />}
                rows={["Managed fit", "Scaling behavior", "Failure path known"]}
                title="B. Operations"
              />
              <BlueprintMiniPanel
                icon={<CheckSquare className="h-4 w-4" />}
                rows={spec.examChecks.slice(0, 3)}
                title="C. Exam Check"
              />
            </div>
          </main>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_13rem]">
          <section className="rounded-lg border border-white/80 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
              <FileText className="h-4 w-4" />
              Key Beginner Notes
            </div>
            <ul className="space-y-1">
              {spec.keyNotes.slice(0, 3).map((note) => (
                <li className="text-xs leading-5 text-sky-50" key={note}>
                  - {note}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-white/80 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
              <CheckSquare className="h-4 w-4" />
              Exam Questions To Ask
            </div>
            <ul className="space-y-1">
              {spec.examChecks.slice(0, 5).map((check) => (
                <li className="text-xs leading-5 text-sky-50" key={check}>
                  - {check}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-white/80 p-3 text-xs leading-5">
            <div className="grid grid-cols-[3.25rem_1fr] border-b border-white/60 pb-1">
              <span>Drawn</span>
              <span>Nebula-Hub</span>
            </div>
            <div className="grid grid-cols-[3.25rem_1fr] border-b border-white/60 py-1">
              <span>Source</span>
              <span>{spec.source === "gemini" ? "AI text" : "Local"}</span>
            </div>
            <div className="grid grid-cols-[3.25rem_1fr] border-b border-white/60 py-1">
              <span>Scale</span>
              <span>NTS</span>
            </div>
            <div className="grid grid-cols-[3.25rem_1fr] pt-1">
              <span>Rev</span>
              <span>Study OS</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function BlueprintNodeCard({ featured = false, node }: { featured?: boolean; node: BlueprintNode }) {
  const Icon = zoneIcons[node.zone];

  return (
    <div
      className={cn(
        "min-h-52 rounded-lg border border-dashed border-white/85 p-3 text-center",
        featured && "border-solid bg-white/10 shadow-[0_0_28px_rgba(255,255,255,0.12)]",
      )}
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-white/80 bg-blue-950/10">
        <Icon className="h-8 w-8" />
      </div>
      <p className="mt-3 text-lg font-semibold leading-6 text-white">{node.label}</p>
      <p className="mt-2 text-xs leading-5 text-sky-100/90">{node.detail}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center">
      <div className="hidden h-px w-full border-t border-dashed border-white/80 md:block" />
      <ArrowRight className="h-7 w-7 text-sky-50 md:absolute" />
    </div>
  );
}

function BlueprintMiniPanel({ icon, rows, title }: { icon: ReactNode; rows: string[]; title: string }) {
  return (
    <div className="rounded-lg border border-white/75 p-3">
      <div className="flex items-center gap-2 border-b border-white/60 pb-2 text-xs font-semibold uppercase tracking-[0.12em]">
        {icon}
        {title}
      </div>
      <div className="mt-2 space-y-1">
        {rows.map((row) => (
          <p className="text-xs leading-5 text-sky-50" key={row}>
            {row}
          </p>
        ))}
      </div>
    </div>
  );
}

function BlueprintCorner({ className }: { className: string }) {
  return (
    <span className={cn("pointer-events-none absolute h-8 w-8 text-white/90", className)}>
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/80" />
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/80" />
      <span className="absolute inset-2 rounded-full border border-white/80" />
    </span>
  );
}
