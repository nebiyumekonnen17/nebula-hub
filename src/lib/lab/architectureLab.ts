import type { AwsService } from "../supabase/types";
import { readLocalValue, writeLocalValue } from "../storage/local";

export type BlueprintNode = {
  id: string;
  label: string;
  detail: string;
  zone: "entry" | "core" | "protected";
};

export type BlueprintSpec = {
  schemaVersion: 1;
  id: string;
  title: string;
  subtitle: string;
  category: string;
  workflow: string[];
  nodes: BlueprintNode[];
  examChecks: string[];
  keyNotes: string[];
  trafficPath: string[];
  generatedAt: string;
  source: "local" | "gemini";
};

export type ArchitectureScenario = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  services: string[];
  focus: string;
  difficulty: "Foundational" | "Intermediate" | "Advanced";
};

export type MissionQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  dimension: MissionScoreDimension;
  explanation: string;
};

export type MissionScoreDimension =
  | "service selection"
  | "security"
  | "reliability"
  | "cost awareness"
  | "exam reasoning";

export type ScenarioMission = {
  id: string;
  title: string;
  category: string;
  difficulty: "Foundational" | "Intermediate" | "Advanced";
  estimatedMinutes: number;
  readinessFocus: string;
  prompt: string;
  recommendedServices: string[];
  serviceOptions: string[];
  scenarioId: string;
  questions: MissionQuestion[];
};

export type MissionResult = {
  missionId: string;
  missionTitle: string;
  completedAt: string;
  score: number;
  selectedServices: string[];
  correctServices: string[];
  missedServices: string[];
  missedQuestions: Array<{
    id: string;
    prompt: string;
    correctAnswer: string;
    explanation: string;
    dimension: MissionScoreDimension;
  }>;
  dimensions: Record<MissionScoreDimension, number>;
};

export const blueprintCacheKey = "nebula-hub:architecture-lab:blueprints:v1";
export const missionHistoryKey = "nebula-hub:scenario-missions:history:v1";
export const blueprintAiCooldownKey = "nebula-hub:architecture-lab:ai-cooldown:v1";
const blueprintModel = "gemini-2.5-flash-lite";
const blueprintTimeoutMs = 14_000;

export class GeminiQuotaCooldownError extends Error {
  retrySeconds: number;

  constructor(message: string, retrySeconds: number) {
    super(message);
    this.name = "GeminiQuotaCooldownError";
    this.retrySeconds = retrySeconds;
  }
}

export const architectureScenarios: ArchitectureScenario[] = [
  {
    id: "public-web-app",
    title: "Public Web App",
    subtitle: "Secure request path for internet-facing workloads",
    category: "Networking",
    services: ["Route 53", "CloudFront", "Application Load Balancer", "EC2", "RDS"],
    focus: "Public entry, private persistence, monitoring, and blast-radius control.",
    difficulty: "Foundational",
  },
  {
    id: "private-subnet-workload",
    title: "Private Subnet Workload",
    subtitle: "Controlled outbound access without direct internet exposure",
    category: "Security",
    services: ["VPC", "Private Subnet", "NAT Gateway", "Security Groups", "CloudWatch"],
    focus: "Subnet isolation, routing, least privilege, and operational visibility.",
    difficulty: "Intermediate",
  },
  {
    id: "serverless-api",
    title: "Serverless API",
    subtitle: "Low-ops API pattern with managed compute",
    category: "Serverless",
    services: ["API Gateway", "Lambda", "DynamoDB", "IAM", "CloudWatch"],
    focus: "Managed scaling, authorization, retry behavior, and observability.",
    difficulty: "Foundational",
  },
  {
    id: "data-pipeline",
    title: "Data Pipeline",
    subtitle: "Event-driven ingestion and analytics workflow",
    category: "Analytics",
    services: ["S3", "Kinesis", "Glue", "Athena", "CloudWatch"],
    focus: "Durable ingestion, transformation, querying, and failure handling.",
    difficulty: "Advanced",
  },
  {
    id: "incident-response",
    title: "Monitoring Response",
    subtitle: "Detect, alert, investigate, and recover",
    category: "Operations",
    services: ["CloudWatch", "CloudTrail", "SNS", "Systems Manager", "IAM"],
    focus: "Signals, audit trail, notification path, and controlled remediation.",
    difficulty: "Intermediate",
  },
  {
    id: "secure-storage",
    title: "Secure Storage Pattern",
    subtitle: "Encrypted object storage with controlled access",
    category: "Storage",
    services: ["S3", "KMS", "IAM", "CloudTrail", "VPC Endpoint"],
    focus: "Encryption, access policy, auditability, and private connectivity.",
    difficulty: "Foundational",
  },
];

