import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileQuestion,
  History,
  ListPlus,
  ListChecks,
  Play,
  RotateCcw,
  ShieldCheck,
  Target,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingSkeleton } from "../../components/feedback/LoadingSkeleton";
import { SetupState } from "../../components/feedback/SetupState";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { fetchQuizQuestions, normalizeOptions } from "../../lib/supabase/queries";
import { useSupabase } from "../../lib/supabase/SupabaseProvider";
import type { AwsQuizQuestion } from "../../lib/supabase/types";
import {
  readQuizStats,
  upsertReviewQueueItems,
  writeQuizStats,
  type CategoryInsight,
  type QuizHistoryItem,
  type QuizStats,
} from "../../lib/study/studyState";
import { cn } from "../../lib/styles";
import { removeLocalValue, writeLocalValue } from "../../lib/storage/local";

type ExamQuestion = {
  id: number;
  question: string;
  category: string | null;
  explanation: string | null;
  options: string[];
  correctAnswerIndex: number;
};

type IncorrectQuestion = {
  index: number;
  question: ExamQuestion;
  selectedIndex?: number;
};

const examSize = 65;
const examSeconds = 90 * 60;
const examActiveKey = "nebula-hub:exam:active";
const answerLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const leaveMessage =
  "Your active AWS exam timer and randomized question set will reset if you leave. Are you sure?";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function buildExamQuestions(questions: AwsQuizQuestion[]): ExamQuestion[] {
  return shuffle(questions)
    .map((question) => {
      const options = normalizeOptions(question.options);
      const shuffledOptions = shuffle(
        options.map((option, index) => ({
          option,
          isCorrect: index === question.correct_answer_index,
        })),
      );

      return {
        id: question.id,
        question: question.question,
        category: question.category,
        explanation: question.explanation,
        options: shuffledOptions.map((option) => option.option),
        correctAnswerIndex: shuffledOptions.findIndex((option) => option.isCorrect),
      };
    })
    .filter((question) => question.options.length >= 2 && question.correctAnswerIndex >= 0)
    .slice(0, examSize);
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatHistoryDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

function getCategoryBreakdown(
  examQuestions: ExamQuestion[],
  answers: Record<number, number>,
) {
  return examQuestions.reduce<Record<string, { correct: number; total: number }>>(
    (breakdown, question, index) => {
      const category = question.category ?? "Uncategorized";
      const existing = breakdown[category] ?? { correct: 0, total: 0 };
      const isCorrect = answers[index] === question.correctAnswerIndex;

      breakdown[category] = {
        correct: existing.correct + (isCorrect ? 1 : 0),
        total: existing.total + 1,
      };

      return breakdown;
    },
    {},
  );
}

function getCategoryInsights(
  breakdown: Record<string, { correct: number; total: number }>,
): CategoryInsight[] {
  return Object.entries(breakdown)
    .map(([category, score]) => ({
      category,
      correct: score.correct,
      total: score.total,
      accuracy: score.total ? Math.round((score.correct / score.total) * 100) : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total || a.category.localeCompare(b.category));
}

export function QuizPage() {
  const { envStatus, client } = useSupabase();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<AwsQuizQuestion[]>([]);
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(examSeconds);
  const [isLoading, setIsLoading] = useState(Boolean(client));
  const [error, setError] = useState<string | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<QuizStats>(readQuizStats);

  const isExamInProgress = isStarted && !isSubmitted;

  useEffect(() => {
    if (!isExamInProgress) {
      return undefined;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = leaveMessage;
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isExamInProgress]);

  useEffect(() => {
    if (!client) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchQuizQuestions(client)
      .then((rows) => {
        if (isMounted) {
          setQuestions(rows);
        }
      })
      .catch((caught) => {
        if (isMounted) {
          setError(caught instanceof Error ? caught.message : "Quiz questions could not load.");
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

  const startNewExam = useCallback((sourceQuestions: AwsQuizQuestion[]) => {
    const nextQuestions = buildExamQuestions(sourceQuestions);
    setExamQuestions(nextQuestions);
    setAnswers({});
    setCurrentIndex(0);
    setTimeRemaining(examSeconds);
    setIsSubmitted(false);
    setFinalScore(null);
    setReviewMessage(null);
    setIsStarted(Boolean(nextQuestions.length));
  }, []);

  useEffect(() => {
    if (isExamInProgress) {
      writeLocalValue(examActiveKey, true);
      return () => removeLocalValue(examActiveKey);
    }

    removeLocalValue(examActiveKey);
    return undefined;
  }, [isExamInProgress]);

  const submitExam = useCallback(
    (reason: "manual" | "timeout" = "manual") => {
      if (isSubmitted || !examQuestions.length) {
        return;
      }

      const score = examQuestions.reduce(
        (total, question, index) =>
          total + (answers[index] === question.correctAnswerIndex ? 1 : 0),
        0,
      );
      const categoryBreakdown = getCategoryBreakdown(examQuestions, answers);
      const percentage = Math.round((score / examQuestions.length) * 100);
      const nextStats: QuizStats = {
        bestScore: Math.max(stats.bestScore, percentage),
        totalSessions: stats.totalSessions + 1,
        bestStreak: Math.max(stats.bestStreak, percentage),
        recentCategories: ["Full AWS Exam", ...stats.recentCategories.filter((item) => item !== "Full AWS Exam")].slice(0, 5),
        history: [
          {
            date: new Date().toISOString(),
            category: reason === "timeout" ? "Timed AWS Exam" : "Full AWS Exam",
            score,
            total: examQuestions.length,
            categoryBreakdown,
          },
          ...stats.history,
        ].slice(0, 12),
      };

      setFinalScore(score);
      setStats(nextStats);
      writeQuizStats(nextStats);
      setIsSubmitted(true);
      setIsStarted(false);
      removeLocalValue(examActiveKey);
    },
    [answers, examQuestions, isSubmitted, stats],
  );

  useEffect(() => {
    if (!isExamInProgress) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setTimeRemaining((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer);
          window.setTimeout(() => submitExam("timeout"), 0);
          return 0;
        }

        return seconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isExamInProgress, submitExam]);

  const answeredCount = Object.keys(answers).length;
  const currentQuestion = examQuestions[currentIndex];
  const progress = examQuestions.length
    ? Math.round((answeredCount / examQuestions.length) * 100)
    : 0;
  const scorePercent =
    finalScore === null || !examQuestions.length
      ? 0
      : Math.round((finalScore / examQuestions.length) * 100);
  const isPassing = scorePercent >= 72;
  const resultCategoryInsights = useMemo(
    () => (isSubmitted ? getCategoryInsights(getCategoryBreakdown(examQuestions, answers)) : []),
    [answers, examQuestions, isSubmitted],
  );
  const incorrectQuestions = useMemo<IncorrectQuestion[]>(
    () =>
      isSubmitted
        ? examQuestions
            .map((question, index) => ({
              index,
              question,
              selectedIndex: answers[index],
            }))
            .filter((item) => item.selectedIndex !== item.question.correctAnswerIndex)
        : [],
    [answers, examQuestions, isSubmitted],
  );

  const chooseAnswer = (answerIndex: number) => {
    if (isSubmitted) {
      return;
    }

    setAnswers((current) => ({
      ...current,
      [currentIndex]: answerIndex,
    }));
  };

  const confirmSubmit = () => {
    if (window.confirm("Submit your AWS exam now? Unanswered questions will be marked incorrect.")) {
      submitExam("manual");
    }
  };

  const addMissedToReviewQueue = () => {
    if (!incorrectQuestions.length) {
      setReviewMessage("No missed questions to add. Clean pass.");
      return;
    }

    upsertReviewQueueItems(
      incorrectQuestions.map(({ index, question, selectedIndex }) => {
        const correctAnswer = question.options[question.correctAnswerIndex] ?? "Correct answer unavailable";
        const selectedAnswer =
          selectedIndex === undefined
            ? "Unanswered"
            : question.options[selectedIndex] ?? "Selected answer unavailable";

        return {
          category: question.category,
          detail: question.explanation ?? correctAnswer,
          reason: `Missed on exam question ${index + 1}. Selected: ${selectedAnswer}. Correct: ${correctAnswer}.`,
          sourceId: question.id,
          title: question.question,
          type: "quiz-question" as const,
        };
      }),
    );
    setReviewMessage(`${incorrectQuestions.length} missed questions added to Study OS review queue.`);
  };

  const practiceWeakAreas = () => {
    const targetCategory =
      resultCategoryInsights.find((item) => item.accuracy < 72)?.category ??
      resultCategoryInsights[0]?.category;

    navigate(targetCategory ? `/wiki?category=${encodeURIComponent(targetCategory)}` : "/study");
  };

  if (!envStatus.isSupabaseReady) {
    return <SetupState missingKeys={envStatus.missingSupabaseKeys} />;
  }

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <LoadingSkeleton className="h-96" />
        <LoadingSkeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        action={<Button onClick={() => window.location.reload()} variant="primary">Reload exam</Button>}
        message={error}
        title="Exam bank unavailable"
      />
    );
  }

  if (!examQuestions.length) {
    if (questions.length) {
      return (
        <ExamLobby
          availableQuestions={questions.length}
          bestScore={stats.bestScore}
          history={stats.history}
          totalSessions={stats.totalSessions}
          onStart={() => startNewExam(questions)}
        />
      );
    }

    return (
      <EmptyState
        message="The exam simulator needs at least two-option quiz prompts from Supabase."
        title="No exam questions available"
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
      <aside className="space-y-6">
        <GlassPanel className="p-5" glow={timeRemaining < 600 && isExamInProgress ? "amber" : "teal"}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                AWS exam mode
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Practice exam</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                65 randomized questions. 90 minutes. No answer feedback until submit.
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-200/10 text-cyan-100">
              <FileQuestion className="h-7 w-7" />
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <Clock3 className="h-4 w-4" />
              Time remaining
            </div>
            <p className={cn("mt-3 text-5xl font-semibold", timeRemaining < 600 ? "text-amber-100" : "text-white")}>
              {formatTime(timeRemaining)}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <MiniStat label="Questions" value={examQuestions.length} />
            <MiniStat label="Answered" value={answeredCount} />
            <MiniStat label="Best" value={`${stats.bestScore}%`} />
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Answered progress</span>
              <span className="font-semibold text-white">{progress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                animate={{ width: `${progress}%` }}
                className="h-full rounded-full bg-gradient-to-r from-cyan-200 via-teal-200 to-amber-200"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={() => {
                if (!isExamInProgress || window.confirm("Restart with a new randomized exam?")) {
                  startNewExam(questions);
                }
              }}
            >
              New random exam
            </Button>
            {!isSubmitted ? (
              <Button
                icon={<ShieldCheck className="h-4 w-4" />}
                onClick={confirmSubmit}
                variant="primary"
              >
                Submit exam
              </Button>
            ) : null}
          </div>
        </GlassPanel>

        <GlassPanel className="p-5" glow="cyan">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Question navigator
          </p>
          <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8 xl:grid-cols-5">
            {examQuestions.map((question, index) => {
              const isAnswered = answers[index] !== undefined;
              const isActive = currentIndex === index;
              const isCorrect = isSubmitted && answers[index] === question.correctAnswerIndex;

              return (
                <button
                  className={cn(
                    "h-10 rounded-lg border text-xs font-semibold transition",
                    isActive
                      ? "border-cyan-200/50 bg-cyan-200/16 text-white"
                      : isSubmitted && isCorrect
                        ? "border-emerald-300/35 bg-emerald-300/12 text-emerald-100"
                        : isSubmitted && isAnswered
                          ? "border-rose-300/35 bg-rose-300/12 text-rose-100"
                          : isAnswered
                            ? "border-teal-300/35 bg-teal-300/12 text-teal-100"
                            : "border-white/10 bg-white/[0.045] text-slate-400 hover:text-white",
                  )}
                  key={question.id}
                  onClick={() => setCurrentIndex(index)}
                  type="button"
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </GlassPanel>
      </aside>

      <section>
        {isSubmitted ? (
          <>
            <GlassPanel className="mb-6 p-5" glow={isPassing ? "teal" : "amber"}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Exam result
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold text-white">
                    {isPassing ? "Passing practice score" : "Keep training"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Score: {finalScore}/{examQuestions.length} ({scorePercent}%)
                  </p>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
                  {isPassing ? (
                    <CheckCircle2 className="h-8 w-8 text-emerald-200" />
                  ) : (
                    <AlertTriangle className="h-8 w-8 text-amber-200" />
                  )}
                </div>
              </div>
            </GlassPanel>
            <ExamReviewPanel
              categoryInsights={resultCategoryInsights}
              incorrectQuestions={incorrectQuestions}
              message={reviewMessage}
              onAddMissed={addMissedToReviewQueue}
              onPracticeWeakAreas={practiceWeakAreas}
            />
          </>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.25 }}
          >
            <GlassPanel className="overflow-hidden" glow="cyan">
              <div className="border-b border-white/10 bg-white/[0.035] p-5 md:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-300">
                    {currentQuestion.category ?? "Uncategorized"}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">
                    Question {currentIndex + 1} of {examQuestions.length}
                  </span>
                </div>
                <h2 className="mt-6 text-2xl font-semibold leading-tight text-white md:text-4xl">
                  {currentQuestion.question}
                </h2>
              </div>

              <div className="p-5 md:p-7">
                <div className="grid gap-3">
                  {currentQuestion.options.map((option, index) => {
                    const isSelected = answers[currentIndex] === index;
                    const isCorrect = currentQuestion.correctAnswerIndex === index;
                    const showReview = isSubmitted;

                    return (
                      <motion.button
                        whileHover={{ y: !isSubmitted ? -2 : 0 }}
                        className={cn(
                          "grid min-h-16 grid-cols-[2.75rem_1fr_auto] items-center gap-4 rounded-2xl border p-4 text-left transition",
                          showReview && isCorrect
                            ? "border-emerald-300/45 bg-emerald-300/12 text-emerald-50"
                            : showReview && isSelected
                              ? "border-rose-300/45 bg-rose-300/12 text-rose-50"
                              : isSelected
                                ? "border-cyan-200/45 bg-cyan-200/12 text-cyan-50"
                                : "border-white/10 bg-white/[0.045] text-slate-200 hover:border-cyan-200/25 hover:bg-white/[0.075]",
                        )}
                        disabled={isSubmitted}
                        key={`${currentQuestion.id}-${option}`}
                        onClick={() => chooseAnswer(index)}
                        type="button"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-sm font-semibold">
                          {answerLabels[index] ?? index + 1}
                        </span>
                        <span className="text-sm font-semibold leading-6">{option}</span>
                        {showReview && isCorrect ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : null}
                        {showReview && isSelected && !isCorrect ? <XCircle className="h-5 w-5 shrink-0" /> : null}
                      </motion.button>
                    );
                  })}
                </div>

                {isSubmitted ? (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 rounded-2xl border border-white/10 bg-black/28 p-5"
                    initial={{ opacity: 0, y: 10 }}
                  >
                    <p className="text-sm font-semibold text-white">Explanation</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {currentQuestion.explanation ?? "No explanation is attached to this prompt yet."}
                    </p>
                  </motion.div>
                ) : null}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <Button
                    disabled={currentIndex === 0}
                    icon={<ChevronLeft className="h-4 w-4" />}
                    onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                  >
                    Previous
                  </Button>
                  <div className="flex gap-3">
                    {currentIndex < examQuestions.length - 1 ? (
                      <Button
                        icon={<ChevronRight className="h-4 w-4" />}
                        onClick={() =>
                          setCurrentIndex((index) => Math.min(examQuestions.length - 1, index + 1))
                        }
                        variant="primary"
                      >
                        Next
                      </Button>
                    ) : !isSubmitted ? (
                      <Button
                        icon={<ShieldCheck className="h-4 w-4" />}
                        onClick={confirmSubmit}
                        variant="primary"
                      >
                        Submit
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </GlassPanel>
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  );
}

function ExamReviewPanel({
  categoryInsights,
  incorrectQuestions,
  message,
  onAddMissed,
  onPracticeWeakAreas,
}: {
  categoryInsights: CategoryInsight[];
  incorrectQuestions: IncorrectQuestion[];
  message: string | null;
  onAddMissed: () => void;
  onPracticeWeakAreas: () => void;
}) {
  const weakCategories = categoryInsights.filter((item) => item.accuracy < 72).slice(0, 4);
  const displayCategories = weakCategories.length ? weakCategories : categoryInsights.slice(0, 4);

  return (
    <GlassPanel className="mb-6 p-5" glow="cyan">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Post-exam review
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Convert misses into recall.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Missed questions can be sent to Study OS for local active recall.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={!incorrectQuestions.length}
            icon={<ListPlus className="h-4 w-4" />}
            onClick={onAddMissed}
            variant="primary"
          >
            Add missed to review
          </Button>
          <Button icon={<Target className="h-4 w-4" />} onClick={onPracticeWeakAreas}>
            Practice weak areas
          </Button>
        </div>
      </div>

      {message ? (
        <p className="mt-4 rounded-xl border border-teal-200/25 bg-teal-200/10 p-3 text-sm font-semibold text-teal-100">
          {message}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Category focus
          </p>
          <div className="mt-4 space-y-3">
            {displayCategories.length ? (
              displayCategories.map((item) => (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3" key={item.category}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-white">{item.category}</p>
                    <span className={cn("text-xs font-semibold", item.accuracy < 72 ? "text-amber-100" : "text-teal-100")}>
                      {item.accuracy}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-200 via-teal-200 to-amber-200"
                      style={{ width: `${item.accuracy}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-slate-400">Category scoring appears after submission.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Missed questions
            </p>
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs font-semibold text-slate-300">
              {incorrectQuestions.length}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {incorrectQuestions.length ? (
              incorrectQuestions.slice(0, 5).map(({ index, question, selectedIndex }) => (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3" key={`${question.id}-${index}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-semibold leading-5 text-white">
                      {question.question}
                    </p>
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.055] px-2 py-1 text-xs text-slate-300">
                      Q{index + 1}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {question.category ?? "Uncategorized"} / selected{" "}
                    {selectedIndex === undefined ? "none" : answerLabels[selectedIndex]}
                    {" / "}correct {answerLabels[question.correctAnswerIndex]}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-teal-200/20 bg-teal-200/10 p-3 text-sm leading-6 text-teal-100">
                No missed questions on this run.
              </p>
            )}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function ExamLobby({
  availableQuestions,
  bestScore,
  history,
  onStart,
  totalSessions,
}: {
  availableQuestions: number;
  bestScore: number;
  history: QuizHistoryItem[];
  onStart: () => void;
  totalSessions: number;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
      <GlassPanel className="relative overflow-hidden p-6 md:p-8" glow="cyan">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-100">
            <FileQuestion className="h-4 w-4" />
            AWS practice exam lobby
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl">
            Start when you are ready.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Review the exam conditions before the timer starts. Your randomized
            question set is created only after you press Start Exam.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <MiniStat icon={<Clock3 className="h-4 w-4" />} label="Timer" value="90m" />
            <MiniStat icon={<ListChecks className="h-4 w-4" />} label="Questions" value={examSize} />
            <MiniStat icon={<Award className="h-4 w-4" />} label="Best" value={`${bestScore}%`} />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              className="min-h-12 px-6"
              icon={<Play className="h-5 w-5" />}
              onClick={onStart}
              variant="primary"
            >
              Start exam
            </Button>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="p-6 md:p-7" glow="teal">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Exam conditions
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Before you begin</h2>
          </div>
          <ShieldCheck className="h-6 w-6 text-teal-200" />
        </div>

        <div className="mt-6 space-y-3">
          {[
            "The timer starts only after Start Exam.",
            "65 questions are randomly selected from the available bank.",
            "Answer choices are shuffled for every question.",
            "Leaving after the exam starts asks for confirmation.",
            "Correct answers and explanations appear after submission.",
          ].map((item) => (
            <div
              className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm leading-6 text-slate-300"
              key={item}
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
              {item}
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <MiniStat label="Available" value={availableQuestions} />
          <MiniStat label="Sessions" value={totalSessions} />
        </div>

        <ScoreHistoryPanel history={history} />
      </GlassPanel>
    </div>
  );
}

function ScoreHistoryPanel({ history }: { history: QuizHistoryItem[] }) {
  const recentHistory = history.slice(0, 5);

  return (
    <div className="mt-7 border-t border-white/10 pt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            <History className="h-4 w-4 text-cyan-200" />
            Score history
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Recent local exam results saved on this device.
          </p>
        </div>
        {recentHistory.length ? (
          <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-semibold text-slate-300">
            Last {recentHistory.length}
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {recentHistory.length ? (
          recentHistory.map((item) => {
            const percentage = item.total ? Math.round((item.score / item.total) * 100) : 0;

            return (
              <div className="border-b border-white/10 pb-4 last:border-b-0 last:pb-0" key={`${item.date}-${item.category}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{item.category}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatHistoryDate(item.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-cyan-100">
                      {item.score}/{item.total}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{percentage}%</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-200 via-teal-200 to-amber-200"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-white/12 bg-black/20 p-4 text-sm leading-6 text-slate-400">
            No exam history yet. Your first completed exam will appear here with score and date.
          </div>
        )}
      </div>
    </div>
  );
}
