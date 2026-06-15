import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  GraduationCap,
  PlayCircle,
  RotateCcw,
  ShieldQuestion,
  Trophy,
  XCircle,
} from "lucide-react";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingSkeleton } from "../../components/feedback/LoadingSkeleton";
import { SetupState } from "../../components/feedback/SetupState";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { fetchQuizQuestions } from "../../lib/supabase/queries";
import { useSupabase } from "../../lib/supabase/SupabaseProvider";
import { cn } from "../../lib/styles";

type RawQuestion = Awaited<ReturnType<typeof fetchQuizQuestions>>[number];
type QuizMode = "exam" | "study";

type SessionQuestion = {
  category: string;
  correctIndex: number;
  explanation: string | null;
  id: number;
  options: string[];
  question: string;
};

type QuizHistoryItem = {
  categoryBreakdown: Record<string, { correct: number; total: number }>;
  completedAt: string;
  mode: QuizMode;
  score: number;
  total: number;
};

const examQuestionCount = 65;
const examSeconds = 90 * 60;
const quizStatsKey = "nebula-hub:quiz:stats";
const studyQuestionCounts = [20, 30, 40, 50, 65];

function normalizeOptions(options: unknown): string[] {
  if (Array.isArray(options)) {
    return options.map(String).filter(Boolean);
  }

  if (typeof options === "string") {
    try {
      const parsed = JSON.parse(options) as unknown;
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return options
        .split(/\n|(?=\b[A-D][\).\s-]+)/)
        .map((item) => item.replace(/^[A-D][\).\s-]+/, "").trim())
        .filter(Boolean);
    }
  }

  return [];
}