export const scenarioMissions: ScenarioMission[] = [
  {
    id: "secure-api",
    title: "Secure Customer API",
    category: "Serverless",
    difficulty: "Intermediate",
    estimatedMinutes: 12,
    readinessFocus: "API Gateway, Lambda, IAM, DynamoDB",
    scenarioId: "serverless-api",
    prompt:
      "A startup needs a public HTTPS API for mobile clients. Traffic is unpredictable, the team wants minimal server management, and every request must be logged. Customer records need single-digit millisecond access by key.",
    recommendedServices: ["API Gateway", "Lambda", "DynamoDB", "IAM", "CloudWatch"],
    serviceOptions: ["API Gateway", "Lambda", "DynamoDB", "IAM", "CloudWatch", "EC2", "RDS", "Route 53"],
    questions: [
      {
        id: "secure-api-q1",
        prompt: "Which entry service best fits a managed public HTTPS API?",
        options: ["Application Load Balancer", "API Gateway", "NAT Gateway", "CloudFront only"],
        correctIndex: 1,
        dimension: "service selection",
        explanation: "API Gateway is the managed front door for REST/HTTP APIs and integrates directly with Lambda.",
      },
      {
        id: "secure-api-q2",
        prompt: "What should control Lambda permissions to DynamoDB?",
        options: ["A public bucket policy", "A route table", "An IAM execution role", "A CloudFront origin policy"],
        correctIndex: 2,
        dimension: "security",
        explanation: "Lambda uses an execution role; least-privilege IAM controls access to DynamoDB.",
      },
      {
        id: "secure-api-q3",
        prompt: "Why is DynamoDB a strong match for key-based customer lookups?",
        options: ["It requires server patching", "It is object storage", "It provides managed low-latency key-value access", "It replaces IAM"],
        correctIndex: 2,
        dimension: "exam reasoning",
        explanation: "The prompt emphasizes managed operations and single-digit millisecond access by key.",
      },
      {
        id: "secure-api-q4",
        prompt: "Which service gives operational logs and metrics for the API and function path?",
        options: ["CloudWatch", "KMS", "Route 53", "VPC Peering"],
        correctIndex: 0,
        dimension: "reliability",
        explanation: "CloudWatch captures metrics, logs, alarms, and operational signals.",
      },
    ],
  },
  {
    id: "private-compute",
    title: "Private Processing Tier",
    category: "Networking",
    difficulty: "Intermediate",
    estimatedMinutes: 10,
    readinessFocus: "VPC routing, NAT, private subnet, security groups",
    scenarioId: "private-subnet-workload",
    prompt:
      "A company runs worker instances that must download patches from the internet but must never receive inbound internet traffic. The design must keep compute resources in private subnets.",
    recommendedServices: ["VPC", "Private Subnet", "NAT Gateway", "Security Groups", "CloudWatch"],
    serviceOptions: ["VPC", "Private Subnet", "NAT Gateway", "Security Groups", "CloudWatch", "Internet Gateway", "S3", "API Gateway"],
    questions: [
      {
        id: "private-compute-q1",
        prompt: "What enables outbound internet access from private subnets?",
        options: ["NAT Gateway", "Direct inbound route", "Public IP on every instance", "CloudTrail"],
        correctIndex: 0,
        dimension: "service selection",
        explanation: "NAT Gateway allows private subnet resources to initiate outbound internet connections.",
      },
      {
        id: "private-compute-q2",
        prompt: "Which resource should not be attached directly to private instances for this requirement?",
        options: ["Security group", "IAM role", "Public IPv4 address", "CloudWatch agent"],
        correctIndex: 2,
        dimension: "security",
        explanation: "A public IP would make the instance directly reachable if routing/security allows it.",
      },
      {
        id: "private-compute-q3",
        prompt: "Where should the default route from the private subnet point for internet-bound traffic?",
        options: ["Internet Gateway directly", "NAT Gateway in a public subnet", "A random security group", "CloudWatch Logs"],
        correctIndex: 1,
        dimension: "exam reasoning",
        explanation: "The NAT Gateway lives in a public subnet and receives the private subnet default route.",
      },
    ],
  },
  {
    id: "secure-storage-audit",
    title: "Audited Secure Storage",
    category: "Storage",
    difficulty: "Foundational",
    estimatedMinutes: 9,
    readinessFocus: "S3, KMS, IAM, CloudTrail",
    scenarioId: "secure-storage",
    prompt:
      "A finance team stores quarterly reports in object storage. They need encryption, restricted access, private access from a VPC, and an audit trail of API activity.",
    recommendedServices: ["S3", "KMS", "IAM", "CloudTrail", "VPC Endpoint"],
    serviceOptions: ["S3", "KMS", "IAM", "CloudTrail", "VPC Endpoint", "Lambda", "RDS", "NAT Gateway"],
    questions: [
      {
        id: "secure-storage-q1",
        prompt: "Which service provides object storage for the reports?",
        options: ["S3", "RDS", "Lambda", "SNS"],
        correctIndex: 0,
        dimension: "service selection",
        explanation: "S3 is AWS object storage and is the direct match for report files.",
      },
      {
        id: "secure-storage-q2",
        prompt: "Which service should manage customer-controlled encryption keys?",
        options: ["CloudWatch", "KMS", "Route 53", "API Gateway"],
        correctIndex: 1,
        dimension: "security",
        explanation: "KMS manages cryptographic keys used by many AWS services, including S3.",
      },
      {
        id: "secure-storage-q3",
        prompt: "Which service records AWS API activity for audit investigation?",
        options: ["CloudTrail", "NAT Gateway", "DynamoDB", "Elastic Beanstalk"],
        correctIndex: 0,
        dimension: "exam reasoning",
        explanation: "CloudTrail records account activity and API calls.",
      },
    ],
  },
  {
    id: "data-lake-ingest",
    title: "Streaming Data Lake",
    category: "Analytics",
    difficulty: "Advanced",
    estimatedMinutes: 14,
    readinessFocus: "Kinesis, S3, Glue, Athena",
    scenarioId: "data-pipeline",
    prompt:
      "An operations team receives a continuous event stream from thousands of devices. They need durable landing storage, cataloged datasets, and serverless querying for analysts.",
    recommendedServices: ["Kinesis", "S3", "Glue", "Athena", "CloudWatch"],
    serviceOptions: ["Kinesis", "S3", "Glue", "Athena", "CloudWatch", "EC2", "EBS", "Route 53"],
    questions: [
      {
        id: "data-lake-q1",
        prompt: "Which service is best suited to ingest the continuous event stream?",
        options: ["Kinesis", "Route 53", "IAM", "EBS"],
        correctIndex: 0,
        dimension: "service selection",
        explanation: "Kinesis is designed for streaming data ingestion and processing.",
      },
      {
        id: "data-lake-q2",
        prompt: "What gives analysts SQL-style serverless queries against data in S3?",
        options: ["Athena", "Security Groups", "NAT Gateway", "CloudFront"],
        correctIndex: 0,
        dimension: "cost awareness",
        explanation: "Athena queries data in S3 without managing database servers.",
      },
      {
        id: "data-lake-q3",
        prompt: "What should catalog transformed datasets for discovery?",
        options: ["Glue Data Catalog", "Internet Gateway", "CloudTrail only", "API Gateway"],
        correctIndex: 0,
        dimension: "exam reasoning",
        explanation: "Glue Data Catalog stores metadata used by analytics services like Athena.",
      },
    ],
  },
  {
    id: "incident-runbook",
    title: "Incident Signal Runbook",
    category: "Operations",
    difficulty: "Intermediate",
    estimatedMinutes: 11,
    readinessFocus: "CloudWatch, SNS, CloudTrail, Systems Manager",
    scenarioId: "incident-response",
    prompt:
      "A platform team needs to detect high error rates, notify responders, inspect account activity, and run approved remediation commands on managed instances.",
    recommendedServices: ["CloudWatch", "SNS", "CloudTrail", "Systems Manager", "IAM"],
    serviceOptions: ["CloudWatch", "SNS", "CloudTrail", "Systems Manager", "IAM", "S3 Glacier", "Route 53", "Kinesis"],
    questions: [
      {
        id: "incident-q1",
        prompt: "Which service should trigger alarms from metrics?",
        options: ["CloudWatch", "S3", "KMS", "VPC Endpoint"],
        correctIndex: 0,
        dimension: "reliability",
        explanation: "CloudWatch alarms evaluate metrics and trigger notifications/actions.",
      },
      {
        id: "incident-q2",
        prompt: "Which service distributes notifications to responders?",
        options: ["SNS", "EBS", "Glue", "NAT Gateway"],
        correctIndex: 0,
        dimension: "service selection",
        explanation: "SNS is commonly used for pub/sub notifications and alarm fan-out.",
      },
      {
        id: "incident-q3",
        prompt: "Which service can run controlled commands on managed instances?",
        options: ["Systems Manager", "Route 53", "CloudFront", "Athena"],
        correctIndex: 0,
        dimension: "security",
        explanation: "Systems Manager supports controlled operations through permissions and managed instance setup.",
      },
    ],
  },
  {
    id: "global-web-edge",
    title: "Global Web Edge",
    category: "Networking",
    difficulty: "Foundational",
    estimatedMinutes: 8,
    readinessFocus: "CloudFront, Route 53, ALB, EC2",
    scenarioId: "public-web-app",
    prompt:
      "A media site needs low-latency global content delivery, DNS routing, and a protected regional origin behind a load balancer.",
    recommendedServices: ["Route 53", "CloudFront", "Application Load Balancer", "EC2", "CloudWatch"],
    serviceOptions: ["Route 53", "CloudFront", "Application Load Balancer", "EC2", "CloudWatch", "KMS", "Glue", "DynamoDB"],
    questions: [
      {
        id: "global-web-q1",
        prompt: "Which service provides the global edge cache?",
        options: ["CloudFront", "RDS", "NAT Gateway", "CloudTrail"],
        correctIndex: 0,
        dimension: "service selection",
        explanation: "CloudFront is AWS's CDN and edge distribution service.",
      },
      {
        id: "global-web-q2",
        prompt: "Which service handles DNS routing to the site?",
        options: ["Route 53", "KMS", "EBS", "SNS"],
        correctIndex: 0,
        dimension: "exam reasoning",
        explanation: "Route 53 is AWS DNS and routing.",
      },
      {
        id: "global-web-q3",
        prompt: "Which component distributes requests across regional compute targets?",
        options: ["Application Load Balancer", "Athena", "CloudTrail", "Glue"],
        correctIndex: 0,
        dimension: "reliability",
        explanation: "An ALB routes HTTP/S traffic across targets and supports health checks.",
      },
    ],
  },
];

