import {
  AlertTriangle,
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  DatabaseZap,
  FlaskConical,
  Layers3,
  RefreshCcw,
  ServerCog,
  Sparkles,
  Target,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingSkeleton } from "../../components/feedback/LoadingSkeleton";
import { SetupState } from "../../components/feedback/SetupState";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { MetricCard } from "../../components/ui/MetricCard";
import { useSupabase } from "../../lib/supabase/SupabaseProvider";

const heroImage =
  "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1400&q=80";

export function DashboardPage() {
  const { envStatus, smoke, isChecking, error, refreshSmoke } = useSupabase();
  const navigate = useNavigate();

  if (!envStatus.isSupabaseReady) {
    return <SetupState missingKeys={envStatus.missingSupabaseKeys} />;
  }

  const serviceCategories = smoke?.services.categories ?? [];
  const quizCategories = smoke?.quiz.categories ?? [];
  const categoryCount = new Set([...serviceCategories, ...quizCategories]).size;
  const topServices = smoke?.services.sample.slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      <GlassPanel className="relative overflow-hidden p-5 md:p-8" glow="cyan">
        <div className="absolute inset-0 opacity-30">
          <img
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
            src={heroImage}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/86 to-slate-950/35" />
        </div>
        <div className="absolute right-8 top-8 hidden h-28 w-28 rounded-full border border-cyan-200/20 bg-cyan-200/10 blur-sm lg:block" />
        <div className="relative grid gap-8 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-100"
            >
              <Sparkles className="h-4 w-4" />
              Executive cloud cockpit
            </motion.div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.02] text-white md:text-6xl">
              Nebula-Hub brings AWS mastery into focus.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
              Live service intelligence, quiz readiness, and deep wiki context are
              staged in one read-only command center.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                icon={<Target className="h-4 w-4" />}
                onClick={() => navigate("/study")}
                variant="primary"
              >
                Open Study OS
              </Button>
              <Button
                icon={<BrainCircuit className="h-4 w-4" />}
                onClick={() => navigate("/quiz")}
              >
                Start quiz
              </Button>
              <Button
                icon={<FlaskConical className="h-4 w-4" />}
                onClick={() => navigate("/lab")}
              >
                Architecture Lab
              </Button>
              <Button
                icon={<BriefcaseBusiness className="h-4 w-4" />}
                onClick={() => navigate("/career")}
              >
                Career OS
              </Button>
              <Button icon={<BookOpen className="h-4 w-4" />} onClick={() => navigate("/wiki")}>
                Open wiki
              </Button>
              <Button
                icon={<RefreshCcw className="h-4 w-4" />}
                onClick={() => void refreshSmoke()}
                variant="ghost"
              >
                Refresh
              </Button>
            </div>
          </div>

          <div className="premium-orbit relative min-h-72 overflow-hidden rounded-2xl border border-white/10 p-5">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />
            <div className="relative grid h-full gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Backend telemetry
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {isChecking ? "Syncing" : error ? "Attention" : "Operational"}
                  </p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
                  <ServerCog className="h-7 w-7" />
                </div>
              </div>
              <div className="grid gap-3">
                {["Supabase anon channel", "AWS service corpus", "Quiz question bank"].map(
                  (label, index) => (
                    <motion.div
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.08 }}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/24 px-4 py-3"
                      key={label}
                    >
                      <span className="text-sm text-slate-300">{label}</span>
                      <span className="h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_14px_rgba(103,232,249,0.85)]" />
                    </motion.div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </GlassPanel>

      {error ? (
        <EmptyState
          action={
            <Button
              icon={<RefreshCcw className="h-4 w-4" />}
              onClick={() => void refreshSmoke()}
              variant="primary"
            >
              Retry check
            </Button>
          }
          message={error}
          title="Supabase read check needs attention"
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isChecking ? (
          <>
            <LoadingSkeleton className="h-36" />
            <LoadingSkeleton className="h-36" />
            <LoadingSkeleton className="h-36" />
            <LoadingSkeleton className="h-36" />
          </>
        ) : (
          <>
            <MetricCard
              accent="cyan"
              detail="Read from public.aws_services"
              icon={<DatabaseZap className="h-5 w-5" />}
              label="Services"
              value={String(smoke?.services.count ?? 0)}
            />
            <MetricCard
              accent="teal"
              detail="Derived from service and quiz rows"
              icon={<Layers3 className="h-5 w-5" />}
              label="Categories"
              value={String(categoryCount)}
            />
            <MetricCard
              accent="amber"
              detail="Read from public.aws_quiz_questions"
              icon={<BrainCircuit className="h-5 w-5" />}
              label="Quiz bank"
              value={String(smoke?.quiz.count ?? 0)}
            />
            <MetricCard
              accent={envStatus.isGeminiReady ? "teal" : "rose"}
              detail={envStatus.isGeminiReady ? "Gemini key detected locally" : "Optional key not set"}
              icon={envStatus.isGeminiReady ? <Sparkles className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              label="AI cache"
              value={envStatus.isGeminiReady ? "Ready" : "Off"}
            />
          </>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <GlassPanel className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Categories
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Knowledge map</h2>
            </div>
            <Layers3 className="h-5 w-5 text-cyan-200" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {[...new Set([...serviceCategories, ...quizCategories])].slice(0, 16).map((category) => (
              <span
                className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-300"
                key={category}
              >
                {category}
              </span>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="p-5" glow="teal">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Service preview
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Latest signal</h2>
            </div>
            <BookOpen className="h-5 w-5 text-teal-200" />
          </div>
          <div className="mt-5 grid gap-3">
            {topServices.length ? (
              topServices.map((service) => (
                <Link
                  className="group grid gap-3 rounded-xl border border-white/10 bg-white/[0.045] p-4 transition hover:border-cyan-200/25 hover:bg-white/[0.075] md:grid-cols-[1fr_auto]"
                  key={service.id}
                  to={`/wiki?service=${service.id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {service.service_name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-400">
                      {service.summary ?? "No summary available yet."}
                    </p>
                  </div>
                  <span className="self-start rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                    {service.category ?? "Uncategorized"}
                  </span>
                </Link>
              ))
            ) : (
              <p className="rounded-xl border border-white/10 bg-white/[0.045] p-4 text-sm text-slate-400">
                Service rows will appear here once Supabase returns data.
              </p>
            )}
          </div>
        </GlassPanel>
      </section>
    </div>
  );
}
