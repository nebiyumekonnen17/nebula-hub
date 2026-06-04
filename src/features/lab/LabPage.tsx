import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Cpu,
  FlaskConical,
  Layers3,
  ListPlus,
  Network,
  RefreshCcw,
  Route,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingSkeleton } from "../../components/feedback/LoadingSkeleton";
import { SetupState } from "../../components/feedback/SetupState";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import {
  architectureScenarios,
  createScenarioBlueprint,
  createServiceBlueprint,
  generateBlueprintSpec,
  GeminiQuotaCooldownError,
  blueprintAiCooldownKey,
  getMissionById,
  getScenarioById,
  readBlueprintCache,
  readMissionHistory,
  scenarioMissions,
  scoreMission,
  writeMissionHistory,
  type ArchitectureScenario,
  type BlueprintSpec,
  type MissionResult,
  type ScenarioMission,
} from "../../lib/lab/architectureLab";
import { readLocalValue, writeLocalValue } from "../../lib/storage/local";
import { fetchServices } from "../../lib/supabase/queries";
import { useSupabase } from "../../lib/supabase/SupabaseProvider";
import type { AwsService } from "../../lib/supabase/types";
import { upsertReviewQueueItems } from "../../lib/study/studyState";
import { cn } from "../../lib/styles";
import { BlueprintPoster } from "./BlueprintPoster";

const labImage =
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1500&q=80";

type LabTab = "blueprints" | "missions";

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

function findService(services: AwsService[], id: string | null) {
  if (!id) {
    return null;
  }

  const numericId = Number(id);
  return services.find((service) => service.id === numericId) ?? null;
}