export function readBlueprintCache() {
  return readLocalValue<Record<string, BlueprintSpec>>(blueprintCacheKey, {});
}

export function writeBlueprintCache(cache: Record<string, BlueprintSpec>) {
  writeLocalValue(blueprintCacheKey, cache);
}

export function readMissionHistory() {
  return readLocalValue<MissionResult[]>(missionHistoryKey, []);
}

export function writeMissionHistory(history: MissionResult[]) {
  writeLocalValue(missionHistoryKey, history.slice(0, 40));
  window.dispatchEvent(new Event("nebula-hub:study-state"));
}

export function getScenarioById(id: string | null) {
  return architectureScenarios.find((scenario) => scenario.id === id) ?? architectureScenarios[0];
}

export function getMissionById(id: string | null) {
  return scenarioMissions.find((mission) => mission.id === id) ?? scenarioMissions[0];
}

export function createScenarioBlueprint(scenario: ArchitectureScenario): BlueprintSpec {
  const [entry, core, protectedNode] = scenario.services;

  return {
    schemaVersion: 1,
    id: `scenario:${scenario.id}`,
    title: scenario.title,
    subtitle: scenario.subtitle,
    category: scenario.category,
    generatedAt: new Date().toISOString(),
    source: "local",
    workflow: [
      "Read the business requirement",
      "Identify the public entry point",
      "Place compute in the correct network zone",
      "Choose the managed data or integration service",
      "Apply least-privilege access",
      "Add logging and metrics",
      "Confirm encryption and private paths",
      "Check cost and scaling assumptions",
      "Validate failure behavior",
      "Translate the pattern into exam clues",
    ],
    nodes: [
      {
        id: "entry",
        label: entry ?? "Client entry",
        detail: "First AWS decision point for the request or event path.",
        zone: "entry",
      },
      {
        id: "core",
        label: core ?? scenario.title,
        detail: scenario.focus,
        zone: "core",
      },
      {
        id: "protected",
        label: protectedNode ?? "Protected workload",
        detail: "Private, monitored, and controlled service boundary.",
        zone: "protected",
      },
    ],
    trafficPath: scenario.services.slice(0, 5),
    examChecks: [
      "Does the service directly own the requirement?",
      "Is the workload public, private, or managed serverless?",
      "Which security control changes the correct answer?",
      "What removes operational overhead?",
      "What failure path must be observed?",
    ],
    keyNotes: [
      scenario.focus,
      `Watch for ${scenario.category.toLowerCase()} wording and managed-service clues.`,
      `Core services: ${scenario.services.join(", ")}.`,
    ],
  };
}