function shuffle<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function prepareQuestion(row: RawQuestion): SessionQuestion | null {
  const options = normalizeOptions(row.options);

  if (!row.question || options.length < 2) {
    return null;
  }

  const originalCorrect = Number(row.correct_answer_index);
  const optionsWithOriginalIndex = options.map((option, index) => ({ index, option }));
  const shuffled = shuffle(optionsWithOriginalIndex);
  const correctIndex = shuffled.findIndex((item) => item.index === originalCorrect);

  if (correctIndex < 0) {
    return null;
  }

  return {
    category: row.category ?? "AWS Cloud Practitioner",
    correctIndex,
    explanation: row.explanation ?? null,
    id: Number(row.id),
    options: shuffled.map((item) => item.option),
    question: row.question,
  };
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function readHistory(): QuizHistoryItem[] {
  try {
    const stored = window.localStorage.getItem(quizStatsKey);
    const parsed = stored ? (JSON.parse(stored) as { history?: QuizHistoryItem[] }) : {};
    return parsed.history ?? [];
  } catch {
    return [];
  }
}

function saveHistory(item: QuizHistoryItem) {
  try {
    const history = [item, ...readHistory()].slice(0, 30);
    window.localStorage.setItem(quizStatsKey, JSON.stringify({ history }));
    window.dispatchEvent(new Event("nebula-hub:study-state"));
  } catch {
    // Quiz history is helpful, but the exam stays usable if localStorage is unavailable.
  }
}

function buildBreakdown(questions: SessionQuestion[], answers: Array<number | null>) {
  return questions.reduce<Record<string, { correct: number; total: number }>>((acc, question, index) => {
    const current = acc[question.category] ?? { correct: 0, total: 0 };
    current.total += 1;

    if (answers[index] === question.correctIndex) {
      current.correct += 1;
    }

    acc[question.category] = current;
    return acc;
  }, {});
}

function scoreQuiz(questions: SessionQuestion[], answers: Array<number | null>) {
  return answers.reduce<number>(
    (score, answer, index) => score + (answer === questions[index]?.correctIndex ? 1 : 0),
    0,
  );
}

export function QuizPage() {
  const { client, envStatus } = useSupabase();
  const [questions, setQuestions] = useState<SessionQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(client));
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<QuizMode | null>(null);
  const [studyQuestionCount, setStudyQuestionCount] = useState(20);
  const [sessionQuestions, setSessionQuestions] = useState<SessionQuestion[]>([]);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(examSeconds);
  const [isComplete, setIsComplete] = useState(false);
  const [history, setHistory] = useState<QuizHistoryItem[]>(readHistory);

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
          setQuestions(rows.map(prepareQuestion).filter(Boolean) as SessionQuestion[]);
        }
      })
      .catch((caught) => {
        if (isMounted) {
          setError(caught instanceof Error ? caught.message : "Quiz questions could not be loaded.");
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

  useEffect(() => {
    if (!mode || mode !== "exam" || isComplete || !sessionQuestions.length) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setIsComplete(true);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isComplete, mode, sessionQuestions.length]);

  useEffect(() => {
    const isActive = Boolean(mode && sessionQuestions.length && !isComplete);

    if (!isActive) {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isComplete, mode, sessionQuestions.length]);

  const currentQuestion = sessionQuestions[currentIndex];
  const selectedAnswer = answers[currentIndex];
  const score = useMemo(() => scoreQuiz(sessionQuestions, answers), [answers, sessionQuestions]);
  const percentage = sessionQuestions.length ? Math.round((score / sessionQuestions.length) * 100) : 0;
  const answeredCount = answers.filter((answer) => answer !== null).length;

  const startQuiz = (nextMode: QuizMode) => {
    const count = nextMode === "exam" ? examQuestionCount : Math.min(studyQuestionCount, questions.length);
    const nextQuestions = shuffle(questions).slice(0, Math.min(count, questions.length));

    setMode(nextMode);
    setSessionQuestions(nextQuestions);
    setAnswers(Array.from({ length: nextQuestions.length }, () => null));
    setCurrentIndex(0);
    setSecondsLeft(examSeconds);
    setIsComplete(false);
  };

  const finishQuiz = () => {
    if (!mode || !sessionQuestions.length) {
      return;
    }

    const item = {
      categoryBreakdown: buildBreakdown(sessionQuestions, answers),
      completedAt: new Date().toISOString(),
      mode,
      score,
      total: sessionQuestions.length,
    };

    saveHistory(item);
    setHistory(readHistory());
    setIsComplete(true);
  };

  const resetQuiz = () => {
    setMode(null);
    setSessionQuestions([]);
    setAnswers([]);
    setCurrentIndex(0);
    setSecondsLeft(examSeconds);
    setIsComplete(false);
  };

  const chooseAnswer = (answerIndex: number) => {
    if (isComplete || selectedAnswer !== null) {
      return;
    }

    setAnswers((current) => current.map((answer, index) => (index === currentIndex ? answerIndex : answer)));
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
        action={<Button onClick={() => window.location.reload()} variant="primary">Reload quiz</Button>}
        message={error}
        title="Quiz could not load"
      />
    );
  }

  if (!questions.length) {
    return (
      <EmptyState
        message="No valid quiz questions were returned from Supabase."
        title="Question bank unavailable"
      />
    );
  }

  if (!mode || !currentQuestion) {
    return (
      <div className="space-y-6">
        <GlassPanel className="relative overflow-hidden p-5 md:p-7" glow="cyan">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.12),transparent_34%)]" />
          <div className="relative grid gap-6 xl:grid-cols-[1fr_0.75fr] xl:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                <ShieldQuestion className="h-4 w-4" />
                AWS exam simulator
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl">
                Choose how you want to train.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Use Exam Mode when you want the real 90-minute pressure. Use Study Mode when you want immediate explanations after every answer.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <MiniStat label="Question bank" value={questions.length} />
              <MiniStat label="Exam timer" value="90 min" />
              <MiniStat label="Exam size" value="65" />
            </div>
          </div>
        </GlassPanel>

        <section className="grid gap-5 lg:grid-cols-2">
          <ModeCard
            accent="cyan"
            icon={<Clock3 className="h-6 w-6" />}
            onStart={() => startQuiz("exam")}
            points={["65 randomized questions", "90-minute timer", "Explanations only after final submit"]}
            title="Exam Mode"
          />
          <ModeCard
            accent="amber"
            icon={<Eye className="h-6 w-6" />}
            onStart={() => startQuiz("study")}
            points={[`${studyQuestionCount}-question focused session`, "Explanation after each answer", "Better for learning weak domains"]}
            studyQuestionCount={studyQuestionCount}
            studyQuestionCounts={studyQuestionCounts}
            title="Study Mode"
            onStudyQuestionCountChange={setStudyQuestionCount}
          />
        </section>

        <GlassPanel className="p-5" glow="teal">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Recent scores</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Score history</h2>
            </div>
            <Trophy className="h-6 w-6 text-amber-200" />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {history.length ? history.slice(0, 6).map((item, index) => (
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4" key={`${item.completedAt}-${index}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.mode}</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {Math.round((item.score / item.total) * 100)}%
                </p>
                <p className="mt-1 text-sm text-slate-400">{item.score}/{item.total}</p>
              </div>
            )) : (
              <p className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm leading-6 text-slate-400 md:col-span-3">
                No attempts yet. Start with Exam Mode for a baseline or Study Mode for guided practice.
              </p>
            )}
          </div>
        </GlassPanel>
      </div>
    );
  }

  if (isComplete) {
    const missed = sessionQuestions.filter((question, index) => answers[index] !== question.correctIndex);

    return (
      <div className="space-y-6">
        <GlassPanel className="p-5 md:p-7" glow="amber">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Result</p>
              <h1 className="mt-2 text-4xl font-semibold text-white md:text-6xl">{percentage}%</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {score} correct out of {sessionQuestions.length} in {mode === "exam" ? "Exam Mode" : "Study Mode"}.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button icon={<RotateCcw className="h-4 w-4" />} onClick={resetQuiz} variant="primary">
                Back to mode chooser
              </Button>
              <Button icon={<PlayCircle className="h-4 w-4" />} onClick={() => startQuiz(mode)}>
                Retake {mode === "exam" ? "exam" : "study set"}
              </Button>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5" glow="cyan">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Review</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Incorrect questions</h2>
          <div className="mt-5 space-y-4">
            {missed.length ? missed.map((question, index) => (
              <ReviewCard answer={answers[sessionQuestions.indexOf(question)]} index={index} key={question.id} question={question} />
            )) : (
              <p className="rounded-2xl border border-teal-200/20 bg-teal-200/10 p-4 text-sm font-semibold text-teal-100">
                Perfect run. No incorrect questions to review.
              </p>
            )}
          </div>
        </GlassPanel>
      </div>
    );
  }

  const showStudyFeedback = mode === "study" && selectedAnswer !== null;

  return (
    <div className="space-y-6">
      <GlassPanel className="p-5" glow="cyan">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {mode === "exam" ? "Exam Mode" : "Study Mode"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Question {currentIndex + 1} of {sessionQuestions.length}
            </h1>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat label="Answered" value={`${answeredCount}/${sessionQuestions.length}`} />
            <MiniStat label="Score" value={`${score}/${answeredCount || 0}`} />
            <MiniStat label={mode === "exam" ? "Timer" : "Pace"} value={mode === "exam" ? formatTimer(secondsLeft) : "Study"} />
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-200 via-teal-200 to-amber-200"
            style={{ width: `${((currentIndex + 1) / sessionQuestions.length) * 100}%` }}
          />
        </div>
      </GlassPanel>

      <GlassPanel className="p-5 md:p-7" glow="teal">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs font-semibold text-cyan-100">
            {currentQuestion.category}
          </span>
          {mode === "exam" ? (
            <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-xs font-semibold text-amber-100">
              Explanations hidden until final review
            </span>
          ) : (
            <span className="rounded-full border border-teal-200/20 bg-teal-200/10 px-3 py-1 text-xs font-semibold text-teal-100">
              Immediate explanation enabled
            </span>
          )}
        </div>
        <h2 className="mt-5 text-2xl font-semibold leading-9 text-white">{currentQuestion.question}</h2>

        <div className="mt-6 grid gap-3">
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrect = currentQuestion.correctIndex === index;
            const reveal = showStudyFeedback;

            return (
              <button
                className={cn(
                  "grid min-h-14 grid-cols-[2.25rem_1fr] items-center gap-3 rounded-2xl border p-4 text-left text-sm font-semibold leading-6 transition",
                  reveal && isCorrect
                    ? "border-teal-200/45 bg-teal-200/12 text-teal-50"
                    : reveal && isSelected && !isCorrect
                      ? "border-rose-200/45 bg-rose-300/10 text-rose-50"
                      : isSelected
                        ? "border-cyan-200/45 bg-cyan-200/12 text-cyan-50"
                        : "border-white/10 bg-white/[0.045] text-slate-300 hover:border-cyan-200/25 hover:bg-white/[0.075]",
                )}
                disabled={selectedAnswer !== null}
                key={`${option}-${index}`}
                onClick={() => chooseAnswer(index)}
                type="button"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white">
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>

        {showStudyFeedback ? (
          <div
            className={cn(
              "mt-5 rounded-2xl border p-4",
              selectedAnswer === currentQuestion.correctIndex
                ? "border-teal-200/25 bg-teal-200/10"
                : "border-rose-200/25 bg-rose-300/10",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              {selectedAnswer === currentQuestion.correctIndex ? (
                <CheckCircle2 className="h-5 w-5 text-teal-200" />
              ) : (
                <XCircle className="h-5 w-5 text-rose-200" />
              )}
              {selectedAnswer === currentQuestion.correctIndex ? "Correct" : "Review this answer"}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">
              {currentQuestion.explanation ?? "No explanation was provided for this question yet."}
            </p>
          </div>
        ) : null}
      </GlassPanel>

      <div className="flex flex-wrap justify-between gap-3">
        <Button disabled={currentIndex === 0} onClick={() => setCurrentIndex((current) => Math.max(0, current - 1))}>
          Previous
        </Button>
        <div className="flex flex-wrap gap-3">
          <Button onClick={resetQuiz} variant="ghost">Exit</Button>
          {currentIndex === sessionQuestions.length - 1 ? (
            <Button disabled={answeredCount === 0} onClick={finishQuiz} variant="primary">
              Submit
            </Button>
          ) : (
            <Button
              disabled={selectedAnswer === null}
              onClick={() => setCurrentIndex((current) => Math.min(sessionQuestions.length - 1, current + 1))}
              variant="primary"
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  accent,
  icon,
  onStudyQuestionCountChange,
  onStart,
  points,
  studyQuestionCount,
  studyQuestionCounts,
  title,
}: {
  accent: "amber" | "cyan";
  icon: ReactNode;
  onStudyQuestionCountChange?: (count: number) => void;
  onStart: () => void;
  points: string[];
  studyQuestionCount?: number;
  studyQuestionCounts?: number[];
  title: string;
}) {
  const accentClass = accent === "cyan" ? "border-cyan-200/25 shadow-cyan-950/30" : "border-amber-200/25 shadow-amber-950/30";

  return (
    <motion.article
      className={cn("rounded-3xl border bg-white/[0.045] p-5 shadow-2xl", accentClass)}
      whileHover={{ y: -3 }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/24 text-cyan-100">
          {icon}
        </div>
        <GraduationCap className="h-6 w-6 text-slate-500" />
      </div>
      <h2 className="mt-5 text-3xl font-semibold text-white">{title}</h2>
      <div className="mt-5 space-y-3">
        {points.map((point) => (
          <div className="flex items-center gap-2 text-sm leading-6 text-slate-300" key={point}>
            <CheckCircle2 className="h-4 w-4 text-teal-200" />
            {point}
          </div>
        ))}
      </div>
      {studyQuestionCounts?.length && onStudyQuestionCountChange && studyQuestionCount ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Study set size
          </p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {studyQuestionCounts.map((count) => (
              <button
                className={cn(
                  "min-h-10 rounded-xl border text-sm font-semibold transition",
                  studyQuestionCount === count
                    ? "border-amber-200/45 bg-amber-200/14 text-amber-50"
                    : "border-white/10 bg-white/[0.045] text-slate-400 hover:border-white/20 hover:text-white",
                )}
                key={count}
                onClick={() => onStudyQuestionCountChange(count)}
                type="button"
              >
                {count}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <Button className="mt-6 w-full" icon={<PlayCircle className="h-4 w-4" />} onClick={onStart} variant="primary">
        Start {title}
      </Button>
    </motion.article>
  );
}

function ReviewCard({
  answer,
  index,
  question,
}: {
  answer: number | null;
  index: number;
  question: SessionQuestion;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Missed question {index + 1}</p>
      <h3 className="mt-3 text-lg font-semibold leading-7 text-white">{question.question}</h3>
      <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-300">
        <p>Your answer: {answer === null ? "Not answered" : `${String.fromCharCode(65 + answer)}. ${question.options[answer]}`}</p>
        <p className="text-teal-100">
          Correct answer: {String.fromCharCode(65 + question.correctIndex)}. {question.options[question.correctIndex]}
        </p>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-400">
        {question.explanation ?? "No explanation was provided for this question yet."}
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
