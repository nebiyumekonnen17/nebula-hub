import type { AwsService } from "../supabase/types";
import type { StudyBriefCache } from "../study/studyState";
import { readLocalValue, writeLocalValue } from "../storage/local";

export type TutorialVideoLink = {
  title: string;
  searchQuery: string;
  focus: string;
};

export type GeminiEnrichment = {
  schemaVersion: 2;
  serviceId: number;
  generatedAt: string;
  explanation: string;
  useCase: string;
  detailedDocs: string;
  engineeringContext: string;
  videoLinks: TutorialVideoLink[];
  youtubeQueries: string[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export type StudyBriefInput = {
  readinessScore: number;
  bestScore: number;
  latestScore: number;
  recentTrend: number;
  weakCategories: string[];
  savedServices: string[];
  reviewQueue: string[];
  recentScores: string[];
};

const model = "gemini-2.5-flash-lite";
const geminiTimeoutMs = 18_000;

export function getEnrichmentKey(serviceId: number) {
  return `nebula-hub:wiki:gemini:v4:${serviceId}`;
}

export function readCachedEnrichment(serviceId: number): GeminiEnrichment | null {
  return readLocalValue<GeminiEnrichment | null>(getEnrichmentKey(serviceId), null);
}

export function cacheEnrichment(enrichment: GeminiEnrichment) {
  writeLocalValue(getEnrichmentKey(enrichment.serviceId), enrichment);
}

export function getFallbackVideoLinks(service: AwsService): TutorialVideoLink[] {
  return [
    {
      title: `${service.service_name} fundamentals`,
      searchQuery: `${service.service_name} AWS tutorial architecture`,
      focus: "Core concepts and architecture walkthrough",
    },
    {
      title: `${service.service_name} hands-on lab`,
      searchQuery: `${service.service_name} hands on AWS guide`,
      focus: "Step-by-step implementation practice",
    },
    {
      title: `${service.service_name} production patterns`,
      searchQuery: `${service.service_name} production best practices AWS`,
      focus: "Real-world engineering and operations context",
    },
  ];
}

export function getTutorialVideoLinks(
  service: AwsService,
  enrichment: GeminiEnrichment | null,
): TutorialVideoLink[] {
  return enrichment?.videoLinks?.length ? enrichment.videoLinks : getFallbackVideoLinks(service);
}

export function getYouTubeSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), geminiTimeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Gemini took too long to respond. Showing a local study fallback.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readGeminiError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: { message?: string; status?: string } };
    const message = data.error?.message?.trim();

    if (message) {
      return data.error?.status ? `${data.error.status}: ${message}` : message;
    }
  } catch {
    // Keep the concise fallback when Google returns a non-JSON body.
  }

  return fallback;
}

function readVideoLinks(service: AwsService, value: unknown): TutorialVideoLink[] {
  if (!Array.isArray(value)) {
    return getFallbackVideoLinks(service);
  }

  const links = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      return {
        title: readString(record.title, `${service.service_name} tutorial`),
        searchQuery: readString(record.searchQuery, `${service.service_name} AWS tutorial`),
        focus: readString(record.focus, "AWS learning video"),
      };
    })
    .filter(Boolean) as TutorialVideoLink[];

  return links.length ? links.slice(0, 3) : getFallbackVideoLinks(service);
}

function readStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const strings = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return strings.length ? strings.slice(0, 7) : fallback;
}

function buildFallbackUseCase(service: AwsService) {
  const category = service.category ?? "AWS";
  const summary = service.summary ?? `${service.service_name} supports ${category} workloads.`;

  return [
    `Use ${service.service_name} when an AWS architecture needs the capability described by this service: ${summary}`,
    service.use_case ??
      `In practice, teams would evaluate it for ${category.toLowerCase()} designs, operational workflows, and certification scenarios where managed AWS services reduce undifferentiated engineering work.`,
  ].join(" ");
}

function buildFallbackDetailedDocs(service: AwsService) {
  const summary = service.summary ?? `${service.service_name} is part of AWS ${service.category ?? "cloud"} services.`;
  const gotcha = service.gotcha
    ? `A key exam and production gotcha: ${service.gotcha}`
    : "Review access control, monitoring, service limits, regional behavior, integration points, and cost drivers before using it in production.";

  return [
    summary,
    `Exam focus: know when to choose ${service.service_name}, what responsibility it owns in an architecture, which adjacent AWS services it commonly integrates with, and what security or networking control changes the answer.`,
    gotcha,
    `Example question: A company needs the managed AWS option for the capability described by ${service.service_name} while reducing operational overhead. Which service should they evaluate first? Answer: ${service.service_name}, unless another service in the question more directly owns the stated requirement.`,
  ].join(" ");
}

export function createFallbackServiceEnrichment(service: AwsService): GeminiEnrichment {
  const fallbackLinks = getFallbackVideoLinks(service);

  return {
    schemaVersion: 2,
    serviceId: service.id,
    generatedAt: new Date().toISOString(),
    explanation:
      service.summary ??
      `${service.service_name} is an AWS service used in ${service.category ?? "cloud"} workloads.`,
    useCase: service.use_case ?? buildFallbackUseCase(service),
    detailedDocs: service.detailed_docs ?? buildFallbackDetailedDocs(service),
    engineeringContext:
      "Local fallback generated because Gemini did not return a usable response. Refresh AI can retry the cloud brief.",
    videoLinks: fallbackLinks,
    youtubeQueries: fallbackLinks.map((link) => link.searchQuery),
  };
}