export function createServiceBlueprint(service: AwsService): BlueprintSpec {
  const shortName = service.service_name.replace(/^Amazon\s+|^AWS\s+/i, "");
  const category = service.category ?? "AWS";
  const summary =
    service.summary ?? `${service.service_name} supports ${category.toLowerCase()} workloads in AWS.`;

  return {
    schemaVersion: 1,
    id: `service:${service.id}`,
    title: `How to use ${shortName}`,
    subtitle: `Beginner-friendly ${category} blueprint`,
    category,
    generatedAt: new Date().toISOString(),
    source: "local",
    workflow: [
      "Identify the workload requirement",
      `Choose ${shortName} for the matching capability`,
      "Confirm public, private, or managed access",
      "Attach identity and least-privilege permissions",
      "Map the network and routing path",
      "Add logs, metrics, and alarms",
      "Review encryption and security boundaries",
      "Validate service limits and cost drivers",
      "Test the failure and recovery path",
      "Save the exam gotcha",
    ],
    nodes: [
      {
        id: "entry",
        label: "Requirement signal",
        detail: "The user, app, event, or exam clue that starts the decision.",
        zone: "entry",
      },
      {
        id: "core",
        label: shortName,
        detail: summary,
        zone: "core",
      },
      {
        id: "protected",
        label: "Secure outcome",
        detail: service.use_case ?? "Managed AWS capability with monitoring, access control, and operational guardrails.",
        zone: "protected",
      },
    ],
    trafficPath: ["Requirement", shortName, "Integrated service", "Observed result"],
    examChecks: [
      `When should ${shortName} be chosen over adjacent services?`,
      "What IAM, network, or encryption control is required?",
      "Which integration clue appears in the question?",
      "What operational overhead is reduced?",
      service.gotcha ?? "What gotcha changes the answer?",
    ],
    keyNotes: [
      summary,
      service.gotcha ?? "Check IAM, networking, regional behavior, monitoring, quotas, and cost.",
      `Category: ${category}.`,
    ],
  };
}

function readStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const next = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  return next.length ? next.slice(0, 10) : fallback;
}

function parseBlueprintSpec(
  id: string,
  fallback: BlueprintSpec,
  value: unknown,
): BlueprintSpec {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  return {
    ...fallback,
    id,
    title: typeof record.title === "string" && record.title.trim() ? record.title.trim() : fallback.title,
    subtitle:
      typeof record.subtitle === "string" && record.subtitle.trim()
        ? record.subtitle.trim()
        : fallback.subtitle,
    workflow: readStringArray(record.workflow, fallback.workflow),
    examChecks: readStringArray(record.examChecks ?? record.exam_checks, fallback.examChecks),
    keyNotes: readStringArray(record.keyNotes ?? record.key_notes, fallback.keyNotes),
    trafficPath: readStringArray(record.trafficPath ?? record.traffic_path, fallback.trafficPath),
    generatedAt: new Date().toISOString(),
    source: "gemini",
  };
}

function createBlueprintFromText(id: string, fallback: BlueprintSpec, text: string): BlueprintSpec {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*#\d.\s]+/, "").trim())
    .filter(Boolean);

  if (!lines.length) {
    return {
      ...fallback,
      generatedAt: new Date().toISOString(),
    };
  }

  return {
    ...fallback,
    id,
    workflow: [...lines.slice(0, 10), ...fallback.workflow].slice(0, 10),
    examChecks: [...lines.slice(10, 15), ...fallback.examChecks].slice(0, 5),
    keyNotes: [...lines.slice(15, 18), ...fallback.keyNotes].slice(0, 3),
    generatedAt: new Date().toISOString(),
    source: "gemini",
  };
}

