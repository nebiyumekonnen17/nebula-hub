import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  HelpCircle,
  MessageSquarePlus,
  RotateCcw,
  Send,
  ShieldCheck,
  Trophy,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useSupabase } from '../../lib/supabase/SupabaseProvider';

type QuizMode = 'exam' | 'study';
type AnswerState = number[];

type RawQuizQuestion = {
  id: number;
  question: string;
  options: unknown;
  correct_answer_index?: number | null;
  correct_answer_indexes?: number[] | null;
  correctIndex?: number | null;
  correctIndexes?: number[] | null;
  explanation?: string | null;
  category?: string | null;
  created_at?: string | null;
};

type QuizQuestion = {
  id: number;
  question: string;
  options: string[];
  correctIndexes: number[];
  requiredSelections: number;
  explanation: string;
  category: string;
  sourceHasIncompleteMultiAnswer: boolean;
};

type QuizHistoryItem = {
  completedAt: string;
  mode: QuizMode;
  score: number;
  total: number;
  categoryBreakdown: Record<string, { correct: number; total: number }>;
};

const EXAM_QUESTION_COUNT = 65;
const EXAM_SECONDS = 90 * 60;
const STUDY_COUNTS = [20, 30, 40, 50, 65];
const QUIZ_HISTORY_KEY = 'nebula-hub:quiz:stats';
const FEEDBACK_NAME_KEY = 'nebula-hub:feedback:name:v1';
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function parseOptions(options: unknown): string[] {
  if (Array.isArray(options)) {
    return options.map(String).map((option) => option.trim()).filter(Boolean);
  }

  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((option) => option.trim()).filter(Boolean);
      }
    } catch {
      return options
        .split(/\n|(?=\b[A-D][).]\s)/)
        .map((option) => option.replace(/^[A-D][).]\s*/i, '').trim())
        .filter(Boolean);
    }
  }

  return [];
}

function inferRequiredSelections(question: string) {
  const lower = question.toLowerCase();
  const match = lower.match(/\b(?:choose|select|pick)\s+(two|three|four|2|3|4)\b/);
  if (!match) return 1;

  const value = match[1];
  if (value === 'two' || value === '2') return 2;
  if (value === 'three' || value === '3') return 3;
  if (value === 'four' || value === '4') return 4;
  return 1;
}

function getCorrectSourceIndexes(question: RawQuizQuestion): number[] {
  const multi = question.correct_answer_indexes ?? question.correctIndexes;
  if (Array.isArray(multi) && multi.length > 0) {
    return [...new Set(multi.filter((index) => Number.isInteger(index)))];
  }

  const single = question.correct_answer_index ?? question.correctIndex;
  return Number.isInteger(single) ? [single as number] : [];
}

function normalizeQuestion(question: RawQuizQuestion): QuizQuestion | null {
  const parsedOptions = parseOptions(question.options);
  const correctSourceIndexes = getCorrectSourceIndexes(question);

  if (!question.question || parsedOptions.length < 2 || correctSourceIndexes.length === 0) {
    return null;
  }

  const indexedOptions = parsedOptions.map((option, originalIndex) => ({ option, originalIndex }));
  const shuffledOptions = shuffle(indexedOptions);
  const correctIndexes = shuffledOptions
    .map((option, shuffledIndex) => (correctSourceIndexes.includes(option.originalIndex) ? shuffledIndex : -1))
    .filter((index) => index >= 0);
  const inferredRequired = inferRequiredSelections(question.question);
  const requiredSelections = Math.max(correctIndexes.length, inferredRequired);

  return {
    id: Number(question.id),
    question: question.question.trim(),
    options: shuffledOptions.map(({ option }) => option),
    correctIndexes,
    requiredSelections,
    explanation: question.explanation?.trim() || 'No explanation has been added for this question yet.',
    category: question.category?.trim() || 'AWS Cloud Practitioner',
    sourceHasIncompleteMultiAnswer: inferredRequired > correctIndexes.length,
  };
}

function isExactAnswer(selected: number[], correct: number[]) {
  if (selected.length !== correct.length) return false;
  const selectedSet = new Set(selected);
  return correct.every((index) => selectedSet.has(index));
}

