import { readLocalValue, writeLocalValue } from "../storage/local";

export type QuizHistoryItem = {
  date: string;
  category: string;
  score: number;
  total: number;
  categoryBreakdown?: Record<string, { correct: number; total: number }>;
};

export type QuizStats = {
  bestScore: number;
  totalSessions: number;
  bestStreak: number;
  recentCategories: string[];
  history: QuizHistoryItem[];
};

export type ReviewQueueItem = {
  id: string;
  type: "service" | "quiz-question";
  sourceId: number;
  category: string | null;
  title: string;
  detail?: string;
  reason: string;
  addedAt: string;
  status: "queued" | "reviewed";
  lastReviewedAt?: string;
};

export type StudyOsState = {
  missionDate?: string;
  focusCategory?: string;
  targetScore: number;
};

export type StudyBriefCache = {
  schemaVersion: 1;
  generatedAt: string;
  summary: string;
  weeklyPlan: string[];
  focusAreas: string[];
  examTactics: string[];
};

export type CategoryInsight = {
  category: string;
  correct: number;
  total: number;
  accuracy: number;
};

export type StudyInsights = {
  readinessScore: number;
  bestScore: number;
  latestScore: number;
  recentTrend: number;
  totalSessions: number;
  categoryInsights: CategoryInsight[];
  weakCategories: CategoryInsight[];
  strongCategories: CategoryInsight[];
  recommendedActions: string[];
};

export const quizStatsKey = "nebula-hub:quiz:stats";
export const studyOsKey = "nebula-hub:study-os:v1";
export const savedServicesKey = "nebula-hub:wiki:saved-services:v1";
export const reviewQueueKey = "nebula-hub:review-queue:v1";
export const studyBriefKey = "nebula-hub:study-brief:v1";
export const studyStateEvent = "nebula-hub:study-state";

export const defaultQuizStats: QuizStats = {
  bestScore: 0,
  totalSessions: 0,
  bestStreak: 0,
  recentCategories: [],
  history: [],
};

export const defaultStudyOsState: StudyOsState = {
  targetScore: 72,
};

function notifyStudyStateChange() {
  window.dispatchEvent(new Event(studyStateEvent));
}

function percent(score: number, total: number) {
  return total ? Math.round((score / total) * 100) : 0;
}

export function getReviewQueueItemId(type: ReviewQueueItem["type"], sourceId: number) {
  return `${type}:${sourceId}`;
}

export function readQuizStats() {
  return readLocalValue<QuizStats>(quizStatsKey, defaultQuizStats);
}

export function writeQuizStats(stats: QuizStats) {
  writeLocalValue(quizStatsKey, stats);
  notifyStudyStateChange();
}

export function readStudyOsState() {
  return readLocalValue<StudyOsState>(studyOsKey, defaultStudyOsState);
}

export function writeStudyOsState(state: StudyOsState) {
  writeLocalValue(studyOsKey, state);
  notifyStudyStateChange();
}

export function readSavedServiceIds() {
  return readLocalValue<number[]>(savedServicesKey, []);
}

export function toggleSavedServiceId(serviceId: number) {
  const current = readSavedServiceIds();
  const next = current.includes(serviceId)
    ? current.filter((id) => id !== serviceId)
    : [serviceId, ...current].slice(0, 48);

  writeLocalValue(savedServicesKey, next);
  notifyStudyStateChange();
  return next;
}

export function readReviewQueue() {
  return readLocalValue<ReviewQueueItem[]>(reviewQueueKey, []);
}

export function upsertReviewQueueItem(
  item: Omit<ReviewQueueItem, "addedAt" | "id" | "status"> & {
    id?: string;
    status?: ReviewQueueItem["status"];
  },
) {
  const current = readReviewQueue();
  const id = item.id ?? getReviewQueueItemId(item.type, item.sourceId);
  const existing = current.find((entry) => entry.id === id);
  const nextItem: ReviewQueueItem = {
    ...existing,
    ...item,
    id,
    addedAt: existing?.addedAt ?? new Date().toISOString(),
    status: item.status ?? existing?.status ?? "queued",
  };
  const next = [nextItem, ...current.filter((entry) => entry.id !== id)].slice(0, 120);

  writeLocalValue(reviewQueueKey, next);
  notifyStudyStateChange();
  return next;
}