export function LabPage() {
  const { client, envStatus } = useSupabase();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [services, setServices] = useState<AwsService[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(client));
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [blueprintSpec, setBlueprintSpec] = useState<BlueprintSpec | null>(null);
  const [isGeneratingBlueprint, setIsGeneratingBlueprint] = useState(false);
  const [blueprintError, setBlueprintError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(() =>
    readLocalValue<number>(blueprintAiCooldownKey, 0),
  );
  const [now, setNow] = useState(Date.now());
  const [missionHistory, setMissionHistory] = useState(readMissionHistory);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [missionResult, setMissionResult] = useState<MissionResult | null>(null);
  const requestedTab = searchParams.get("mission") ? "missions" : "blueprints";
  const [tab, setTab] = useState<LabTab>(requestedTab);
  const serviceParam = searchParams.get("service");
  const scenarioParam = searchParams.get("scenario");
  const missionParam = searchParams.get("mission");
  const selectedService = findService(services, serviceParam);
  const selectedScenario = getScenarioById(scenarioParam);
  const selectedMission = getMissionById(missionParam);
  const aiKey = envStatus.env.geminiApiKey?.trim();
  const cooldownRemaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const isAiCoolingDown = cooldownRemaining > 0;

  useEffect(() => {
    setTab(searchParams.get("mission") ? "missions" : "blueprints");
  }, [searchParams]);

  useEffect(() => {
    if (!isAiCoolingDown) {
      return;
    }

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [isAiCoolingDown]);

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
          setError(caught instanceof Error ? caught.message : "Architecture Lab could not load services.");
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

  const fallbackBlueprint = useMemo(() => {
    if (serviceParam && selectedService) {
      return createServiceBlueprint(selectedService);
    }

    if (missionParam) {
      return createScenarioBlueprint(getScenarioById(selectedMission.scenarioId));
    }

    return createScenarioBlueprint(selectedScenario);
  }, [missionParam, selectedMission.scenarioId, selectedScenario, selectedService, serviceParam]);

  useEffect(() => {
    const cache = readBlueprintCache();
    setBlueprintSpec(cache[fallbackBlueprint.id] ?? fallbackBlueprint);
    setBlueprintError(null);
  }, [fallbackBlueprint]);

  useEffect(() => {
    setSelectedServices([]);
    setAnswers({});
    setMissionResult(null);
  }, [selectedMission.id]);

  const filteredServices = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return services.slice(0, 24);
    }

    return services
      .filter((service) =>
        [service.service_name, service.category, service.summary]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalized)),
      )
      .slice(0, 24);
  }, [query, services]);

  const selectScenario = (scenario: ArchitectureScenario) => {
    const next = new URLSearchParams(searchParams);
    next.delete("service");
    next.delete("mission");
    next.set("scenario", scenario.id);
    setSearchParams(next);
    setTab("blueprints");
  };

  const selectService = (service: AwsService) => {
    const next = new URLSearchParams(searchParams);
    next.delete("scenario");
    next.delete("mission");
    next.set("service", String(service.id));
    setSearchParams(next);
    setTab("blueprints");
  };

  const selectMission = (mission: ScenarioMission) => {
    const next = new URLSearchParams(searchParams);
    next.delete("service");
    next.set("mission", mission.id);
    next.set("scenario", mission.scenarioId);
    setSearchParams(next);
    setTab("missions");
  };

  const refreshBlueprint = async () => {
    if (!aiKey) {
      setBlueprintError("Add a Gemini key to generate an AI blueprint plan. The local blueprint is ready now.");
      return;
    }

    if (isAiCoolingDown) {
      setBlueprintError(`Free AI is cooling down. Try again in ${cooldownRemaining}s; the local blueprint is ready now.`);
      return;
    }

    setIsGeneratingBlueprint(true);
    setBlueprintError(null);

    try {
      setBlueprintSpec(await generateBlueprintSpec(fallbackBlueprint, aiKey));
      setCooldownUntil(0);
      writeLocalValue(blueprintAiCooldownKey, 0);
    } catch (caught) {
      setBlueprintSpec(fallbackBlueprint);

      if (caught instanceof GeminiQuotaCooldownError) {
        const nextCooldown = Date.now() + caught.retrySeconds * 1000;
        setCooldownUntil(nextCooldown);
        setNow(Date.now());
        writeLocalValue(blueprintAiCooldownKey, nextCooldown);
        setBlueprintError(
          `Free AI hit its temporary request limit. Try again in ${caught.retrySeconds}s; the local blueprint is still ready.`,
        );
      } else {
        setBlueprintError(caught instanceof Error ? caught.message : "Blueprint AI could not finish.");
      }
    } finally {
      setIsGeneratingBlueprint(false);
    }
  };

  const toggleMissionService = (service: string) => {
    setSelectedServices((current) =>
      current.includes(service)
        ? current.filter((item) => item !== service)
        : [...current, service],
    );
  };

  const submitMission = () => {
    const result = scoreMission(selectedMission, selectedServices, answers);
    const nextHistory = [result, ...missionHistory.filter((item) => item.missionId !== result.missionId)];
    writeMissionHistory(nextHistory);
    setMissionHistory(nextHistory);
    setMissionResult(result);
  };

  const addMissedToReview = () => {
    if (!missionResult) {
      return;
    }

    const missionIndex = scenarioMissions.findIndex((mission) => mission.id === missionResult.missionId);
    const missedServiceItems = missionResult.missedServices.map((service, index) => ({
      category: selectedMission.category,
      detail: selectedMission.prompt,
      id: `mission:${selectedMission.id}:service:${service}`,
      reason: `Missed recommended service in ${selectedMission.title}: ${service}.`,
      sourceId: 910000 + Math.max(missionIndex, 0) * 100 + index,
      title: service,
      type: "quiz-question" as const,
    }));
    const missedQuestionItems = missionResult.missedQuestions.map((question, index) => ({
      category: selectedMission.category,
      detail: question.explanation,
      id: `mission:${selectedMission.id}:question:${question.id}`,
      reason: `Mission review: ${question.correctAnswer}. ${question.explanation}`,
      sourceId: 920000 + Math.max(missionIndex, 0) * 100 + index,
      title: question.prompt,
      type: "quiz-question" as const,
    }));

    upsertReviewQueueItems([...missedServiceItems, ...missedQuestionItems]);
  };

  if (!envStatus.isSupabaseReady) {
    return <SetupState missingKeys={envStatus.missingSupabaseKeys} />;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton className="h-80" />
        <LoadingSkeleton className="h-[36rem]" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        action={<Button onClick={() => window.location.reload()} variant="primary">Reload Lab</Button>}
        message={error}
        title="Architecture Lab needs attention"
      />
    );
  }

  return (
    <div className="space-y-6">
      <GlassPanel className="relative overflow-hidden p-5 md:p-7" glow="cyan">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 opacity-35 lg:block">
          <img alt="" className="h-full w-full object-cover" src={labImage} />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/78 to-slate-950/20" />
        </div>
        <div className="relative grid gap-6 xl:grid-cols-[0.95fr_1.05fr] xl:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-100">
              <FlaskConical className="h-4 w-4" />
              Architecture Lab
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl">
              Design AWS systems like an exam architect.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Blueprint services, solve real cloud scenarios, reveal the ideal design, and send weak decisions into Study OS.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button icon={<Network className="h-4 w-4" />} onClick={() => setTab("blueprints")} variant={tab === "blueprints" ? "primary" : "secondary"}>
                Blueprints
              </Button>
              <Button icon={<BrainCircuit className="h-4 w-4" />} onClick={() => setTab("missions")} variant={tab === "missions" ? "primary" : "secondary"}>
                Missions
              </Button>
              <Button icon={<BookOpen className="h-4 w-4" />} onClick={() => navigate("/wiki")}>
                Open wiki
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric label="Blueprints" value={architectureScenarios.length + services.length} />
            <LabMetric label="Missions" value={scenarioMissions.length} />
            <LabMetric label="Best mission" value={`${Math.max(0, ...missionHistory.map((item) => item.score))}%`} />
          </div>
        </div>
      </GlassPanel>

      {tab === "blueprints" ? (
        <BlueprintsView
          blueprintError={blueprintError}
          cooldownRemaining={cooldownRemaining}
          filteredServices={filteredServices}
          isGeneratingBlueprint={isGeneratingBlueprint}
          onRefreshBlueprint={() => void refreshBlueprint()}
          onSelectScenario={selectScenario}
          onSelectService={selectService}
          query={query}
          scenario={selectedScenario}
          selectedService={selectedService}
          setQuery={setQuery}
          spec={blueprintSpec ?? fallbackBlueprint}
        />
      ) : (
        <MissionsView
          answers={answers}
          mission={selectedMission}
          missionHistory={missionHistory}
          missionResult={missionResult}
          onAddMissed={addMissedToReview}
          onAnswer={(questionId, answerIndex) =>
            setAnswers((current) => ({ ...current, [questionId]: answerIndex }))
          }
          onSelectMission={selectMission}
          onSubmit={submitMission}
          onToggleService={toggleMissionService}
          selectedServices={selectedServices}
          spec={blueprintSpec ?? fallbackBlueprint}
        />
      )}
    </div>
  );
}

function LabMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function BlueprintsView({
  blueprintError,
  cooldownRemaining,
  filteredServices,
  isGeneratingBlueprint,
  onRefreshBlueprint,
  onSelectScenario,
  onSelectService,
  query,
  scenario,
  selectedService,
  setQuery,
  spec,
}: {
  blueprintError: string | null;
  cooldownRemaining: number;
  filteredServices: AwsService[];
  isGeneratingBlueprint: boolean;
  onRefreshBlueprint: () => void;
  onSelectScenario: (scenario: ArchitectureScenario) => void;
  onSelectService: (service: AwsService) => void;
  query: string;
  scenario: ArchitectureScenario;
  selectedService: AwsService | null;
  setQuery: (value: string) => void;
  spec: BlueprintSpec;
}) {
  const isCoolingDown = cooldownRemaining > 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
      <aside className="space-y-5">
        <GlassPanel className="p-5" glow="teal">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Scenario templates
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Design patterns</h2>
            </div>
            <Layers3 className="h-5 w-5 text-teal-200" />
          </div>
          <div className="mt-5 grid gap-3">
            {architectureScenarios.map((item) => (
              <button
                className={cn(
                  "rounded-2xl border p-4 text-left transition hover:border-cyan-200/30 hover:bg-cyan-200/10",
                  scenario.id === item.id && !selectedService
                    ? "border-cyan-200/40 bg-cyan-200/12"
                    : "border-white/10 bg-white/[0.045]",
                )}
                key={item.id}
                onClick={() => onSelectScenario(item)}
                type="button"
              >
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{item.focus}</p>
              </button>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-100/80" />
            <input
              className="min-h-12 w-full rounded-xl border border-cyan-100/20 bg-slate-950/80 pl-12 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/55"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find service blueprint..."
              value={query}
            />
          </label>
          <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
            {filteredServices.map((service) => (
              <button
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition hover:border-cyan-200/30 hover:bg-cyan-200/10",
                  selectedService?.id === service.id
                    ? "border-cyan-200/40 bg-cyan-200/12"
                    : "border-white/10 bg-white/[0.045]",
                )}
                key={service.id}
                onClick={() => onSelectService(service)}
                type="button"
              >
                <p className="truncate text-sm font-semibold text-white">{service.service_name}</p>
                <p className="mt-1 text-xs text-slate-500">{service.category ?? "Uncategorized"}</p>
              </button>
            ))}
          </div>
        </GlassPanel>
      </aside>

      <section className="space-y-5">
        <GlassPanel className="p-5" glow="cyan">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Active blueprint
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{spec.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{spec.subtitle}</p>
            </div>
            <Button
              disabled={isGeneratingBlueprint || isCoolingDown}
              icon={isGeneratingBlueprint ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              onClick={onRefreshBlueprint}
              variant="primary"
            >
              {isCoolingDown
                ? `Retry in ${cooldownRemaining}s`
                : spec.source === "gemini"
                  ? "Refresh AI plan"
                  : "Generate AI plan"}
            </Button>
          </div>
          {blueprintError ? (
            <p className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-4 text-sm leading-6 text-amber-100">
              {blueprintError}
            </p>
          ) : null}
        </GlassPanel>

        <BlueprintPoster spec={spec} />
      </section>
    </div>
  );
}

function MissionsView({
  answers,
  mission,
  missionHistory,
  missionResult,
  onAddMissed,
  onAnswer,
  onSelectMission,
  onSubmit,
  onToggleService,
  selectedServices,
  spec,
}: {
  answers: Record<string, number>;
  mission: ScenarioMission;
  missionHistory: MissionResult[];
  missionResult: MissionResult | null;
  onAddMissed: () => void;
  onAnswer: (questionId: string, answerIndex: number) => void;
  onSelectMission: (mission: ScenarioMission) => void;
  onSubmit: () => void;
  onToggleService: (service: string) => void;
  selectedServices: string[];
  spec: BlueprintSpec;
}) {
  const allAnswered = mission.questions.every((question) => typeof answers[question.id] === "number");
  const canSubmit = selectedServices.length > 0 && allAnswered;

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
      <aside className="space-y-5">
        <GlassPanel className="p-5" glow="teal">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Mission bank
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Scenarios</h2>
            </div>
            <ClipboardList className="h-5 w-5 text-teal-200" />
          </div>
          <div className="mt-5 grid gap-3">
            {scenarioMissions.map((item) => (
              <button
                className={cn(
                  "rounded-2xl border p-4 text-left transition hover:border-cyan-200/30 hover:bg-cyan-200/10",
                  mission.id === item.id ? "border-cyan-200/40 bg-cyan-200/12" : "border-white/10 bg-white/[0.045]",
                )}
                key={item.id}
                onClick={() => onSelectMission(item)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[0.65rem] text-slate-300">
                    {item.estimatedMinutes}m
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{item.readinessFocus}</p>
              </button>
            ))}
          </div>
        </GlassPanel>

        <MissionHistory history={missionHistory} />
      </aside>

      <section className="space-y-5">
        <GlassPanel className="p-5" glow="cyan">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Active mission
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-white">{mission.title}</h2>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">{mission.prompt}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                {mission.difficulty}
              </span>
              <span className="rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-2 text-xs font-semibold text-amber-100">
                {mission.category}
              </span>
            </div>
          </div>
        </GlassPanel>

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <GlassPanel className="p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <Cpu className="h-4 w-4 text-cyan-200" />
              Choose services
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {mission.serviceOptions.map((service) => {
                const selected = selectedServices.includes(service);

                return (
                  <button
                    className={cn(
                      "min-h-14 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
                      selected
                        ? "border-cyan-200/45 bg-cyan-200/14 text-cyan-50"
                        : "border-white/10 bg-white/[0.045] text-slate-300 hover:border-white/20 hover:bg-white/[0.075]",
                    )}
                    key={service}
                    onClick={() => onToggleService(service)}
                    type="button"
                  >
                    {service}
                  </button>
                );
              })}
            </div>
          </GlassPanel>

          <GlassPanel className="p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <Target className="h-4 w-4 text-teal-200" />
              Decision questions
            </div>
            <div className="mt-4 space-y-4">
              {mission.questions.map((question, questionIndex) => (
                <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4" key={question.id}>
                  <p className="text-sm font-semibold leading-6 text-white">
                    {questionIndex + 1}. {question.prompt}
                  </p>
                  <div className="mt-3 grid gap-2">
                    {question.options.map((option, optionIndex) => {
                      const selected = answers[question.id] === optionIndex;

                      return (
                        <button
                          className={cn(
                            "rounded-xl border px-3 py-2 text-left text-sm transition",
                            selected
                              ? "border-teal-200/45 bg-teal-200/14 text-teal-50"
                              : "border-white/10 bg-black/20 text-slate-300 hover:border-white/20",
                          )}
                          key={option}
                          onClick={() => onAnswer(question.id, optionIndex)}
                          type="button"
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button disabled={!canSubmit} icon={<CheckCircle2 className="h-4 w-4" />} onClick={onSubmit} variant="primary">
                Submit mission
              </Button>
              <span className="self-center text-sm text-slate-500">
                {selectedServices.length} services / {Object.keys(answers).length} answers
              </span>
            </div>
          </GlassPanel>
        </div>

        {missionResult ? (
          <MissionResultPanel mission={mission} onAddMissed={onAddMissed} result={missionResult} spec={spec} />
        ) : null}
      </section>
    </div>
  );
}

function MissionHistory({ history }: { history: MissionResult[] }) {
  return (
    <GlassPanel className="p-5" glow="amber">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Local history
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Mission trend</h2>
        </div>
        <Route className="h-5 w-5 text-amber-200" />
      </div>
      <div className="mt-5 space-y-3">
        {history.length ? (
          history.slice(0, 5).map((item) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4" key={`${item.missionId}-${item.completedAt}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="line-clamp-1 text-sm font-semibold text-white">{item.missionTitle}</p>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-semibold text-cyan-100">
                  {item.score}%
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{formatDate(item.completedAt)}</p>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-white/12 bg-black/20 p-4 text-sm leading-6 text-slate-400">
            Completed missions will appear here on this device.
          </p>
        )}
      </div>
    </GlassPanel>
  );
}

function MissionResultPanel({
  mission,
  onAddMissed,
  result,
  spec,
}: {
  mission: ScenarioMission;
  onAddMissed: () => void;
  result: MissionResult;
  spec: BlueprintSpec;
}) {
  return (
    <GlassPanel className="space-y-5 p-5" glow="teal">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Mission result
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{result.score}% score</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Ideal architecture revealed for {mission.title}. Review missed decisions before the next exam pass.
          </p>
        </div>
        <Button
          disabled={!result.missedQuestions.length && !result.missedServices.length}
          icon={<ListPlus className="h-4 w-4" />}
          onClick={onAddMissed}
          variant="primary"
        >
          Add missed to review
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {Object.entries(result.dimensions).map(([dimension, value]) => (
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4" key={dimension}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{dimension}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{value}%</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          <ResultList title="Correct services" values={result.correctServices} />
          <ResultList title="Missed services" values={result.missedServices} />
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Missed questions</p>
            <div className="mt-3 space-y-3">
              {result.missedQuestions.length ? (
                result.missedQuestions.map((item) => (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3" key={item.id}>
                    <p className="text-sm font-semibold leading-6 text-white">{item.prompt}</p>
                    <p className="mt-2 text-sm leading-6 text-cyan-100">{item.correctAnswer}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{item.explanation}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-400">No missed decision questions.</p>
              )}
            </div>
          </div>
        </div>

        <BlueprintPoster spec={spec} />
      </div>
    </GlassPanel>
  );
}

function ResultList({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.length ? (
          values.map((value) => (
            <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-100" key={value}>
              {value}
            </span>
          ))
        ) : (
          <span className="text-sm text-slate-400">None</span>
        )}
      </div>
    </div>
  );
}