function calculateCategoryBreakdown(questions: QuizQuestion[], answers: AnswerState[]) {
  return questions.reduce<Record<string, { correct: number; total: number }>>((breakdown, question, index) => {
    const category = question.category;
    const bucket = breakdown[category] ?? { correct: 0, total: 0 };
    const selected = answers[index] ?? [];
    bucket.total += 1;
    if (isExactAnswer(selected, question.correctIndexes)) bucket.correct += 1;
    breakdown[category] = bucket;
    return breakdown;
  }, {});
}

function readHistory(): QuizHistoryItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUIZ_HISTORY_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(item: QuizHistoryItem) {
  const next = [item, ...readHistory()].slice(0, 30);
  localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(next));
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function buildReviewQueueItems(questions: QuizQuestion[], answers: AnswerState[]) {
  return questions
    .map((question, index) => ({ question, selected: answers[index] ?? [] }))
    .filter(({ question, selected }) => !isExactAnswer(selected, question.correctIndexes))
    .map(({ question }) => ({
      id: `quiz-${question.id}-${Date.now()}`,
      type: 'quiz-question',
      category: question.category,
      reason: 'Missed during quiz session',
      addedAt: new Date().toISOString(),
      status: 'active',
      questionId: question.id,
    }));
}

function addMissedToReviewQueue(questions: QuizQuestion[], answers: AnswerState[]) {
  const key = 'nebula-hub:review-queue:v1';
  const missed = buildReviewQueueItems(questions, answers);
  const current = JSON.parse(localStorage.getItem(key) ?? '[]');
  localStorage.setItem(key, JSON.stringify([...(Array.isArray(current) ? current : []), ...missed]));
  return missed.length;
}