function extractJson(text: string) {
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

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), blueprintTimeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
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
    // Keep the user-facing fallback when Google returns a non-JSON error body.
  }

  return fallback;
}

function readRetrySeconds(message: string) {
  const match = message.match(/retry in\s+([0-9.]+)s/i);
  return match ? Math.ceil(Number(match[1])) : 45;
}

function collectText(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectText(item));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const directText = typeof record.text === "string" ? [record.text] : [];
  return [
    ...directText,
    ...collectText(record.parts),
    ...collectText(record.content),
    ...collectText(record.candidates),
  ];
}

export async function generateBlueprintSpec(
  fallback: BlueprintSpec,
  apiKey: string,
): Promise<BlueprintSpec> {
  const prompt = [
    "You are creating concise text for an AWS architecture blueprint poster.",
    "Return JSON only. Do not include markdown.",
    "Do not generate an image. Nebula-Hub will draw the diagram locally.",
    "Avoid exact pricing, launch dates, or certification guarantees.",
    "",
    `Blueprint title: ${fallback.title}`,
    `Category: ${fallback.category}`,
    `Subtitle: ${fallback.subtitle}`,
    `Current nodes: ${fallback.nodes.map((node) => `${node.label}: ${node.detail}`).join(" | ")}`,
    "",
    "JSON schema:",
    "{",
    '  "title": "Short blueprint title",',
    '  "subtitle": "Short blueprint subtitle",',
    '  "workflow": ["Exactly 10 beginner workflow steps"],',
    '  "trafficPath": ["3-5 short path labels"],',
    '  "examChecks": ["Exactly 5 certification-style checks"],',
    '  "keyNotes": ["Exactly 3 beginner notes"]',
    "}",
  ].join("\n");

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${blueprintModel}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 950,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const message = await readGeminiError(response, "Blueprint AI is unavailable right now.");

    if (response.status === 429 || message.includes("RESOURCE_EXHAUSTED")) {
      throw new GeminiQuotaCooldownError(message, readRetrySeconds(message));
    }

    throw new Error(message);
  }

  const data = await response.json();
  const text = collectText(data)
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");
  const parsed = text ? extractJson(text) : null;

  const spec = parsed
    ? parseBlueprintSpec(fallback.id, fallback, parsed)
    : createBlueprintFromText(fallback.id, fallback, text);
  const cache = readBlueprintCache();
  writeBlueprintCache({ ...cache, [spec.id]: spec });
  return spec;
}

export function scoreMission(
  mission: ScenarioMission,
  selectedServices: string[],
  answers: Record<string, number>,
): MissionResult {
  const selected = new Set(selectedServices);
  const correct = new Set(mission.recommendedServices);
  const correctServices = mission.recommendedServices.filter((service) => selected.has(service));
  const missedServices = mission.recommendedServices.filter((service) => !selected.has(service));
  const extraServices = selectedServices.filter((service) => !correct.has(service));
  const serviceScore = Math.max(
    0,
    Math.round(((correctServices.length - extraServices.length * 0.45) / mission.recommendedServices.length) * 100),
  );
  const missedQuestions = mission.questions
    .filter((question) => answers[question.id] !== question.correctIndex)
    .map((question) => ({
      id: question.id,
      prompt: question.prompt,
      correctAnswer: question.options[question.correctIndex] ?? "Correct answer unavailable",
      explanation: question.explanation,
      dimension: question.dimension,
    }));
  const questionScore = mission.questions.length
    ? Math.round(((mission.questions.length - missedQuestions.length) / mission.questions.length) * 100)
    : 0;
  const dimensions = {
    "service selection": serviceScore,
    security: questionScore,
    reliability: questionScore,
    "cost awareness": questionScore,
    "exam reasoning": questionScore,
  };

  for (const question of mission.questions) {
    const isCorrect = answers[question.id] === question.correctIndex;
    dimensions[question.dimension] = Math.round((dimensions[question.dimension] + (isCorrect ? 100 : 0)) / 2);
  }

  return {
    missionId: mission.id,
    missionTitle: mission.title,
    completedAt: new Date().toISOString(),
    score: Math.round(serviceScore * 0.45 + questionScore * 0.55),
    selectedServices,
    correctServices,
    missedServices,
    missedQuestions,
    dimensions,
  };
}
