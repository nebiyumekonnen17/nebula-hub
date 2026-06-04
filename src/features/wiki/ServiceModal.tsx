import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Bookmark,
  BookmarkCheck,
  Bot,
  Clock3,
  Cloud,
  Code2,
  Cpu,
  Database,
  ExternalLink,
  FlaskConical,
  ListPlus,
  LockKeyhole,
  Network,
  PlayCircle,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import {
  createFallbackServiceEnrichment,
  getTutorialVideoLinks,
  getYouTubeSearchUrl,
  generateServiceEnrichment,
  readCachedEnrichment,
  type GeminiEnrichment,
  type TutorialVideoLink,
} from "../../lib/ai/gemini";
import { normalizeCliSnippets } from "../../lib/supabase/queries";
import type { AwsService } from "../../lib/supabase/types";
import { readLocalValue } from "../../lib/storage/local";
import {
  getReviewQueueItemId,
  readReviewQueue,
  readSavedServiceIds,
  toggleSavedServiceId,
  upsertReviewQueueItem,
} from "../../lib/study/studyState";
import { cn } from "../../lib/styles";

type ServiceModalProps = {
  service: AwsService;
  geminiKey?: string;
  onClose: () => void;
};

type QuizHistoryItem = {
  score: number;
  total: number;
  category?: string;
  categoryBreakdown?: Record<string, { correct: number; total: number }>;
};

type QuizStats = {
  history?: QuizHistoryItem[];
};

const statsKey = "nebula-hub:quiz:stats";

