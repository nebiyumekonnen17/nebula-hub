import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  BookMarked,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Flame,
  RefreshCcw,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingSkeleton } from "../../components/feedback/LoadingSkeleton";
import { SetupState } from "../../components/feedback/SetupState";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { generateStudyBrief } from "../../lib/ai/gemini";
import { readMissionHistory, type MissionResult } from "../../lib/lab/architectureLab";
import { fetchServices } from "../../lib/supabase/queries";
import { useSupabase } from "../../lib/supabase/SupabaseProvider";
import type { AwsService } from "../../lib/supabase/types";
import {
  buildStudyInsights,
  defaultStudyOsState,
  readQuizStats,
  readReviewQueue,
  readSavedServiceIds,
  readStudyBrief,
  readStudyOsState,
  removeReviewQueueItem,
  studyStateEvent,
  updateReviewQueueItemStatus,
  writeStudyBrief,
  writeStudyOsState,
  type ReviewQueueItem,
  type StudyBriefCache,
} from "../../lib/study/studyState";
import { cn } from "../../lib/styles";

const featureImage =
  "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1500&q=80";

function percent(score: number, total: number) {
  return total ? Math.round((score / total) * 100) : 0;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function StudyPage() {
  const { envStatus, client } = useSupabase();
  const navigate = useNavigate();
  const [services, setServices] = useState<AwsService[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(client));
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState(readQuizStats);
  const [savedServiceIds, setSavedServiceIds] = useState(readSavedServiceIds);
  const [reviewQueue, setReviewQueue] = useState(readReviewQueue);
  const [missionHistory, setMissionHistory] = useState(readMissionHistory);
  const [studyState, setStudyState] = useState(readStudyOsState);
  const [studyBrief, setStudyBrief] = useState<StudyBriefCache | null>(readStudyBrief);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  useEffect(() => {
    const refreshLocalState = () => {
      setStats(readQuizStats());
      setSavedServiceIds(readSavedServiceIds());
      setReviewQueue(readReviewQueue());
      setMissionHistory(readMissionHistory());
      setStudyState(readStudyOsState());
      setStudyBrief(readStudyBrief());
    };

    window.addEventListener(studyStateEvent, refreshLocalState);
    window.addEventListener("storage", refreshLocalState);
    return () => {
      window.removeEventListener(studyStateEvent, refreshLocalState);
      window.removeEventListener("storage", refreshLocalState);
    };
  }, []);

  useEffect(() => {
    if (!client) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchServices(client)
      .then((rows) => {
        if (isMounted) {
          setServices(rows);
        }
      })
      .catch((caught) => {
        if (isMounted) {
          setError(caught instanceof Error ? caught.message : "Study OS could not load services.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [client]);

  const insights = useMemo(() => buildStudyInsights(stats), [stats]);
  const savedServices = useMemo(
    () =>
      savedServiceIds
        .map((id) => services.find((service) => service.id === id))
        .filter(Boolean) as AwsService[],
    [savedServiceIds, services],
  );
  const activeQueue = reviewQueue.filter((item) => item.status === "queued");
  const reviewedQueue = reviewQueue.filter((item) => item.status === "reviewed");
  const missionCategory =
    studyState.focusCategory ??
    insights.weakCategories[0]?.category ??
    savedServices[0]?.category ??
    "Full exam baseline";
  const today = new Date().toISOString().slice(0, 10);
  const isMissionComplete = studyState.missionDate === today;
  const aiKey = envStatus.env.geminiApiKey?.trim();

  const generateBrief = async () => {
    if (!aiKey) {
      return;
    }

    setIsGeneratingBrief(true);
    setBriefError(null);

    try {
      const brief = await generateStudyBrief(
        {
          bestScore: insights.bestScore,
          latestScore: insights.latestScore,
          readinessScore: insights.readinessScore,
          recentScores: stats.history.slice(0, 5).map((item) => `${percent(item.score, item.total)}% ${item.category}`),
          recentTrend: insights.recentTrend,
          reviewQueue: activeQueue.slice(0, 8).map((item) => item.title),
          savedServices: savedServices.slice(0, 8).map((service) => service.service_name),
          weakCategories: insights.weakCategories.map((item) => item.category),
        },
        aiKey,
      );

      writeStudyBrief(brief);
      setStudyBrief(brief);
    } catch (caught) {
      setBriefError(caught instanceof Error ? caught.message : "Study brief could not be generated.");
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  const markMissionComplete = () => {
    const next = {
      ...defaultStudyOsState,
      ...studyState,
      focusCategory: missionCategory,
      missionDate: today,
    };
    writeStudyOsState(next);
    setStudyState(next);
  };

  const updateQueueStatus = (id: string, status: ReviewQueueItem["status"]) => {
    setReviewQueue(updateReviewQueueItemStatus(id, status));
  };

  const removeQueueItem = (id: string) => {
    setReviewQueue(removeReviewQueueItem(id));
  };

  if (!envStatus.isSupabaseReady) {
    return <SetupState missingKeys={envStatus.missingSupabaseKeys} />;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton className="h-80" />
        <div className="grid gap-4 lg:grid-cols-3">
          <LoadingSkeleton className="h-64" />
          <LoadingSkeleton className="h-64" />
          <LoadingSkeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        action={<Button onClick={() => window.location.reload()} variant="primary">Reload Study OS</Button>}
        message={error}
        title="Study OS needs attention"
      />
    );
  }

  return (
    <div className="space-y-6">
      <GlassPanel className="relative overflow-hidden p-5 md:p-7" glow="cyan">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 opacity-30 lg:block">
          <img alt="" className="h-full w-full object-cover" src={featureImage} />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/82 to-slate-950/25" />
        </div>
        <div className="relative grid gap-6 xl:grid-cols-[0.9fr_1.1fr] xl:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-100">
              <Target className="h-4 w-4" />
              Study OS
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl">
              Your AWS readiness command center.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Local exam history, saved services, review queue, and AI study planning in one dense operating view.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                icon={<BrainCircuit className="h-4 w-4" />}
                onClick={() => navigate("/quiz")}
                variant="primary"
              >
                Open exam
              </Button>
              <Button
                icon={<BookMarked className="h-4 w-4" />}
                onClick={() =>
                  navigate(
                    insights.weakCategories[0]
                      ? `/wiki?category=${encodeURIComponent(insights.weakCategories[0].category)}`
                      : "/wiki",
                  )
                }
              >
                Study weak area
              </Button>
              <Button
                icon={<FlaskConical className="h-4 w-4" />}
                onClick={() => navigate("/lab?mission=secure-api")}
              >
                Run mission
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <ReadinessRing value={insights.readinessScore} />
            <div className="grid gap-3 sm:grid-cols-2">
              <StudyMetric label="Latest" value={`${insights.latestScore}%`} />
              <StudyMetric label="Best" value={`${insights.bestScore}%`} />
              <StudyMetric
                label="Trend"
                value={`${insights.recentTrend >= 0 ? "+" : ""}${insights.recentTrend}%`}
              />
              <StudyMetric label="Queue" value={activeQueue.length} />
            </div>
          </div>
        </div>
      </GlassPanel>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <GlassPanel className="p-5" glow="teal">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Daily mission
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{missionCategory}</h2>
            </div>
            <CalendarDays className="h-6 w-6 text-teal-200" />
          </div>
          <div className="mt-5 grid gap-3">
            {insights.recommendedActions.slice(0, 3).map((action, index) => (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm leading-6 text-slate-300"
                initial={{ opacity: 0, x: 10 }}
                key={action}
                transition={{ delay: index * 0.06 }}
              >
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-200 shadow-[0_0_14px_rgba(103,232,249,0.8)]" />
                {action}
              </motion.div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              disabled={isMissionComplete}
              icon={<CheckCircle2 className="h-4 w-4" />}
              onClick={markMissionComplete}
              variant={isMissionComplete ? "ghost" : "primary"}
            >
              {isMissionComplete ? "Mission logged" : "Mark mission"}
            </Button>
            <Button icon={<ClipboardList className="h-4 w-4" />} onClick={() => navigate("/quiz")}>
              Review exam
            </Button>
          </div>
        </GlassPanel>

        <WeakAreaMatrix insights={insights} />
      </section>

      <MissionProgressPanel
        history={missionHistory}
        onOpenLab={() => navigate("/lab?mission=secure-api")}
      />

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SavedServicesDeck services={savedServices} onOpen={(serviceId) => navigate(`/wiki?service=${serviceId}`)} />
        <ReviewQueuePanel
          activeQueue={activeQueue}
          onMarkReviewed={(id) => updateQueueStatus(id, "reviewed")}
          onRemove={removeQueueItem}
          reviewedCount={reviewedQueue.length}
        />
      </section>

      <StudyBriefPanel
        brief={studyBrief}
        canGenerate={Boolean(aiKey)}
        error={briefError}
        isGenerating={isGeneratingBrief}
        onGenerate={() => void generateBrief()}
      />
    </div>
  );
}

function ReadinessRing({ value }: { value: number }) {
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative mx-auto h-40 w-40">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 160 160">
        <circle
          cx="80"
          cy="80"
          fill="none"
          r={radius}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="12"
        />
        <motion.circle
          animate={{ strokeDashoffset: offset }}
          cx="80"
          cy="80"
          fill="none"
          initial={{ strokeDashoffset: circumference }}
          r={radius}
          stroke="url(#readinessGradient)"
          strokeDasharray={circumference}
          strokeLinecap="round"
          strokeWidth="12"
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="readinessGradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="58%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold text-white">{value}</span>
        <span className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Readiness
        </span>
      </div>
    </div>
  );
}

function StudyMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function MissionProgressPanel({
  history,
  onOpenLab,
}: {
  history: MissionResult[];
  onOpenLab: () => void;
}) {
  const bestScore = Math.max(0, ...history.map((item) => item.score));
  const latest = history[0];

  return (
    <GlassPanel className="p-5" glow="amber">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Scenario missions
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Architecture readiness loop</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Lab missions test AWS design judgment and feed missed services or decisions into the local review queue.
          </p>
        </div>
        <Button icon={<FlaskConical className="h-4 w-4" />} onClick={onOpenLab} variant="primary">
          Open Architecture Lab
        </Button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <StudyMetric label="Completed" value={history.length} />
        <StudyMetric label="Best mission" value={`${bestScore}%`} />
        <StudyMetric label="Latest" value={latest ? `${latest.score}%` : "None"} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {history.length ? (
          history.slice(0, 3).map((item) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4" key={`${item.missionId}-${item.completedAt}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="line-clamp-2 text-sm font-semibold leading-5 text-white">{item.missionTitle}</p>
                <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-2 py-1 text-xs font-semibold text-cyan-100">
                  {item.score}%
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{formatDate(item.completedAt)}</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {item.missedQuestions.length + item.missedServices.length
                  ? `${item.missedQuestions.length + item.missedServices.length} decisions need review`
                  : "Clean mission pass"}
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-white/12 bg-black/20 p-4 text-sm leading-6 text-slate-400 md:col-span-3">
            Run a Scenario Mission in Architecture Lab to start tracking design-readiness here.
          </p>
        )}
      </div>
    </GlassPanel>
  );
}

function WeakAreaMatrix({ insights }: { insights: ReturnType<typeof buildStudyInsights> }) {
  const rows = insights.categoryInsights.slice(0, 10);

  return (
    <GlassPanel className="p-5" glow="cyan">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Weak-area matrix
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Category signal</h2>
        </div>
        <TrendingUp className="h-6 w-6 text-cyan-200" />
      </div>

      <div className="mt-5 space-y-3">
        {rows.length ? (
          rows.map((item) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4" key={item.category}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{item.category}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.correct}/{item.total} correct
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    item.accuracy >= 72
                      ? "border-teal-200/25 bg-teal-200/10 text-teal-100"
                      : "border-amber-200/25 bg-amber-200/10 text-amber-100",
                  )}
                >
                  {item.accuracy}%
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-200 via-teal-200 to-amber-200"
                  style={{ width: `${item.accuracy}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-white/12 bg-black/20 p-4 text-sm leading-6 text-slate-400">
            Category heat will appear after the first submitted exam.
          </p>
        )}
      </div>
    </GlassPanel>
  );
}

function SavedServicesDeck({
  onOpen,
  services,
}: {
  onOpen: (serviceId: number) => void;
  services: AwsService[];
}) {
  return (
    <GlassPanel className="p-5" glow="teal">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Saved services
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Quick review deck</h2>
        </div>
        <BookMarked className="h-6 w-6 text-teal-200" />
      </div>

      <div className="mt-5 grid gap-3">
        {services.length ? (
          services.slice(0, 6).map((service) => (
            <button
              className="group rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left transition hover:border-cyan-200/25 hover:bg-cyan-200/10"
              key={service.id}
              onClick={() => onOpen(service.id)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{service.service_name}</p>
                  <p className="mt-1 text-xs text-slate-500">{service.category ?? "Uncategorized"}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-300">
                  {service.mastery_level ?? 0}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
                {service.summary ?? "No summary available."}
              </p>
            </button>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-white/12 bg-black/20 p-4 text-sm leading-6 text-slate-400">
            Bookmark services from the wiki modal and they will appear here.
          </p>
        )}
      </div>
    </GlassPanel>
  );
}

function ReviewQueuePanel({
  activeQueue,
  onMarkReviewed,
  onRemove,
  reviewedCount,
}: {
  activeQueue: ReviewQueueItem[];
  onMarkReviewed: (id: string) => void;
  onRemove: (id: string) => void;
  reviewedCount: number;
}) {
  return (
    <GlassPanel className="p-5" glow="cyan">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Review queue
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Active recall stack</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-semibold text-slate-300">
          {reviewedCount} reviewed
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {activeQueue.length ? (
          activeQueue.slice(0, 8).map((item) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4" key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold leading-5 text-white">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.category ?? "Uncategorized"} / {item.type === "service" ? "Service" : "Question"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    aria-label={`Mark ${item.title} reviewed`}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-200/20 bg-teal-200/10 text-teal-100 transition hover:border-teal-200/40"
                    onClick={() => onMarkReviewed(item.id)}
                    type="button"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <button
                    aria-label={`Remove ${item.title}`}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-slate-300 transition hover:border-rose-200/30 hover:text-rose-100"
                    onClick={() => onRemove(item.id)}
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{item.reason}</p>
              <p className="mt-3 text-xs text-slate-600">Added {formatDate(item.addedAt)}</p>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-white/12 bg-black/20 p-4 text-sm leading-6 text-slate-400">
            Missed questions and important services will collect here.
          </p>
        )}
      </div>
    </GlassPanel>
  );
}

function StudyBriefPanel({
  brief,
  canGenerate,
  error,
  isGenerating,
  onGenerate,
}: {
  brief: StudyBriefCache | null;
  canGenerate: boolean;
  error: string | null;
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  return (
    <GlassPanel className="p-5" glow="amber">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            AI study brief
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Weekly operating plan</h2>
          {brief ? (
            <p className="mt-2 text-xs text-slate-500">Cached {formatDate(brief.generatedAt)}</p>
          ) : null}
        </div>
        <Button
          disabled={!canGenerate || isGenerating}
          icon={isGenerating ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          onClick={onGenerate}
          variant={brief ? "ghost" : "primary"}
        >
          {brief ? "Refresh brief" : "Generate brief"}
        </Button>
      </div>

      {!canGenerate ? (
        <p className="mt-5 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-4 text-sm leading-6 text-amber-100">
          Gemini is optional. Add the local key when you want a cached weekly brief.
        </p>
      ) : null}

      {error ? (
        <p className="mt-5 rounded-2xl border border-rose-200/25 bg-rose-200/10 p-4 text-sm leading-6 text-rose-100">
          {error}
        </p>
      ) : null}

      {brief ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 xl:col-span-3">
            <p className="text-sm leading-7 text-slate-300">{brief.summary}</p>
          </div>
          <BriefList icon={<CalendarDays className="h-4 w-4 text-cyan-200" />} items={brief.weeklyPlan} title="Weekly plan" />
          <BriefList icon={<Flame className="h-4 w-4 text-amber-200" />} items={brief.focusAreas} title="Focus areas" />
          <BriefList icon={<Target className="h-4 w-4 text-teal-200" />} items={brief.examTactics} title="Exam tactics" />
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-white/12 bg-black/20 p-4 text-sm leading-6 text-slate-400">
          The brief will use only local quiz history, saved services, and active review items.
        </p>
      )}
    </GlassPanel>
  );
}

function BriefList({ icon, items, title }: { icon: ReactNode; items: string[]; title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {icon}
        {title}
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <p className="text-sm leading-6 text-slate-300" key={item}>
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