export function upsertReviewQueueItems(
  items: Array<
    Omit<ReviewQueueItem, "addedAt" | "id" | "status"> & {
      id?: string;
      status?: ReviewQueueItem["status"];
    }
  >,
) {
  let current = readReviewQueue();

  for (const item of items) {
    const id = item.id ?? getReviewQueueItemId(item.type, item.sourceId);
    const existing = current.find((entry) => entry.id === id);
    const nextItem: ReviewQueueItem = {
      ...existing,
      ...item,
      id,
      addedAt: existing?.addedAt ?? new Date().toISOString(),
      status: item.status ?? existing?.status ?? "queued",
    };
    current = [nextItem, ...current.filter((entry) => entry.id !== id)];
  }

  const next = current.slice(0, 120);
  writeLocalValue(reviewQueueKey, next);
  notifyStudyStateChange();
  return next;
}

export function updateReviewQueueItemStatus(id: string, status: ReviewQueueItem["status"]) {
  const next = readReviewQueue().map((item) =>
    item.id === id
      ? {
          ...item,
          status,
          lastReviewedAt: status === "reviewed" ? new Date().toISOString() : item.lastReviewedAt,
        }
      : item,
  );

  writeLocalValue(reviewQueueKey, next);
  notifyStudyStateChange();
  return next;
}

export function removeReviewQueueItem(id: string) {
  const next = readReviewQueue().filter((item) => item.id !== id);
  writeLocalValue(reviewQueueKey, next);
  notifyStudyStateChange();
  return next;
}

export function readStudyBrief() {
  return readLocalValue<StudyBriefCache | null>(studyBriefKey, null);
}

export function writeStudyBrief(brief: StudyBriefCache) {
  writeLocalValue(studyBriefKey, brief);
  notifyStudyStateChange();
}

export function buildStudyInsights(stats: QuizStats): StudyInsights {
  const history = stats.history ?? [];
  const latestScore = history[0] ? percent(history[0].score, history[0].total) : 0;
  const previousScore = history[1] ? percent(history[1].score, history[1].total) : latestScore;
  const categoryTotals = new Map<string, { correct: number; total: number }>();

  for (const item of history) {
    for (const [category, score] of Object.entries(item.categoryBreakdown ?? {})) {
      const current = categoryTotals.get(category) ?? { correct: 0, total: 0 };
      categoryTotals.set(category, {
        correct: current.correct + score.correct,
        total: current.total + score.total,
      });
    }
  }

  const categoryInsights = [...categoryTotals.entries()]
    .map(([category, score]) => ({
      category,
      correct: score.correct,
      total: score.total,
      accuracy: percent(score.correct, score.total),
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total || a.category.localeCompare(b.category));

  const weakCategories = categoryInsights.filter((item) => item.total > 0 && item.accuracy < 72).slice(0, 5);
  const strongCategories = [...categoryInsights]
    .sort((a, b) => b.accuracy - a.accuracy || b.total - a.total || a.category.localeCompare(b.category))
    .slice(0, 4);
  const coverageBoost = Math.min(12, categoryInsights.length * 2);
  const readinessScore = history.length
    ? Math.min(
        100,
        Math.round(latestScore * 0.62 + stats.bestScore * 0.24 + coverageBoost + Math.min(8, history.length)),
      )
    : 0;
  const recommendedActions = buildRecommendedActions(history.length, weakCategories, latestScore);

  return {
    readinessScore,
    bestScore: stats.bestScore,
    latestScore,
    recentTrend: latestScore - previousScore,
    totalSessions: stats.totalSessions,
    categoryInsights,
    weakCategories,
    strongCategories,
    recommendedActions,
  };
}

function buildRecommendedActions(
  historyCount: number,
  weakCategories: CategoryInsight[],
  latestScore: number,
) {
  if (!historyCount) {
    return [
      "Complete one full practice exam to establish a baseline.",
      "Save high-value services from the wiki for focused review.",
      "Queue confusing services as you study so Study OS can track them.",
    ];
  }

  const recommendations = weakCategories.slice(0, 3).map((item) => `Review ${item.category} (${item.accuracy}% accuracy).`);

  if (latestScore < 72) {
    recommendations.push("Run one targeted review pass before the next full exam.");
  } else {
    recommendations.push("Protect the passing score with a timed review of missed questions.");
  }

  recommendations.push("Use the review queue until all active items are marked reviewed.");
  return recommendations;
}