function isFilled(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function getLocalMastery(service: AwsService) {
  const stats = readLocalValue<QuizStats>(statsKey, {});
  const history = stats.history ?? [];
  const serviceCategory = service.category ?? "";
  let correct = 0;
  let total = 0;

  for (const item of history) {
    const categoryScore = serviceCategory
      ? item.categoryBreakdown?.[serviceCategory]
      : undefined;

    if (categoryScore) {
      correct += categoryScore.correct;
      total += categoryScore.total;
    }
  }

  if (!total) {
    for (const item of history) {
      correct += item.score;
      total += item.total;
    }
  }

  if (!total) {
    return {
      value: Math.min(100, Math.max(0, service.mastery_level ?? 0)),
      source: "Database baseline",
    };
  }

  return {
    value: Math.round((correct / total) * 100),
    source: serviceCategory ? "Local exam category score" : "Local exam score",
  };
}

export function ServiceModal({ service, geminiKey, onClose }: ServiceModalProps) {
  const navigate = useNavigate();
  const [enrichment, setEnrichment] = useState<GeminiEnrichment | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLocalFallback, setIsLocalFallback] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [savedServiceIds, setSavedServiceIds] = useState(readSavedServiceIds);
  const [reviewQueue, setReviewQueue] = useState(readReviewQueue);
  const aiKey = geminiKey?.trim();
  const canGenerate = Boolean(aiKey);

  useEffect(() => {
    let isActive = true;
    const cached = readCachedEnrichment(service.id);

    setEnrichment(cached);
    setIsLocalFallback(false);
    setAiError(null);

    if (cached || !aiKey) {
      setIsGenerating(false);
      return () => {
        isActive = false;
      };
    }

    setIsGenerating(true);

    generateServiceEnrichment(service, aiKey)
      .then((result) => {
        if (isActive) {
          setEnrichment(result);
          setIsLocalFallback(false);
        }
      })
      .catch((caught) => {
        if (isActive) {
          setEnrichment(createFallbackServiceEnrichment(service));
          setIsLocalFallback(true);
          setAiError(fallbackMessage);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsGenerating(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [service, aiKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const snippets = normalizeCliSnippets(service.cli_snippets);
  const mastery = useMemo(() => getLocalMastery(service), [service]);
  const videos = getTutorialVideoLinks(service, enrichment);
  const useCase = isFilled(service.use_case)
    ? service.use_case
    : enrichment?.useCase;
  const detailedDocs = isFilled(service.detailed_docs)
    ? service.detailed_docs
    : enrichment?.detailedDocs;
  const isSaved = savedServiceIds.includes(service.id);
  const serviceReviewId = getReviewQueueItemId("service", service.id);
  const isQueued = reviewQueue.some((item) => item.id === serviceReviewId && item.status === "queued");
  const fallbackMessage =
    "Gemini did not finish. Showing a local study fallback; Refresh AI can retry.";

  const toggleSaved = () => {
    setSavedServiceIds(toggleSavedServiceId(service.id));
  };

  const queueServiceReview = () => {
    setReviewQueue(
      upsertReviewQueueItem({
        category: service.category,
        detail: service.summary ?? undefined,
        reason: `Review ${service.service_name} from the wiki detail modal before the next exam.`,
        sourceId: service.id,
        title: service.service_name,
        type: "service",
      }),
    );
  };

  const openArchitectureLab = () => {
    onClose();
    navigate(`/lab?service=${service.id}`);
  };

  const refreshBrief = async () => {
    if (!aiKey) {
      return;
    }

    setIsGenerating(true);
    setAiError(null);

    try {
      setEnrichment(await generateServiceEnrichment(service, aiKey));
      setIsLocalFallback(false);
    } catch (caught) {
      setEnrichment(createFallbackServiceEnrichment(service));
      setIsLocalFallback(true);
      setAiError(fallbackMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  return createPortal(
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/78 p-4 backdrop-blur-xl"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onMouseDown={onClose}
    >
      <motion.article
        animate={{ opacity: 1, y: 0, scale: 1 }}
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-white/12 bg-[#07101d]/95 shadow-[0_40px_120px_rgba(0,0,0,0.65)]"
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        transition={{ duration: 0.24 }}
      >
        <div className="service-visual relative min-h-44 border-b border-white/10 p-5 md:p-7">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/50 to-transparent" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <span className="rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                {service.category ?? "Uncategorized"}
              </span>
              <h2 className="mt-5 text-3xl font-semibold leading-tight text-white md:text-5xl">
                {service.service_name}
              </h2>
            </div>
            <Button
              aria-label="Close service detail"
              className="h-11 w-11 px-0"
              icon={<X className="h-5 w-5" />}
              onClick={onClose}
              variant="ghost"
            />
          </div>
        </div>

        <div className="max-h-[calc(92vh-11rem)] overflow-y-auto p-5 md:p-7">
          <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="space-y-5">
              <DetailBlock title="Summary">
                {service.summary ?? enrichment?.explanation ?? "AI is preparing this summary."}
              </DetailBlock>
              <UseCaseBlock
                canGenerate={canGenerate}
                isGenerating={isGenerating && !useCase}
                isGenerated={!isLocalFallback && !isFilled(service.use_case) && Boolean(useCase)}
                service={service}
                useCase={useCase ?? undefined}
              />
              <DetailBlock
                icon={<ShieldAlert className="h-4 w-4 text-amber-200" />}
                title="Gotcha"
              >
                {service.gotcha ?? "No gotcha recorded."}
              </DetailBlock>
              <DetailBlock
                badge={
                  !isFilled(service.detailed_docs) && detailedDocs
                    ? isLocalFallback
                      ? "Local fallback"
                      : "AI generated"
                    : undefined
                }
                title="Exam focus"
              >
                {detailedDocs ?? (isGenerating ? (
                  <AiPreparingState
                    label="AI is preparing exam angles, likely traps, and an example question for this service."
                    steps={["Scanning service role", "Mapping exam decision points", "Drafting example question"]}
                  />
                ) : (
                  <StaticStudyNotice
                    label={
                      canGenerate
                        ? "AI could not finish this section yet. Use Refresh AI to retry."
                        : "Add a Gemini key to generate exam-focused notes for this service."
                    }
                  />
                ))}
              </DetailBlock>
            </div>

            <aside className="space-y-5">
              <StudyActionsPanel
                isQueued={isQueued}
                isSaved={isSaved}
                onOpenLab={openArchitectureLab}
                onQueue={queueServiceReview}
                onToggleSaved={toggleSaved}
              />

              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Mastery level
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{mastery.source}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-semibold text-slate-300">
                    {mastery.value}/100
                  </span>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-200 via-teal-200 to-amber-200"
                    style={{ width: `${mastery.value}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <Code2 className="h-4 w-4 text-cyan-200" />
                  CLI snippets
                </div>
                <p className="mb-4 text-xs leading-5 text-slate-500">
                  AWS CLI terminal commands for practicing or operating this service.
                </p>
                <div className="space-y-3">
                  {snippets.length ? (
                    snippets.map((snippet, index) => (
                      <pre
                        className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs leading-6 text-cyan-50"
                        key={`${service.id}-${index}`}
                      >
                        <code>{snippet}</code>
                      </pre>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-slate-400">
                      No copy-ready AWS CLI commands have been recorded for this service yet.
                    </p>
                  )}
                </div>
              </div>

            </aside>
          </div>

          <TutorialVideosSection
            aiError={aiError}
            canGenerate={canGenerate}
            enrichment={enrichment}
            isGenerating={isGenerating}
            isLocalFallback={isLocalFallback}
            onRefresh={() => void refreshBrief()}
            service={service}
            videos={videos}
          />
        </div>
      </motion.article>
    </motion.div>,
    document.body,
  );
}

function TutorialVideosSection({
  aiError,
  canGenerate,
  enrichment,
  isGenerating,
  isLocalFallback,
  onRefresh,
  service,
  videos,
}: {
  aiError: string | null;
  canGenerate: boolean;
  enrichment: GeminiEnrichment | null;
  isGenerating: boolean;
  isLocalFallback: boolean;
  onRefresh: () => void;
  service: AwsService;
  videos: TutorialVideoLink[];
}) {
  return (
    <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.045] p-5 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
            <Bot className="h-4 w-4 text-teal-200" />
            Tutorial videos
            {enrichment ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-teal-200/25 bg-teal-200/10 px-2 py-1 text-xs text-teal-100">
                <Clock3 className="h-3 w-3" />
                {isLocalFallback ? "Local fallback" : "Cached"}
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            Visual walkthroughs for {service.service_name}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Larger preview cards open service-specific YouTube searches, so you can scan the topic before jumping out.
          </p>
        </div>

        {canGenerate ? (
          <Button
            className="shrink-0 justify-center"
            disabled={isGenerating}
            icon={isGenerating ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            onClick={onRefresh}
            variant="ghost"
          >
            Refresh AI brief
          </Button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3">
        {isGenerating ? (
          <AiPreparingState
            label="AI is preparing the brief and video cards."
            steps={["Building service context", "Choosing tutorial searches", "Caching the result"]}
          />
        ) : null}

        {!canGenerate && !enrichment ? (
          <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
            Gemini is not configured, so these are curated fallback searches.
          </p>
        ) : null}

        {aiError ? (
          <p className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm leading-6 text-rose-100">
            {aiError}
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {videos.map((video, index) => (
          <VideoCard
            index={index}
            key={`${video.searchQuery}-${index}`}
            service={service}
            video={video}
          />
        ))}
      </div>
    </section>
  );
}

function StudyActionsPanel({
  isQueued,
  isSaved,
  onOpenLab,
  onQueue,
  onToggleSaved,
}: {
  isQueued: boolean;
  isSaved: boolean;
  onOpenLab: () => void;
  onQueue: () => void;
  onToggleSaved: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Study actions
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <Button
          className="justify-start"
          icon={isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          onClick={onToggleSaved}
          variant={isSaved ? "primary" : "secondary"}
        >
          {isSaved ? "Saved service" : "Save service"}
        </Button>
        <Button
          className="justify-start"
          disabled={isQueued}
          icon={<ListPlus className="h-4 w-4" />}
          onClick={onQueue}
          variant={isQueued ? "ghost" : "secondary"}
        >
          {isQueued ? "In review queue" : "Add to review"}
        </Button>
        <Button
          className="justify-start sm:col-span-2 lg:col-span-1"
          icon={<FlaskConical className="h-4 w-4" />}
          onClick={onOpenLab}
          variant="secondary"
        >
          Open in Architecture Lab
        </Button>
      </div>
    </div>
  );
}

function DetailBlock({
  badge,
  children,
  icon,
  title,
}: {
  badge?: string;
  children: ReactNode;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {icon}
        {title}
        {badge ? (
          <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-2 py-1 text-[0.65rem] tracking-normal text-cyan-100">
            {badge}
          </span>
        ) : null}
      </div>
      {typeof children === "string" ? (
        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{children}</p>
      ) : (
        children
      )}
    </section>
  );
}

function UseCaseBlock({
  canGenerate,
  isGenerated,
  isGenerating,
  service,
  useCase,
}: {
  canGenerate: boolean;
  isGenerated: boolean;
  isGenerating: boolean;
  service: AwsService;
  useCase?: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Use case
        {isGenerated ? (
          <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-2 py-1 text-[0.65rem] tracking-normal text-cyan-100">
            AI generated
          </span>
        ) : null}
      </div>

      <ServiceBlueprint service={service} />

      <div className="mt-4">
        {useCase ? (
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{useCase}</p>
        ) : isGenerating ? (
          <AiPreparingState
            label="AI is preparing a practical use case for this service."
            steps={["Reading service summary", "Sketching the workload path", "Writing the blueprint narrative"]}
          />
        ) : (
          <StaticStudyNotice
            label={
              canGenerate
                ? "AI could not finish the use case yet. Use Refresh AI to retry."
                : "Add a Gemini key to generate a practical use case for this service."
            }
          />
        )}
      </div>
    </section>
  );
}

function StaticStudyNotice({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/24 p-4 text-sm font-semibold leading-6 text-slate-300">
      {label}
    </div>
  );
}

function ServiceBlueprint({ service }: { service: AwsService }) {
  const category = service.category ?? "AWS capability";
  const shortName = service.service_name.replace(/^Amazon\s+|^AWS\s+/i, "");
  const summary =
    service.summary ??
    `${service.service_name} supports ${category.toLowerCase()} workloads in AWS architectures.`;
  const workflow = [
    "Identify the workload requirement",
    `Choose ${shortName} for the right capability`,
    "Confirm public or private access",
    "Attach identity and permissions",
    "Configure network and routing",
    "Add monitoring and logging",
    "Review security controls",
    "Validate service limits and cost",
    "Test the failure path",
    "Save the exam gotcha",
  ];
  const gotcha =
    service.gotcha ??
    "Check IAM, networking, regional behavior, monitoring, quotas, and cost before choosing this answer.";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-sky-100/70 bg-[#07508d] p-3 text-sky-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25),0_24px_70px_rgba(7,80,141,0.25)]">
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:14px_14px]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:70px_70px]" />
      <motion.div
        animate={{ x: ["-20%", "125%"] }}
        className="absolute left-0 top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        transition={{ duration: 5.5, ease: "linear", repeat: Infinity }}
      />
      <div className="relative border border-white/80 p-3">
        <BlueprintCorner className="left-3 top-3" />
        <BlueprintCorner className="right-3 top-3" />
        <BlueprintCorner className="bottom-3 left-3" />
        <BlueprintCorner className="bottom-3 right-3" />

        <div className="border-b border-white/70 pb-3 text-center">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-sky-100/80">
            Service use-case blueprint
          </p>
          <h3 className="mt-2 text-2xl font-semibold uppercase leading-tight text-white md:text-3xl">
            How to use {shortName}
          </h3>
          <p className="mt-2 text-sm font-semibold text-sky-100">
            Beginner-friendly {category} architecture pattern
          </p>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[15rem_1fr]">
          <aside className="rounded-lg border border-white/80 bg-blue-950/10 p-3">
            <p className="border-b border-white/70 pb-2 text-xs font-semibold uppercase tracking-[0.16em]">
              10-step beginner workflow
            </p>
            <div className="mt-2 space-y-2">
              {workflow.map((step, index) => (
                <div className="grid grid-cols-[1.65rem_1fr] gap-2 border-b border-dashed border-white/55 pb-2 last:border-b-0 last:pb-0" key={step}>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/90 text-xs font-semibold">
                    {index + 1}
                  </span>
                  <span className="text-xs font-semibold leading-5 text-sky-50">{step}</span>
                </div>
              ))}
            </div>
          </aside>

          <div className="rounded-lg border border-white/80 p-3">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
              AWS service boundary
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_0.72fr_1fr] md:items-stretch">
              <BlueprintZone title="Public request path" subtitle="Client, event, API, or user action">
                <BlueprintIconLabel icon={<Cloud className="h-8 w-8" />} label="Request enters AWS" />
                <BlueprintRule title="Decision" rows={["Is this managed?", "Does it reduce ops work?", "Does it match the category?"]} />
              </BlueprintZone>

              <div className="flex flex-col justify-between gap-3">
                <BlueprintServiceCore category={category} shortName={shortName} />
                <BlueprintRouteCard />
              </div>

              <BlueprintZone title="Protected outcome" subtitle="Secure, monitored resource path">
                <BlueprintIconLabel icon={<Database className="h-8 w-8" />} label="Downstream workload" />
                <BlueprintRule title="Controls" rows={["IAM and policies", "Logs and metrics", "Limits and cost"]} />
              </BlueprintZone>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <BlueprintMiniPanel
                icon={<Network className="h-4 w-4" />}
                title="A. Traffic path"
                rows={["Source request", shortName, "Secure result"]}
              />
              <BlueprintMiniPanel
                icon={<ShieldCheck className="h-4 w-4" />}
                title="B. Security basics"
                rows={["Least privilege", "Private where possible", "Audit everything"]}
              />
              <BlueprintMiniPanel
                icon={<LockKeyhole className="h-4 w-4" />}
                title="C. Exam check"
                rows={["Managed fit", "Integration clue", "Gotcha verified"]}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_13rem]">
          <div className="rounded-lg border border-white/80 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
              <Cpu className="h-4 w-4" />
              Key beginner notes
            </div>
            <p className="line-clamp-2 text-xs leading-5 text-sky-50">{summary}</p>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-sky-100/90">{gotcha}</p>
          </div>
          <div className="rounded-lg border border-white/80 p-3 text-xs leading-5">
            <div className="grid grid-cols-[3.25rem_1fr] border-b border-white/60 pb-1">
              <span>Drawn</span>
              <span>Nebula-Hub</span>
            </div>
            <div className="grid grid-cols-[3.25rem_1fr] border-b border-white/60 py-1">
              <span>Scale</span>
              <span>NTS</span>
            </div>
            <div className="grid grid-cols-[3.25rem_1fr] pt-1">
              <span>Rev</span>
              <span>Study OS</span>
            </div>
          </div>
        </div>
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

function BlueprintZone({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-white/85 p-3 text-center">
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-sky-100/90">{subtitle}</p>
      <div className="mt-4 grid gap-3">{children}</div>
    </div>
  );
}

function BlueprintServiceCore({ category, shortName }: { category: string; shortName: string }) {
  return (
    <div className="rounded-lg border border-white/90 bg-white/10 p-3 text-center shadow-[0_0_24px_rgba(255,255,255,0.12)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-100">Managed service</p>
      <p className="mt-2 text-lg font-semibold leading-6 text-white">{shortName}</p>
      <p className="mt-2 text-xs leading-5 text-sky-100">{category}</p>
    </div>
  );
}

function BlueprintRouteCard() {
  return (
    <div className="rounded-lg border border-white/85 p-3 text-center">
      <p className="text-sm font-semibold text-white">Decision route</p>
      <div className="mt-2 grid grid-cols-2 overflow-hidden rounded border border-white/70 text-xs">
        <span className="border-b border-r border-white/60 px-2 py-1">Signal</span>
        <span className="border-b border-white/60 px-2 py-1">Action</span>
        <span className="border-r border-white/60 px-2 py-1">Requirement</span>
        <span className="px-2 py-1">Choose fit</span>
      </div>
    </div>
  );
}

function BlueprintIconLabel({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="mx-auto flex max-w-44 flex-col items-center rounded-lg border border-white/75 p-3">
      {icon}
      <p className="mt-2 text-sm font-semibold leading-5 text-white">{label}</p>
    </div>
  );
}

function BlueprintRule({ rows, title }: { rows: string[]; title: string }) {
  return (
    <div className="rounded-lg border border-white/75 p-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-100">{title}</p>
      <div className="mt-2 space-y-1">
        {rows.map((row) => (
          <p className="text-xs leading-5 text-sky-50" key={row}>
            - {row}
          </p>
        ))}
      </div>
    </div>
  );
}

function BlueprintMiniPanel({
  icon,
  rows,
  title,
}: {
  icon: ReactNode;
  rows: string[];
  title: string;
}) {
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

function AiPreparingState({
  className,
  label,
  steps,
}: {
  className?: string;
  label: string;
  steps: string[];
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-cyan-200/20 bg-cyan-200/10 p-4", className)}>
      <div className="flex items-start gap-3">
        <div className="relative mt-1 h-8 w-8 shrink-0 rounded-full border border-cyan-200/30 bg-cyan-200/10">
          <motion.span
            animate={{ rotate: 360 }}
            className="absolute inset-1 rounded-full border border-transparent border-t-cyan-100"
            transition={{ duration: 1.1, ease: "linear", repeat: Infinity }}
          />
          <Sparkles className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-cyan-100" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-6 text-cyan-50">{label}</p>
          <div className="mt-3 grid gap-2">
            {steps.map((step, index) => (
              <div className="flex items-center gap-3" key={step}>
                <motion.span
                  animate={{ opacity: [0.35, 1, 0.35], scale: [0.85, 1, 0.85] }}
                  className="h-2 w-2 rounded-full bg-cyan-200"
                  transition={{ delay: index * 0.18, duration: 1.4, repeat: Infinity }}
                />
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {step}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              animate={{ x: ["-40%", "120%"] }}
              className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-cyan-100 to-transparent"
              transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function VideoCard({
  index,
  service,
  video,
}: {
  index: number;
  service: AwsService;
  video: TutorialVideoLink;
}) {
  return (
    <a
      className="group overflow-hidden rounded-2xl border border-white/10 bg-black/24 transition hover:-translate-y-1 hover:border-cyan-200/35 hover:bg-cyan-200/10 hover:shadow-[0_24px_70px_rgba(34,211,238,0.12)]"
      href={getYouTubeSearchUrl(video.searchQuery)}
      rel="noreferrer"
      target="_blank"
    >
      <div className="service-visual relative aspect-video border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-slate-950/25 to-black/55" />
        <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[0.7rem] font-semibold text-white shadow-[0_12px_35px_rgba(0,0,0,0.35)]">
          {String(index + 1).padStart(2, "0")}
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
          <span className="rounded-full border border-cyan-200/25 bg-cyan-200/12 px-3 py-1 text-xs font-semibold text-cyan-50">
            YouTube search
          </span>
          <PlayCircle className="h-11 w-11 text-white drop-shadow-[0_0_24px_rgba(34,211,238,0.85)] transition group-hover:scale-110" />
        </div>
      </div>
      <div className="min-w-0 p-4">
        <p className="line-clamp-2 text-base font-semibold leading-6 text-white">
          {video.title}
        </p>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">
          {video.focus}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs font-semibold text-cyan-100">
          <span className="truncate">{service.service_name}</span>
          <span className="inline-flex shrink-0 items-center gap-1">
            Open
            <ExternalLink className="h-4 w-4" />
          </span>
        </div>
      </div>
    </a>
  );
}