function parseEnrichment(service: AwsService, text: string): GeminiEnrichment {
  const parsed = extractJson(text);

  if (!parsed) {
    return {
      ...createFallbackServiceEnrichment(service),
      explanation: text.trim(),
    };
  }

  const videoLinks = readVideoLinks(service, parsed.videoLinks ?? parsed.video_links);

  return {
    schemaVersion: 2,
    serviceId: service.id,
    generatedAt: new Date().toISOString(),
    explanation: readString(
      parsed.explanation,
      `${service.service_name} is an AWS service used in ${service.category ?? "cloud"} workloads.`,
    ),
    useCase: readString(
      parsed.useCase ?? parsed.use_case,
      service.use_case ?? buildFallbackUseCase(service),
    ),
    detailedDocs: readString(
      parsed.detailedDocs ?? parsed.detailed_docs,
      service.detailed_docs ?? buildFallbackDetailedDocs(service),
    ),
    engineeringContext: readString(
      parsed.engineeringContext,
      "Use this as a study companion, then verify implementation details against current AWS documentation before production work.",
    ),
    videoLinks,
    youtubeQueries: videoLinks.map((link) => link.searchQuery),
  };
}

function promptSearchQueries(service: AwsService) {
  return getFallbackVideoLinks(service).map((link) => link.searchQuery).join(" | ");
}

export async function generateServiceEnrichment(
  service: AwsService,
  apiKey: string,
): Promise<GeminiEnrichment> {
  const prompt = [
    "You are helping an AWS learner understand a service in plain English.",
    "Return JSON only. Do not wrap it in markdown.",
    "Avoid claiming real-time pricing, limits, or launch dates.",
    "Do not invent official certification guarantees.",
    "",
    `Service: ${service.service_name}`,
    `Category: ${service.category ?? "Uncategorized"}`,
    `Summary: ${service.summary ?? "No summary available"}`,
    `Use case: ${service.use_case ?? "No use case available"}`,
    `Gotcha: ${service.gotcha ?? "No gotcha available"}`,
    `Suggested search queries: ${promptSearchQueries(service)}`,
    "",
    "JSON schema:",
    "{",
    '  "explanation": "4-6 sentence plain-English explanation",',
    '  "useCase": "Practical real-world engineering use case, 3-5 sentences",',
    '  "detailedDocs": "Exam-focused notes with likely exam asks, decision points, integrations, security or operations gotchas, and one example multiple-choice question with answer. 6-10 sentences.",',
    '  "engineeringContext": "Short practical context for AWS engineers",',
    '  "videoLinks": [',
    '    { "title": "Video card title", "searchQuery": "YouTube search query for this service", "focus": "What the learner will get from this video" }',
    "  ]",
    "}",
    "Return exactly three videoLinks. They should be specific to this AWS service and useful for certification study.",
    'The detailedDocs value must include a line beginning "Example question:" and a line beginning "Answer:".',
  ].join("\n");

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.45,
          maxOutputTokens: 1350,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await readGeminiError(response, "Gemini enrichment is unavailable right now."));
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join("\n");

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  const enrichment = parseEnrichment(service, text);
  cacheEnrichment(enrichment);
  return enrichment;
}

export async function generateStudyBrief(
  input: StudyBriefInput,
  apiKey: string,
): Promise<StudyBriefCache> {
  const prompt = [
    "You are creating a practical AWS certification study brief for one learner.",
    "Return JSON only. Do not wrap it in markdown.",
    "Use only the provided local progress context. Do not claim official exam guarantees.",
    "",
    `Readiness score: ${input.readinessScore}`,
    `Best score: ${input.bestScore}`,
    `Latest score: ${input.latestScore}`,
    `Recent trend: ${input.recentTrend}`,
    `Weak categories: ${input.weakCategories.join(", ") || "None yet"}`,
    `Saved services: ${input.savedServices.join(", ") || "None yet"}`,
    `Review queue: ${input.reviewQueue.join(" | ") || "Empty"}`,
    `Recent scores: ${input.recentScores.join(", ") || "No completed exams yet"}`,
    "",
    "JSON schema:",
    "{",
    '  "summary": "3-4 sentence executive study brief",',
    '  "weeklyPlan": ["Five concise daily study actions"],',
    '  "focusAreas": ["Four categories or service areas to prioritize"],',
    '  "examTactics": ["Four practical exam tactics"]',
    "}",
  ].join("\n");

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 1100,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await readGeminiError(response, "Gemini study brief is unavailable right now."));
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join("\n");

  if (!text) {
    throw new Error("Gemini returned an empty study brief.");
  }

  const parsed = extractJson(text);
  const fallbackPlan = [
    "Review the weakest category and save two related services.",
    "Complete a 20-minute missed-question review.",
    "Read one service detail modal and queue any unclear concept.",
    "Repeat one timed exam section without answer feedback.",
    "Close the week by reviewing all queued items.",
  ];

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    summary: readString(
      parsed?.summary,
      "Study OS has enough local signal to guide the next review pass. Focus on weak categories first, then convert missed questions into review items before the next full timed exam.",
    ),
    weeklyPlan: readStringArray(parsed?.weeklyPlan ?? parsed?.weekly_plan, fallbackPlan),
    focusAreas: readStringArray(
      parsed?.focusAreas ?? parsed?.focus_areas,
      input.weakCategories.length ? input.weakCategories.slice(0, 4) : ["Full exam baseline", "Saved services", "Review queue"],
    ),
    examTactics: readStringArray(parsed?.examTactics ?? parsed?.exam_tactics, [
      "Eliminate distractors before choosing between close answers.",
      "Watch for managed-service wording and operational overhead clues.",
      "Treat regional, security, and integration details as decision pivots.",
      "Mark uncertain concepts for review instead of rereading everything.",
    ]),
  };
}