function FeedbackDrawer({
  mode,
  question,
  selectedAnswers,
  onClose,
}: {
  mode: QuizMode;
  question: QuizQuestion;
  selectedAnswers: number[];
  onClose: () => void;
}) {
  const supabaseContext = useSupabase() as any;
  const supabase = supabaseContext.supabase ?? supabaseContext.client;
  const savedFeedbackName = localStorage.getItem(FEEDBACK_NAME_KEY) ?? '';
  const [name, setName] = useState(savedFeedbackName);
  const [suggested, setSuggested] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'sent' | 'error'>('idle');

  const toggleSuggested = (index: number) => {
    setSuggested((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index].sort((a, b) => a - b),
    );
  };

  const submitFeedback = async () => {
    if (!name.trim() || !message.trim() || suggested.length === 0 || status === 'saving') return;
    if (!supabase) {
      setStatus('error');
      return;
    }

    setStatus('saving');
    const { error } = await (supabase as any).from('quiz_answer_feedback').insert({
      question_id: question.id,
      selected_answer_indexes: selectedAnswers,
      suggested_answer_indexes: suggested,
      message: message.trim().slice(0, 1200),
      reporter_name: name.trim().slice(0, 120),
      contact: contact.trim().slice(0, 160) || null,
      quiz_mode: mode,
      page_url: window.location.href,
      status: 'new',
    });

    if (error) {
      setStatus('error');
      return;
    }

    localStorage.setItem(FEEDBACK_NAME_KEY, name.trim().slice(0, 120));
    setStatus('sent');
    setTimeout(onClose, 1100);
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[18px] border border-cyan-300/20 bg-slate-950/95 p-4 shadow-2xl shadow-cyan-950/40"
      exit={{ opacity: 0, y: -8 }}
      initial={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Suggest answer</p>
          <p className="mt-1 text-sm text-slate-300">
            Tell us what should be corrected. This will not reveal the official answer during an exam.
          </p>
        </div>
        <button
          aria-label="Close feedback"
          className="rounded-full border border-white/10 p-2 text-slate-400 transition hover:border-cyan-300/40 hover:text-white"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {question.options.map((option, index) => (
          <label
            className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm transition ${
              suggested.includes(index)
                ? 'border-cyan-300/60 bg-cyan-300/10 text-white'
                : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/30'
            }`}
            key={`${question.id}-suggest-${option}`}
          >
            <input
              checked={suggested.includes(index)}
              className="mt-1 accent-cyan-300"
              onChange={() => toggleSuggested(index)}
              type="checkbox"
            />
            <span>
              <span className="mr-2 font-semibold text-cyan-100">{LETTERS[index]}.</span>
              {option}
            </span>
          </label>
        ))}
      </div>

      <textarea
        className="mt-4 min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
        maxLength={1200}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="What is wrong, and why do you think this answer should change?"
        value={message}
      />
      {savedFeedbackName ? (
        <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
          Reporting as <span className="font-semibold text-cyan-100">{savedFeedbackName}</span>
        </p>
      ) : (
        <input
          className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          value={name}
        />
      )}
      <input
        className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
        maxLength={160}
        onChange={(event) => setContact(event.target.value)}
        placeholder="Optional contact email or LinkedIn"
        value={contact}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Selected in quiz: {selectedAnswers.length ? selectedAnswers.map((index) => LETTERS[index]).join(', ') : 'none yet'}
        </p>
        <button
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!name.trim() || !message.trim() || suggested.length === 0 || status === 'saving' || status === 'sent'}
          onClick={submitFeedback}
          type="button"
        >
          <Send className="h-4 w-4" />
          {status === 'saving' ? 'Sending...' : status === 'sent' ? 'Sent' : 'Submit suggestion'}
        </button>
      </div>

      {status === 'error' ? (
        <p className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
          Feedback could not be sent. Confirm the Supabase feedback table and insert policy are deployed.
        </p>
      ) : null}
    </motion.div>
  );
}

function ModeCard({
  active,
  description,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  description: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-2xl border p-5 text-left transition ${
        active
          ? 'border-cyan-300/60 bg-cyan-300/10 shadow-2xl shadow-cyan-950/40'
          : 'border-white/10 bg-white/[0.04] hover:border-cyan-300/30'
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-100">
        {icon}
      </span>
      <span className="mt-4 block text-lg font-semibold text-white">{label}</span>
      <span className="mt-2 block text-sm leading-6 text-slate-400">{description}</span>
    </button>
  );
}

export function QuizPage() {
  const supabaseContext = useSupabase() as any;
  const supabase = supabaseContext.supabase ?? supabaseContext.client;
  const envStatus = supabaseContext.envStatus ?? {};
  const [bank, setBank] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<QuizMode>('exam');
  const [studyCount, setStudyCount] = useState(20);
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(EXAM_SECONDS);
  const [finished, setFinished] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [reviewFeedbackQuestionId, setReviewFeedbackQuestionId] = useState<number | null>(null);
  const [reviewQueuedCount, setReviewQueuedCount] = useState<number | null>(null);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex] ?? [];
  const supabaseReady = Boolean((envStatus as any)?.isSupabaseReady ?? (envStatus as any)?.isReady ?? supabase);
  const answeredCount = answers.filter((answer) => answer.length > 0).length;
  const score = useMemo(
    () => questions.reduce<number>((total, question, index) => total + (isExactAnswer(answers[index] ?? [], question.correctIndexes) ? 1 : 0), 0),
    [answers, questions],
  );
  const percentage = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const hasIncompleteMultiAnswerData = questions.some((question) => question.sourceHasIncompleteMultiAnswer);

  useEffect(() => {
    let active = true;

    async function loadQuestions() {
      if (!supabase) return;

      setLoading(true);
      setLoadError(null);

      const client = supabase as any;
      let response = await client
        .from('aws_quiz_questions')
        .select('id, question, options, correct_answer_index, correct_answer_indexes, explanation, category, created_at')
        .limit(2000);

      if (response.error?.message?.toLowerCase().includes('correct_answer_indexes')) {
        response = await client
          .from('aws_quiz_questions')
          .select('id, question, options, correct_answer_index, explanation, category, created_at')
          .limit(2000);
      }

      if (!active) return;

      if (response.error) {
        setLoadError(response.error.message);
        setLoading(false);
        return;
      }

      const normalized = ((response.data ?? []) as RawQuizQuestion[]).map(normalizeQuestion).filter(Boolean) as QuizQuestion[];
      setBank(normalized);
      setLoading(false);
    }

    loadQuestions();
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!started || finished || mode !== 'exam') return;

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setFinished(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [finished, mode, started]);

  useEffect(() => {
    if (!started || finished) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [finished, started]);

  const startQuiz = useCallback(() => {
    const total = mode === 'exam' ? EXAM_QUESTION_COUNT : studyCount;
    const selected = shuffle(bank).slice(0, Math.min(total, bank.length));

    setQuestions(selected);
    setAnswers(selected.map(() => []));
    setCurrentIndex(0);
    setSecondsLeft(EXAM_SECONDS);
    setFinished(false);
    setFeedbackOpen(false);
    setReviewQueuedCount(null);
    setStarted(true);
  }, [bank, mode, studyCount]);

  const finishQuiz = useCallback(() => {
    if (!questions.length) return;

    const item: QuizHistoryItem = {
      categoryBreakdown: calculateCategoryBreakdown(questions, answers),
      completedAt: new Date().toISOString(),
      mode,
      score,
      total: questions.length,
    };

    saveHistory(item);
    setFinished(true);
    setFeedbackOpen(false);
  }, [answers, mode, questions, score]);

  const toggleAnswer = (answerIndex: number) => {
    if (!currentQuestion || finished) return;

    setAnswers((current) =>
      current.map((answer, index) => {
        if (index !== currentIndex) return answer;

        if (currentQuestion.requiredSelections <= 1) {
          return [answerIndex];
        }

        if (answer.includes(answerIndex)) {
          return answer.filter((item) => item !== answerIndex);
        }

        if (answer.length >= currentQuestion.requiredSelections) {
          return [...answer.slice(1), answerIndex].sort((a, b) => a - b);
        }

        return [...answer, answerIndex].sort((a, b) => a - b);
      }),
    );
  };

  if (!supabaseReady) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-[28px] border border-amber-300/30 bg-amber-300/10 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-100">Local setup required</p>
          <h1 className="mt-4 text-4xl font-semibold text-white">Connect Supabase to start the exam simulator.</h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            Add your frontend Supabase URL and anon key, then restart Vite. The quiz will stay read-only except for answer
            suggestions after the feedback table is deployed.
          </p>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="animate-pulse rounded-[28px] border border-white/10 bg-white/[0.04] p-8">
          <div className="h-5 w-44 rounded bg-white/10" />
          <div className="mt-6 h-12 w-2/3 rounded bg-white/10" />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="h-40 rounded-2xl bg-white/10" />
            <div className="h-40 rounded-2xl bg-white/10" />
          </div>
        </div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-[28px] border border-rose-300/30 bg-rose-400/10 p-8">
          <AlertTriangle className="h-8 w-8 text-rose-200" />
          <h1 className="mt-4 text-3xl font-semibold text-white">Quiz questions could not load.</h1>
          <p className="mt-3 text-slate-300">{loadError}</p>
        </div>
      </section>
    );
  }

  if (!started) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-[30px] border border-white/10 bg-slate-950/75 p-6 shadow-2xl shadow-black/40 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
                <ShieldCheck className="h-4 w-4" />
                AWS exam simulator
              </span>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl">
                Choose how you want to train today.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                Use Exam Mode for the real 90-minute pressure test, or Study Mode when you want explanations after every
                answer.
              </p>

              {hasIncompleteMultiAnswerData ? (
                <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
                  Some questions say “choose two” but only have one stored correct answer. Add values to
                  <code className="mx-1 rounded bg-black/30 px-1">correct_answer_indexes</code>
                  for those rows to score them fully.
                </div>
              ) : null}
            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Question bank</p>
                <p className="mt-3 text-4xl font-semibold text-white">{bank.length}</p>
                <p className="mt-2 text-sm text-slate-400">Randomized each session with shuffled answer choices.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Exam</p>
                  <p className="mt-3 text-2xl font-semibold text-white">65 / 90m</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Study</p>
                  <p className="mt-3 text-2xl font-semibold text-white">20-65</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <ModeCard
              active={mode === 'exam'}
              description="65 randomized questions, 90-minute timer, no explanations until final review."
              icon={<Clock className="h-5 w-5" />}
              label="Exam Mode"
              onClick={() => setMode('exam')}
            />
            <ModeCard
              active={mode === 'study'}
              description="Pick your question count and get explanations right after each answer."
              icon={<HelpCircle className="h-5 w-5" />}
              label="Study Mode"
              onClick={() => setMode('study')}
            />
          </div>

          {mode === 'study' ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Study question count</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {STUDY_COUNTS.map((count) => (
                  <button
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      studyCount === count
                        ? 'border-cyan-300/60 bg-cyan-300/15 text-white'
                        : 'border-white/10 bg-black/20 text-slate-300 hover:border-cyan-300/30'
                    }`}
                    key={count}
                    onClick={() => setStudyCount(count)}
                    type="button"
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <button
            className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-cyan-300/50 bg-cyan-300/15 px-6 py-3 text-sm font-semibold text-cyan-50 shadow-xl shadow-cyan-950/30 transition hover:bg-cyan-300/22 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!bank.length}
            onClick={startQuiz}
            type="button"
          >
            <Flag className="h-4 w-4" />
            Start {mode === 'exam' ? 'exam' : 'study session'}
          </button>
        </div>
      </section>
    );
  }

  if (finished) {
    const missed = questions.filter((question, index) => !isExactAnswer(answers[index] ?? [], question.correctIndexes));

    return (
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-[30px] border border-white/10 bg-slate-950/75 p-6 shadow-2xl shadow-black/40 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
                <Trophy className="h-4 w-4" />
                Session complete
              </span>
              <h1 className="mt-4 text-4xl font-semibold text-white">{percentage}% readiness score</h1>
              <p className="mt-3 text-slate-300">
                {score} correct out of {questions.length}. Review missed questions below before starting another run.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/40"
                onClick={() => {
                  const added = addMissedToReviewQueue(questions, answers);
                  setReviewQueuedCount(added);
                }}
                type="button"
              >
                Add missed to review queue
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/18"
                onClick={() => setStarted(false)}
                type="button"
              >
                <RotateCcw className="h-4 w-4" />
                New session
              </button>
            </div>
          </div>

          {reviewQueuedCount !== null ? (
            <p className="mt-5 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-100">
              Added {reviewQueuedCount} missed question{reviewQueuedCount === 1 ? '' : 's'} to Study OS.
            </p>
          ) : null}

          <div className="mt-8 grid gap-4">
            {missed.length ? (
              missed.map((question) => {
                const originalIndex = questions.findIndex((item) => item.id === question.id);
                const selected = answers[originalIndex] ?? [];

                return (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5" key={`missed-${question.id}`}>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{question.category}</p>
                    <h2 className="mt-3 text-lg font-semibold text-white">{question.question}</h2>
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {question.options.map((option, index) => {
                        const correct = question.correctIndexes.includes(index);
                        const picked = selected.includes(index);

                        return (
                          <div
                            className={`rounded-xl border p-3 text-sm ${
                              correct
                                ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-50'
                                : picked
                                  ? 'border-rose-300/40 bg-rose-300/10 text-rose-50'
                                  : 'border-white/10 bg-black/20 text-slate-300'
                            }`}
                            key={`${question.id}-review-${option}`}
                          >
                            <span className="mr-2 font-semibold">{LETTERS[index]}.</span>
                            {option}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-100">Explanation</p>
                        <button
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/40"
                          onClick={() =>
                            setReviewFeedbackQuestionId((openId) => (openId === question.id ? null : question.id))
                          }
                          type="button"
                        >
                          <MessageSquarePlus className="h-4 w-4" />
                          Suggest answer
                        </button>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{question.explanation}</p>
                      <AnimatePresence>
                        {reviewFeedbackQuestionId === question.id ? (
                          <div className="mt-4">
                            <FeedbackDrawer
                              mode={mode}
                              onClose={() => setReviewFeedbackQuestionId(null)}
                              question={question}
                              selectedAnswers={selected}
                            />
                          </div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-emerald-50">
                Perfect run. No missed questions to review.
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (!currentQuestion) return null;

  const studyShowExplanation = mode === 'study' && currentAnswer.length >= currentQuestion.requiredSelections;
  const currentIsCorrect = isExactAnswer(currentAnswer, currentQuestion.correctIndexes);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="rounded-[30px] border border-white/10 bg-slate-950/75 p-5 shadow-2xl shadow-black/40 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
              {mode === 'exam' ? 'Exam Mode' : 'Study Mode'}
            </span>
            <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">
              Question {currentIndex + 1} of {questions.length}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white">
              {mode === 'exam' ? formatTime(secondsLeft) : `${score}/${answeredCount || 0} checked`}
            </div>
          </div>
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-cyan-300 transition-all"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_320px]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{currentQuestion.category}</p>
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
                Choose {currentQuestion.requiredSelections} answer{currentQuestion.requiredSelections === 1 ? '' : 's'}
              </span>
            </div>
            <h2 className="mt-5 text-2xl font-semibold leading-snug text-white">{currentQuestion.question}</h2>

            {currentQuestion.sourceHasIncompleteMultiAnswer ? (
              <p className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
                This question appears to require multiple answers, but the database row has fewer stored correct answers. Update
                <code className="mx-1 rounded bg-black/30 px-1">correct_answer_indexes</code>
                for full scoring accuracy.
              </p>
            ) : null}

            <div className="mt-6 grid gap-3">
              {currentQuestion.options.map((option, index) => {
                const selected = currentAnswer.includes(index);
                const revealStudy = studyShowExplanation;
                const correct = currentQuestion.correctIndexes.includes(index);

                return (
                  <button
                    className={`flex min-h-16 items-start gap-4 rounded-2xl border p-4 text-left text-sm transition ${
                      revealStudy && correct
                        ? 'border-emerald-300/50 bg-emerald-300/10 text-emerald-50'
                        : revealStudy && selected && !correct
                          ? 'border-rose-300/50 bg-rose-300/10 text-rose-50'
                          : selected
                            ? 'border-cyan-300/60 bg-cyan-300/12 text-white'
                            : 'border-white/10 bg-black/20 text-slate-300 hover:border-cyan-300/30 hover:bg-white/[0.06]'
                    }`}
                    key={`${currentQuestion.id}-${option}`}
                    onClick={() => toggleAnswer(index)}
                    type="button"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
                        selected ? 'border-cyan-200/70 bg-cyan-200/15 text-white' : 'border-white/15 text-slate-400'
                      }`}
                    >
                      {currentQuestion.requiredSelections > 1 ? (selected ? <CheckCircle2 className="h-4 w-4" /> : LETTERS[index]) : LETTERS[index]}
                    </span>
                    <span className="pt-1 leading-6">{option}</span>
                  </button>
                );
              })}
            </div>

            {studyShowExplanation ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className={`mt-6 rounded-2xl border p-4 ${
                  currentIsCorrect ? 'border-emerald-300/30 bg-emerald-300/10' : 'border-rose-300/30 bg-rose-300/10'
                }`}
                initial={{ opacity: 0, y: 10 }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className={`font-semibold ${currentIsCorrect ? 'text-emerald-100' : 'text-rose-100'}`}>
                    {currentIsCorrect ? 'Correct' : 'Review this one'}
                  </p>
                  <button
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/40"
                    onClick={() => setFeedbackOpen((open) => !open)}
                    type="button"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    Suggest answer
                  </button>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-200">{currentQuestion.explanation}</p>
                <AnimatePresence>
                  {feedbackOpen ? (
                    <div className="mt-4">
                      <FeedbackDrawer
                        mode={mode}
                        onClose={() => setFeedbackOpen(false)}
                        question={currentQuestion}
                        selectedAnswers={currentAnswer}
                      />
                    </div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            ) : null}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Session status</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-slate-500">Answered</p>
                  <p className="mt-1 text-xl font-semibold text-white">{answeredCount}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-slate-500">Score</p>
                  <p className="mt-1 text-xl font-semibold text-white">{score}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Navigator</p>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {questions.map((question, index) => (
                  <button
                    className={`h-9 rounded-lg border text-xs font-semibold transition ${
                      index === currentIndex
                        ? 'border-cyan-300/60 bg-cyan-300/15 text-white'
                        : answers[index]?.length
                          ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
                          : question.requiredSelections > 1
                            ? 'border-amber-300/20 bg-amber-300/5 text-amber-100'
                            : 'border-white/10 bg-black/20 text-slate-400'
                    }`}
                    key={question.id}
                    onClick={() => {
                      setCurrentIndex(index);
                      setFeedbackOpen(false);
                    }}
                    type="button"
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/40 disabled:opacity-40"
            disabled={currentIndex === 0}
            onClick={() => {
              setCurrentIndex((index) => Math.max(0, index - 1));
              setFeedbackOpen(false);
            }}
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/15"
              onClick={() => {
                if (window.confirm('Leave this quiz session? Your timer and current answers will reset.')) {
                  setStarted(false);
                }
              }}
              type="button"
            >
              Leave session
            </button>
            {currentIndex === questions.length - 1 ? (
              <button
                className="rounded-xl border border-cyan-300/50 bg-cyan-300/15 px-5 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/22"
                onClick={finishQuiz}
                type="button"
              >
                Submit quiz
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/18"
                onClick={() => {
                  setCurrentIndex((index) => Math.min(questions.length - 1, index + 1));
                  setFeedbackOpen(false);
                }}
                type="button"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
