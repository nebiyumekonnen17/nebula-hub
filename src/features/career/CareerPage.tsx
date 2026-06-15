import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  GraduationCap,
  Link as LinkIcon,
  ListPlus,
  MapPin,
  MessageSquareText,
  Pencil,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  UserRoundCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingSkeleton } from "../../components/feedback/LoadingSkeleton";
import { SetupState } from "../../components/feedback/SetupState";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import {
  searchAdzunaListings,
  type AdzunaListing,
  type AdzunaSearchResult,
} from "../../lib/career/adzuna";
import {
  applicationStatuses,
  createApplication,
  getRecommendedPromptCategories,
  interviewPrompts,
  jobBoards,
  readCareerState,
  targetRoles,
  workModes,
  writeCareerState,
  type CareerOsState,
  type InterviewCategory,
  type JobBoard,
  type JobApplication,
  type JobApplicationStatus,
  type JobSearchPreferences,
  type TargetRole,
  type WorkModePreference,
} from "../../lib/career/careerState";
import { readMissionHistory } from "../../lib/lab/architectureLab";
import { fetchServices } from "../../lib/supabase/queries";
import { useSupabase } from "../../lib/supabase/SupabaseProvider";
import type { AwsService } from "../../lib/supabase/types";
import {
  buildStudyInsights,
  readQuizStats,
  readReviewQueue,
  readSavedServiceIds,
  studyStateEvent,
} from "../../lib/study/studyState";
import { cn } from "../../lib/styles";

const featureImage =
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1500&q=80";

const emptyApplicationForm = {
  company: "",
  deadline: "",
  interviewDate: "",
  link: "",
  notes: "",
  status: "saved" as JobApplicationStatus,
  title: "",
};

type JobSearchCard = {
  id: string;
  role: TargetRole;
  headline: string;
  overview: string;
  commonTitles: string[];
  keywords: string[];
  skills: string[];
  interviewFocus: string[];
  resumeBullets: string[];
};

const jobSearchCards: JobSearchCard[] = [
  {
    id: "cloud-support-associate",
    role: "Cloud Support Associate",
    headline: "Support cloud customers, troubleshoot AWS services, and explain technical fixes clearly.",
    overview:
      "A strong entry point for AWS careers: this role rewards service fundamentals, clear troubleshooting, customer communication, and calm incident handling.",
    commonTitles: ["Cloud Support Associate", "AWS Support Associate", "Technical Support Engineer Cloud"],
    keywords: ["AWS", "Cloud Support", "EC2", "VPC", "IAM", "CloudWatch", "troubleshooting"],
    skills: ["EC2 connectivity", "VPC basics", "IAM permissions", "CloudWatch logs", "customer communication"],
    interviewFocus: ["Troubleshooting sequence", "Explaining AWS basics simply", "Security group vs NACL", "Incident communication"],
    resumeBullets: [
      "Demonstrated AWS troubleshooting workflows across EC2, VPC, IAM, and CloudWatch in a local-first study platform.",
      "Built interview-ready cloud support stories from timed exam review, service notes, and scenario missions.",
    ],
  },
  {
    id: "junior-cloud-engineer",
    role: "Junior Cloud Engineer",
    headline: "Build and operate cloud infrastructure with security, monitoring, and deployment discipline.",
    overview:
      "This path emphasizes hands-on architecture, infrastructure reasoning, deployment safety, and the ability to explain tradeoffs.",
    commonTitles: ["Junior Cloud Engineer", "Associate Cloud Engineer", "Cloud Infrastructure Engineer"],
    keywords: ["AWS", "Cloud Engineer", "VPC", "Lambda", "S3", "Terraform", "CI/CD"],
    skills: ["Architecture diagrams", "managed service choice", "deployment workflow", "monitoring", "least privilege"],
    interviewFocus: ["Design a web app on AWS", "Public/private subnet design", "Deployment rollback", "Cost-aware architecture"],
    resumeBullets: [
      "Designed AWS architecture blueprints and scenario missions that map requirements to secure service choices.",
      "Implemented a Vite React TypeScript dashboard with local persistence, GitHub Pages deployment readiness, and read-only Supabase integration.",
    ],
  },
  {
    id: "aws-cloud-practitioner",
    role: "AWS Cloud Practitioner",
    headline: "Show broad AWS literacy across services, billing, security, support, and shared responsibility.",
    overview:
      "Best for early cloud roles and certification-aligned interviews where broad understanding matters more than deep implementation.",
    commonTitles: ["AWS Cloud Practitioner", "Cloud Associate", "Cloud Operations Trainee"],
    keywords: ["AWS Cloud Practitioner", "AWS fundamentals", "cloud computing", "IAM", "S3", "EC2"],
    skills: ["shared responsibility", "service categories", "billing basics", "global infrastructure", "support plans"],
    interviewFocus: ["AWS value proposition", "shared responsibility", "service selection", "cost controls"],
    resumeBullets: [
      "Practiced AWS certification readiness through timed exams, category analytics, and targeted service review.",
      "Converted cloud fundamentals into role-specific interview answers and portfolio proof.",
    ],
  },
  {
    id: "soc-cloud-security",
    role: "SOC/Cloud Security Associate",
    headline: "Combine AWS security basics with monitoring, audit trails, access control, and incident response.",
    overview:
      "This role rewards IAM, logging, alerting, and investigation workflows, especially when paired with clear incident response stories.",
    commonTitles: ["Cloud Security Associate", "SOC Analyst Cloud", "Security Operations Associate"],
    keywords: ["AWS Security", "SOC", "IAM", "CloudTrail", "CloudWatch", "GuardDuty", "KMS"],
    skills: ["IAM least privilege", "CloudTrail audit", "CloudWatch alarms", "KMS encryption", "incident triage"],
    interviewFocus: ["S3 security", "IAM policy reduction", "API activity investigation", "alert triage"],
    resumeBullets: [
      "Practiced AWS security scenarios covering IAM, CloudTrail, CloudWatch, KMS, and incident response decision-making.",
      "Built local review workflows that turn missed security concepts into interview prep prompts.",
    ],
  },
  {
    id: "devops-intern",
    role: "DevOps Intern",
    headline: "Learn deployment automation, observability, cloud fundamentals, and operational discipline.",
    overview:
      "A practical path for showing build/test/deploy thinking, even before deep production experience.",
    commonTitles: ["DevOps Intern", "Cloud DevOps Intern", "Platform Engineering Intern"],
    keywords: ["DevOps Intern", "AWS", "CI/CD", "GitHub Actions", "Vite", "CloudWatch", "automation"],
    skills: ["Git workflows", "build validation", "static deployment", "environment variables", "monitoring basics"],
    interviewFocus: ["CI/CD pipeline", "failed deployment response", "environment secrets", "logs and metrics"],
    resumeBullets: [
      "Prepared a GitHub Pages-ready React application with production build validation and SPA routing considerations.",
      "Connected study progress, mission history, and local persistence into a cohesive cloud learning workflow.",
    ],
  },
  {
    id: "cloud-operations-associate",
    role: "Cloud Operations Associate",
    headline: "Monitor workloads, respond to incidents, maintain cloud hygiene, and keep systems reliable.",
    overview:
      "This role sits between support, operations, and junior engineering, with emphasis on reliability habits and triage.",
    commonTitles: ["Cloud Operations Associate", "Cloud Operations Analyst", "NOC Cloud Associate"],
    keywords: ["Cloud Operations", "AWS", "CloudWatch", "Systems Manager", "incident response", "monitoring"],
    skills: ["CloudWatch alarms", "runbooks", "Systems Manager", "operational dashboards", "post-incident review"],
    interviewFocus: ["First 30 minutes of an incident", "alarm quality", "runbook steps", "safe remediation"],
    resumeBullets: [
      "Built operational dashboards and readiness signals that connect AWS study progress to daily action plans.",
      "Practiced incident-response scenarios using Architecture Lab missions and local review queues.",
    ],
  },
];

function normalizeQueryPart(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function buildSearchQuery(card: JobSearchCard, preferences: JobSearchPreferences, weakCategories: string[]) {
  const mode = preferences.workMode === "Any" ? "" : preferences.workMode;
  const focus = weakCategories.slice(0, 2).join(" ");

  return normalizeQueryPart(
    [
      `"${card.role}"`,
      "AWS",
      mode,
      preferences.preferredLocation,
      card.keywords.slice(0, 4).join(" "),
      focus,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function getRoleCard(role: TargetRole) {
  return jobSearchCards.find((card) => card.role === role) ?? jobSearchCards[0];
}

function getAdzunaLocation(preferences: JobSearchPreferences) {
  const location = normalizeQueryPart(preferences.preferredLocation);
  const broadLocations = new Set(["", "any", "anywhere", "remote", "u.s.", "us", "usa", "united states"]);

  return broadLocations.has(location.toLowerCase()) ? "" : location;
}

function buildAdzunaQuery(role: TargetRole, preferences: JobSearchPreferences) {
  const card = getRoleCard(role);
  const mode = preferences.workMode === "Remote" ? "remote" : "";

  return normalizeQueryPart([role, "AWS", mode, card.keywords.slice(0, 2).join(" ")]
    .filter(Boolean)
    .join(" "));
}

function buildBroadAdzunaQuery(role: TargetRole, preferences: JobSearchPreferences) {
  const card = getRoleCard(role);
  const mode = preferences.workMode === "Remote" ? "remote" : "";
  const broadRole = role.includes("Security")
    ? "AWS security"
    : role.includes("DevOps")
      ? "AWS DevOps"
      : role.includes("Support")
        ? "AWS cloud support"
        : "AWS cloud";

  return normalizeQueryPart([broadRole, mode, card.keywords[0]].filter(Boolean).join(" "));
}

function getSearchUrl(board: JobBoard, query: string) {
  const encoded = encodeURIComponent(query);

  switch (board) {
    case "LinkedIn":
      return `https://www.linkedin.com/jobs/search/?keywords=${encoded}`;
    case "Indeed":
      return `https://www.indeed.com/jobs?q=${encoded}`;
    case "Dice":
      return `https://www.dice.com/jobs?q=${encoded}`;
    case "Google":
    default:
      return `https://www.google.com/search?q=${encoded}`;
  }
}

function formatDate(value: string) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatPostedDate(value: string) {
  if (!value) {
    return "Date not listed";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not listed";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatSalary(listing: Pick<AdzunaListing, "salaryMax" | "salaryMin">) {
  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "USD",
  });

  if (listing.salaryMin && listing.salaryMax) {
    return `${formatter.format(listing.salaryMin)} - ${formatter.format(listing.salaryMax)}`;
  }

  if (listing.salaryMin) {
    return `From ${formatter.format(listing.salaryMin)}`;
  }

  if (listing.salaryMax) {
    return `Up to ${formatter.format(listing.salaryMax)}`;
  }

  return "";
}

function percent(score: number, total: number) {
  return total ? Math.round((score / total) * 100) : 0;
}

function countApplicationsThisWeek(applications: JobApplication[]) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);

  return applications.filter((item) => {
    if (!["applied", "screen", "interview", "offer"].includes(item.status)) {
      return false;
    }

    const updated = new Date(item.updatedAt);
    return !Number.isNaN(updated.getTime()) && updated >= start;
  }).length;
}

export function CareerPage() {
  const { client, envStatus } = useSupabase();
  const navigate = useNavigate();
  const [services, setServices] = useState<AwsService[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(client));
  const [error, setError] = useState<string | null>(null);
  const [careerState, setCareerState] = useState(readCareerState);
  const [form, setForm] = useState(emptyApplicationForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quizStats, setQuizStats] = useState(readQuizStats);
  const [savedServiceIds, setSavedServiceIds] = useState(readSavedServiceIds);
  const [reviewQueue, setReviewQueue] = useState(readReviewQueue);
  const [missionHistory, setMissionHistory] = useState(readMissionHistory);
  const [adzunaResult, setAdzunaResult] = useState<AdzunaSearchResult | null>(null);
  const [adzunaError, setAdzunaError] = useState<string | null>(null);
  const [isAdzunaLoading, setIsAdzunaLoading] = useState(false);
  const [liveSearchRole, setLiveSearchRole] = useState<TargetRole>(
    careerState.targetRoles[0] ?? "Cloud Support Associate",
  );
  const [selectedJobCard, setSelectedJobCard] = useState<JobSearchCard | null>(null);
  const [selectedListing, setSelectedListing] = useState<AdzunaListing | null>(null);

  useEffect(() => {
    const refreshLocalState = () => {
      setCareerState(readCareerState());
      setQuizStats(readQuizStats());
      setSavedServiceIds(readSavedServiceIds());
      setReviewQueue(readReviewQueue());
      setMissionHistory(readMissionHistory());
    };

    window.addEventListener("nebula-hub:career-state", refreshLocalState);
    window.addEventListener(studyStateEvent, refreshLocalState);
    window.addEventListener("storage", refreshLocalState);
    return () => {
      window.removeEventListener("nebula-hub:career-state", refreshLocalState);
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
          setError(caught instanceof Error ? caught.message : "Career OS could not load service context.");
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

  const insights = useMemo(() => buildStudyInsights(quizStats), [quizStats]);
  const savedServices = useMemo(
    () =>
      savedServiceIds
        .map((id) => services.find((service) => service.id === id))
        .filter(Boolean) as AwsService[],
    [savedServiceIds, services],
  );
  const weeklyApplied = countApplicationsThisWeek(careerState.applications);
  const activeApplications = careerState.applications.filter((item) =>
    ["applied", "screen", "interview", "offer"].includes(item.status),
  );
  const interviewCount = careerState.applications.filter((item) =>
    ["screen", "interview", "offer"].includes(item.status),
  ).length;
  const proofCount = missionHistory.length + savedServices.length + quizStats.history.length;
  const interviewReadiness = Math.min(
    100,
    Math.round(
      insights.readinessScore * 0.42 +
        Math.min(24, missionHistory.length * 6) +
        Math.min(18, savedServices.length * 2) +
        Math.min(16, careerState.interviewNotes.length * 4),
    ),
  );
  const jobReadiness = Math.min(
    100,
    Math.round(
      interviewReadiness * 0.48 +
        Math.min(22, activeApplications.length * 4) +
        Math.min(18, weeklyApplied * 6) +
        Math.min(12, proofCount * 2),
    ),
  );
  const recommendedCategories = getRecommendedPromptCategories(careerState.targetRoles);
  const weakCategories = insights.weakCategories.map((item) => item.category);
  const recommendedPrompts = interviewPrompts
    .filter((prompt) => recommendedCategories.includes(prompt.category))
    .slice(0, 8);
  const roleCards = jobSearchCards.filter((card) => careerState.targetRoles.includes(card.role));
  const proofBullets = buildProofBullets({
    missionHistory,
    savedServices,
    quizStats,
    weakCategories,
  });

  const updateCareerState = (next: CareerOsState) => {
    setCareerState(next);
    writeCareerState(next);
  };

  const toggleTargetRole = (role: TargetRole) => {
    const nextRoles = careerState.targetRoles.includes(role)
      ? careerState.targetRoles.filter((item) => item !== role)
      : [...careerState.targetRoles, role];

    updateCareerState({
      ...careerState,
      targetRoles: nextRoles.length ? nextRoles : [role],
    });
  };

  const updateJobSearchPreferences = (preferences: JobSearchPreferences) => {
    updateCareerState({
      ...careerState,
      jobSearchPreferences: preferences,
    });
  };

  const toggleJobBoard = (board: JobBoard) => {
    const current = careerState.jobSearchPreferences.selectedBoards;
    const selectedBoards = current.includes(board)
      ? current.filter((item) => item !== board)
      : [...current, board];

    updateJobSearchPreferences({
      ...careerState.jobSearchPreferences,
      selectedBoards: selectedBoards.length ? selectedBoards : [board],
    });
  };

  const toggleSavedSearchCard = (cardId: string) => {
    const current = careerState.jobSearchPreferences.savedSearchCardIds;
    const savedSearchCardIds = current.includes(cardId)
      ? current.filter((item) => item !== cardId)
      : [cardId, ...current].slice(0, 24);

    updateJobSearchPreferences({
      ...careerState.jobSearchPreferences,
      savedSearchCardIds,
    });
  };

  const addSearchCardToTracker = (card: JobSearchCard) => {
    const query = buildSearchQuery(card, careerState.jobSearchPreferences, weakCategories);
    const primaryBoard = careerState.jobSearchPreferences.selectedBoards[0] ?? "Google";
    const nextApplication = createApplication({
      company: "Open search",
      deadline: "",
      interviewDate: "",
      link: getSearchUrl(primaryBoard, query),
      notes: [
        `Curated AWS job search for ${card.role}.`,
        `Search query: ${query}`,
        `Highlight skills: ${card.skills.slice(0, 4).join(", ")}.`,
      ].join("\n"),
      status: "saved",
      title: card.role,
    });

    updateCareerState({
      ...careerState,
      applications: [nextApplication, ...careerState.applications],
    });
  };

  const submitApplication = () => {
    if (!form.company.trim() || !form.title.trim()) {
      return;
    }

    const now = new Date().toISOString();
    const nextApplication = editingId
      ? {
          ...(careerState.applications.find((item) => item.id === editingId) as JobApplication),
          ...form,
          updatedAt: now,
        }
      : createApplication(form);
    const applications = editingId
      ? careerState.applications.map((item) => (item.id === editingId ? nextApplication : item))
      : [nextApplication, ...careerState.applications];

    updateCareerState({ ...careerState, applications });
    setForm(emptyApplicationForm);
    setEditingId(null);
  };

  const editApplication = (application: JobApplication) => {
    setEditingId(application.id);
    setForm({
      company: application.company,
      deadline: application.deadline,
      interviewDate: application.interviewDate,
      link: application.link,
      notes: application.notes,
      status: application.status,
      title: application.title,
    });
  };

  const removeApplication = (id: string) => {
    updateCareerState({
      ...careerState,
      applications: careerState.applications.filter((item) => item.id !== id),
    });
  };

  const updateApplicationStatus = (id: string, status: JobApplicationStatus) => {
    updateCareerState({
      ...careerState,
      applications: careerState.applications.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    });
  };

  const savePromptNote = (promptId: string, category: InterviewCategory, prompt: string, notes: string) => {
    const existing = careerState.interviewNotes.find((item) => item.id === promptId);
    const nextNote = {
      id: promptId,
      category,
      notes,
      prompt,
      updatedAt: new Date().toISOString(),
    };

    updateCareerState({
      ...careerState,
      interviewNotes: existing
        ? careerState.interviewNotes.map((item) => (item.id === promptId ? nextNote : item))
        : [nextNote, ...careerState.interviewNotes],
    });
  };

  const saveProofBullets = () => {
    updateCareerState({
      ...careerState,
      resumeBullets: proofBullets,
    });
  };

  const runAdzunaSearch = async ({ useCache = true }: { useCache?: boolean } = {}) => {
    const hasSecureProxy = Boolean(
      envStatus.env.adzunaProxyUrl && !envStatus.env.adzunaProxyUrl.startsWith("/adzuna-api"),
    );

    if (
      !envStatus.isAdzunaReady ||
      (!hasSecureProxy && (!envStatus.env.adzunaAppId || !envStatus.env.adzunaAppKey))
    ) {
      setAdzunaError(`Add ${envStatus.missingAdzunaKeys.join(" and ")} locally to load live Adzuna listings.`);
      return;
    }

    setIsAdzunaLoading(true);
    setAdzunaError(null);

    try {
      const focusedQuery = buildAdzunaQuery(liveSearchRole, careerState.jobSearchPreferences);
      const broadQuery = buildBroadAdzunaQuery(liveSearchRole, careerState.jobSearchPreferences);
      const searchLocation = getAdzunaLocation(careerState.jobSearchPreferences);
      const baseSearch = {
        appId: envStatus.env.adzunaAppId ?? "",
        appKey: envStatus.env.adzunaAppKey ?? "",
        country: envStatus.adzunaCountry,
        location: searchLocation,
        proxyUrl: envStatus.env.adzunaProxyUrl,
        role: liveSearchRole,
        useCache,
        workMode: careerState.jobSearchPreferences.workMode,
      };
      const result = await searchAdzunaListings({
        ...baseSearch,
        query: focusedQuery,
      });

      if (!result.listings.length && broadQuery !== focusedQuery) {
        setAdzunaResult(await searchAdzunaListings({
          ...baseSearch,
          query: broadQuery,
        }));
        return;
      }

      setAdzunaResult(result);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Adzuna listings are unavailable right now.";
      setAdzunaError(
        message === "Failed to fetch"
          ? "The browser could not reach Adzuna directly. Restart Vite so the local /adzuna-api proxy is active, or configure VITE_ADZUNA_PROXY_URL for a deployed serverless proxy."
          : message,
      );
    } finally {
      setIsAdzunaLoading(false);
    }
  };

  const addListingToTracker = (listing: AdzunaListing) => {
    const query = buildAdzunaQuery(liveSearchRole, careerState.jobSearchPreferences);
    const salary = formatSalary(listing);
    const nextApplication = createApplication({
      company: listing.company || "Unknown company",
      deadline: "",
      interviewDate: "",
      link: listing.redirectUrl,
      notes: [
        `Live Adzuna listing saved from Career OS.`,
        `Search role: ${liveSearchRole}.`,
        `Search query: ${query}`,
        `Location: ${listing.location}.`,
        salary ? `Salary: ${salary}.` : "",
        listing.description,
      ]
        .filter(Boolean)
        .join("\n"),
      status: "saved",
      title: listing.title,
    });

    updateCareerState({
      ...careerState,
      applications: [nextApplication, ...careerState.applications],
    });
  };

  if (!envStatus.isSupabaseReady) {
    return <SetupState missingKeys={envStatus.missingSupabaseKeys} />;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton className="h-80" />
        <div className="grid gap-4 lg:grid-cols-3">
          <LoadingSkeleton className="h-72" />
          <LoadingSkeleton className="h-72" />
          <LoadingSkeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        action={<Button onClick={() => window.location.reload()} variant="primary">Reload Career OS</Button>}
        message={error}
        title="Career OS needs attention"
      />
    );
  }

  return (
    <div className="space-y-6">
      <GlassPanel className="relative overflow-hidden p-5 md:p-7" glow="cyan">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 opacity-32 lg:block">
          <img alt="" className="h-full w-full object-cover" src={featureImage} />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/82 to-slate-950/25" />
        </div>
        <div className="relative grid gap-6 xl:grid-cols-[0.95fr_1.05fr] xl:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-100">
              <BriefcaseBusiness className="h-4 w-4" />
              Career OS
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl">
              Turn AWS practice into interview momentum.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Track applications, practice cloud interviews, and convert Nebula-Hub missions into resume-ready proof.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button icon={<MessageSquareText className="h-4 w-4" />} onClick={() => navigate("/quiz")} variant="primary">
                Practice exam
              </Button>
              <Button icon={<Target className="h-4 w-4" />} onClick={() => navigate("/study")}>
                Study weak areas
              </Button>
              <Button icon={<GraduationCap className="h-4 w-4" />} onClick={() => navigate("/lab?mission=secure-api")}>
                Run mission
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <CareerMetric accent="cyan" label="Job readiness" value={`${jobReadiness}%`} />
            <CareerMetric accent="teal" label="Interview readiness" value={`${interviewReadiness}%`} />
            <CareerMetric accent="amber" label="This week" value={`${weeklyApplied}/${careerState.weeklyApplicationGoal}`} />
            <CareerMetric accent="cyan" label="Portfolio proof" value={proofCount} />
          </div>
        </div>
      </GlassPanel>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <RoleAndReadinessPanel
          applications={careerState.applications}
          interviewCount={interviewCount}
          jobReadiness={jobReadiness}
          onToggleRole={toggleTargetRole}
          selectedRoles={careerState.targetRoles}
          weakCategories={weakCategories}
        />
      </section>

      <LiveListingsPanel
        adzunaCountry={envStatus.adzunaCountry}
        adzunaProxyUrl={envStatus.env.adzunaProxyUrl}
        error={adzunaError}
        isAdzunaReady={envStatus.isAdzunaReady}
        isLoading={isAdzunaLoading}
        listings={adzunaResult?.listings ?? []}
        missingKeys={envStatus.missingAdzunaKeys}
        onAddToTracker={addListingToTracker}
        onOpenListing={setSelectedListing}
        onPreferencesChange={updateJobSearchPreferences}
        onRefresh={() => void runAdzunaSearch({ useCache: false })}
        onSearch={() => void runAdzunaSearch()}
        onSelectedRoleChange={setLiveSearchRole}
        preferences={careerState.jobSearchPreferences}
        result={adzunaResult}
        selectedRole={liveSearchRole}
        weakCategories={weakCategories}
      />

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <JobSearchPanel
          onAddToTracker={addSearchCardToTracker}
          onOpenCard={setSelectedJobCard}
          onPreferencesChange={updateJobSearchPreferences}
          onToggleBoard={toggleJobBoard}
          onToggleSaved={toggleSavedSearchCard}
          preferences={careerState.jobSearchPreferences}
          roleCards={roleCards}
          weakCategories={weakCategories}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <ApplicationTracker
          applications={careerState.applications}
          editingId={editingId}
          form={form}
          onCancelEdit={() => {
            setEditingId(null);
            setForm(emptyApplicationForm);
          }}
          onEdit={editApplication}
          onFormChange={setForm}
          onRemove={removeApplication}
          onStatusChange={updateApplicationStatus}
          onSubmit={submitApplication}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <InterviewPrepPanel
          notes={careerState.interviewNotes}
          onSaveNote={savePromptNote}
          prompts={recommendedPrompts}
          roles={careerState.targetRoles}
        />
        <ProofBuilderPanel
          bullets={proofBullets}
          missionCount={missionHistory.length}
          onOpenLab={() => navigate("/lab")}
          onOpenWiki={() => navigate("/wiki")}
          onSave={saveProofBullets}
          savedBulletCount={careerState.resumeBullets.length}
          savedServiceCount={savedServices.length}
        />
      </section>

      <PipelinePanel applications={careerState.applications} reviewQueueCount={reviewQueue.length} />

      {selectedJobCard ? (
        <JobSearchModal
          card={selectedJobCard}
          isSaved={careerState.jobSearchPreferences.savedSearchCardIds.includes(selectedJobCard.id)}
          onAddToTracker={addSearchCardToTracker}
          onClose={() => setSelectedJobCard(null)}
          onToggleSaved={toggleSavedSearchCard}
          preferences={careerState.jobSearchPreferences}
          weakCategories={weakCategories}
        />
      ) : null}

      {selectedListing ? (
        <AdzunaListingModal
          listing={selectedListing}
          onAddToTracker={addListingToTracker}
          onClose={() => setSelectedListing(null)}
          preferences={careerState.jobSearchPreferences}
          role={liveSearchRole}
        />
      ) : null}
    </div>
  );
}

function buildProofBullets({
  missionHistory,
  quizStats,
  savedServices,
  weakCategories,
}: {
  missionHistory: ReturnType<typeof readMissionHistory>;
  quizStats: ReturnType<typeof readQuizStats>;
  savedServices: AwsService[];
  weakCategories: string[];
}) {
  const bullets = [
    `Built Nebula-Hub, a Vite React TypeScript AWS certification command center with read-only Supabase access, local progress tracking, and premium dashboard workflows.`,
  ];

  if (missionHistory.length) {
    const bestMission = Math.max(...missionHistory.map((item) => item.score));
    bullets.push(
      `Completed ${missionHistory.length} AWS architecture scenario mission${missionHistory.length === 1 ? "" : "s"} with a best design score of ${bestMission}%, translating requirements into secure cloud patterns.`,
    );
  }

  if (savedServices.length) {
    bullets.push(
      `Curated a focused AWS service review deck covering ${savedServices.slice(0, 5).map((service) => service.service_name).join(", ")} for interview and certification prep.`,
    );
  }

  if (quizStats.history.length) {
    const latest = quizStats.history[0];
    bullets.push(
      `Practiced timed AWS exam readiness with a latest score of ${percent(latest.score, latest.total)}% and tracked weak domains for targeted review.`,
    );
  }

  if (weakCategories.length) {
    bullets.push(
      `Used local analytics to identify and improve weak AWS domains including ${weakCategories.slice(0, 3).join(", ")}.`,
    );
  }

  bullets.push(
    "Designed local-first study workflows with application state stored in the browser, no database writes, and clear separation between public frontend keys and backend data.",
  );

  return bullets.slice(0, 6);
}

function CareerMetric({
  accent,
  label,
  value,
}: {
  accent: "amber" | "cyan" | "teal";
  label: string;
  value: string | number;
}) {
  const accentClass = {
    amber: "text-amber-100 shadow-[0_0_32px_rgba(245,158,11,0.12)]",
    cyan: "text-cyan-100 shadow-[0_0_32px_rgba(34,211,238,0.14)]",
    teal: "text-teal-100 shadow-[0_0_32px_rgba(20,184,166,0.14)]",
  }[accent];

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/[0.055] p-4", accentClass)}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

function RoleAndReadinessPanel({
  applications,
  interviewCount,
  jobReadiness,
  onToggleRole,
  selectedRoles,
  weakCategories,
}: {
  applications: JobApplication[];
  interviewCount: number;
  jobReadiness: number;
  onToggleRole: (role: TargetRole) => void;
  selectedRoles: TargetRole[];
  weakCategories: string[];
}) {
  return (
    <GlassPanel className="p-5" glow="teal">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Target roles
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Search strategy</h2>
        </div>
        <UserRoundCheck className="h-6 w-6 text-teal-200" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {targetRoles.map((role) => {
          const selected = selectedRoles.includes(role);

          return (
            <button
              className={cn(
                "min-h-14 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
                selected
                  ? "border-cyan-200/45 bg-cyan-200/14 text-cyan-50"
                  : "border-white/10 bg-white/[0.045] text-slate-300 hover:border-white/20 hover:bg-white/[0.075]",
              )}
              key={role}
              onClick={() => onToggleRole(role)}
              type="button"
            >
              {role}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MiniStat label="Readiness" value={`${jobReadiness}%`} />
        <MiniStat label="Active jobs" value={applications.filter((item) => item.status !== "rejected").length} />
        <MiniStat label="Interviews" value={interviewCount} />
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Prep focus
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(weakCategories.length ? weakCategories : ["AWS fundamentals", "security/IAM", "architecture scenarios"]).slice(0, 5).map((category) => (
            <span
              className="rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs font-semibold text-amber-100"
              key={category}
            >
              {category}
            </span>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}

function LiveListingsPanel({
  adzunaCountry,
  adzunaProxyUrl,
  error,
  isAdzunaReady,
  isLoading,
  listings,
  missingKeys,
  onAddToTracker,
  onOpenListing,
  onPreferencesChange,
  onRefresh,
  onSearch,
  onSelectedRoleChange,
  preferences,
  result,
  selectedRole,
  weakCategories,
}: {
  adzunaCountry: string;
  adzunaProxyUrl?: string;
  error: string | null;
  isAdzunaReady: boolean;
  isLoading: boolean;
  listings: AdzunaListing[];
  missingKeys: string[];
  onAddToTracker: (listing: AdzunaListing) => void;
  onOpenListing: (listing: AdzunaListing) => void;
  onPreferencesChange: (preferences: JobSearchPreferences) => void;
  onRefresh: () => void;
  onSearch: () => void;
  onSelectedRoleChange: (role: TargetRole) => void;
  preferences: JobSearchPreferences;
  result: AdzunaSearchResult | null;
  selectedRole: TargetRole;
  weakCategories: string[];
}) {
  const query = buildAdzunaQuery(selectedRole, preferences);
  const broadQuery = buildBroadAdzunaQuery(selectedRole, preferences);
  const searchLocation = getAdzunaLocation(preferences) || "All United States";

  return (
    <GlassPanel className="overflow-hidden p-5 md:p-6" glow="teal">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/25 bg-teal-200/10 px-3 py-2 text-xs font-semibold text-teal-100">
            <BriefcaseBusiness className="h-4 w-4" />
            Live AWS listings
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-white">Fresh job ads from Adzuna</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Pull real AWS-related listings on demand, cache them locally, and save promising roles into your tracker.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/24 p-4 text-sm leading-6 text-slate-400 xl:max-w-sm">
          <p>
            Country: <span className="font-semibold uppercase text-cyan-100">{adzunaCountry}</span>
          </p>
          <p>
            Location: <span className="font-semibold text-cyan-100">{searchLocation}</span>
          </p>
          <p>
            Cache: <span className="font-semibold text-teal-100">30 minutes per search</span>
          </p>
        <p>
          Source:{" "}
          <a
              className="font-semibold text-cyan-100 underline-offset-4 hover:underline"
              href="https://www.adzuna.com"
              rel="noreferrer"
              target="_blank"
            >
            Jobs by Adzuna
          </a>
        </p>
        <p>
          Proxy:{" "}
          <span className="font-semibold text-teal-100">
            {adzunaProxyUrl ? (import.meta.env.DEV ? "Local Vite" : "Configured endpoint") : "Direct browser"}
          </span>
        </p>
      </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_0.9fr_0.65fr]">
        <label className="grid gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Role</span>
          <select
            className="min-h-11 rounded-xl border border-white/10 bg-slate-950/80 px-3 font-semibold text-white outline-none focus:border-cyan-200/45"
            onChange={(event) => onSelectedRoleChange(event.target.value as TargetRole)}
            value={selectedRole}
          >
            {targetRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <CareerInput
          label="Search location"
          onChange={(preferredLocation) =>
            onPreferencesChange({
              ...preferences,
              preferredLocation,
            })
          }
          value={preferences.preferredLocation}
        />
        <label className="grid gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Work mode</span>
          <select
            className="min-h-11 rounded-xl border border-white/10 bg-slate-950/80 px-3 font-semibold text-white outline-none focus:border-cyan-200/45"
            onChange={(event) =>
              onPreferencesChange({
                ...preferences,
                workMode: event.target.value as WorkModePreference,
              })
            }
            value={preferences.workMode}
          >
            {workModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/24 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Adzuna query</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-cyan-50">{query}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          If this exact search is empty, Career OS automatically retries: {broadQuery}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button disabled={!isAdzunaReady || isLoading} icon={<Search className="h-4 w-4" />} onClick={onSearch} variant="primary">
          Find live jobs
        </Button>
        <Button disabled={!isAdzunaReady || isLoading || !result} icon={<RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />} onClick={onRefresh}>
          Refresh results
        </Button>
      </div>

      {!isAdzunaReady ? (
        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
          Add {missingKeys.join(" and ")} to your local `.env` to load live Adzuna listings. Smart search cards still work without keys.
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm leading-6 text-rose-100">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          <span>{result.count.toLocaleString()} matching ads reported</span>
          <span className="rounded-full border border-teal-200/20 bg-teal-200/10 px-3 py-1 text-teal-100">
            {result.fromCache ? "Cached locally" : "Fresh from Adzuna"}
          </span>
          <span>Updated {formatPostedDate(result.cachedAt)}</span>
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <LoadingSkeleton className="h-64" />
          <LoadingSkeleton className="h-64" />
        </div>
      ) : null}

      {!isLoading && result && !listings.length ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.045] p-5 text-sm leading-6 text-slate-400">
          No Adzuna listings came back after the focused search and broader AWS fallback. Try a city like Atlanta or Dallas, switch work mode to Any, or use the smart search cards below.
        </div>
      ) : null}

      {!isLoading && listings.length ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {listings.map((listing, index) => (
            <AdzunaListingCard
              index={index}
              key={listing.id}
              listing={listing}
              onAddToTracker={onAddToTracker}
              onOpen={onOpenListing}
            />
          ))}
        </div>
      ) : null}
    </GlassPanel>
  );
}

function AdzunaListingCard({
  index,
  listing,
  onAddToTracker,
  onOpen,
}: {
  index: number;
  listing: AdzunaListing;
  onAddToTracker: (listing: AdzunaListing) => void;
  onOpen: (listing: AdzunaListing) => void;
}) {
  const salary = formatSalary(listing);

  return (
    <motion.article
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] transition hover:-translate-y-1 hover:border-teal-200/30 hover:bg-white/[0.075]"
      initial={{ opacity: 0, y: 14 }}
      transition={{ delay: Math.min(index * 0.04, 0.22) }}
    >
      <button className="w-full p-5 text-left" onClick={() => onOpen(listing)} type="button">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="line-clamp-2 text-xl font-semibold leading-7 text-white">{listing.title}</p>
            <p className="mt-2 text-sm font-semibold text-cyan-100">{listing.company}</p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-semibold text-slate-300">
            {formatPostedDate(listing.created)}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-xs font-semibold text-amber-100">
            {listing.location}
          </span>
          {salary ? (
            <span className="rounded-full border border-teal-200/20 bg-teal-200/10 px-3 py-1 text-xs font-semibold text-teal-100">
              {salary}
            </span>
          ) : null}
          {listing.contractTime ? (
            <span className="rounded-full border border-cyan-200/15 bg-cyan-200/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              {listing.contractTime}
            </span>
          ) : null}
        </div>

        <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-400">{listing.description}</p>
      </button>

      <div className="flex flex-wrap gap-2 border-t border-white/10 p-4">
        <a
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-cyan-200/30 bg-cyan-200/10 px-3 text-sm font-semibold text-cyan-50 transition hover:border-cyan-100/60 hover:bg-cyan-200/16"
          href={listing.redirectUrl}
          rel="noreferrer"
          target="_blank"
        >
          Open listing
          <ExternalLink className="h-4 w-4" />
        </a>
        <Button icon={<ListPlus className="h-4 w-4" />} onClick={() => onAddToTracker(listing)} variant="ghost">
          Add to Tracker
        </Button>
      </div>
    </motion.article>
  );
}

function JobSearchPanel({
  onAddToTracker,
  onOpenCard,
  onPreferencesChange,
  onToggleBoard,
  onToggleSaved,
  preferences,
  roleCards,
  weakCategories,
}: {
  onAddToTracker: (card: JobSearchCard) => void;
  onOpenCard: (card: JobSearchCard) => void;
  onPreferencesChange: (preferences: JobSearchPreferences) => void;
  onToggleBoard: (board: JobBoard) => void;
  onToggleSaved: (cardId: string) => void;
  preferences: JobSearchPreferences;
  roleCards: JobSearchCard[];
  weakCategories: string[];
}) {
  return (
    <GlassPanel className="p-5" glow="cyan">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            AWS job search
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Smart search launchpad</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Curated search cards open targeted job searches. They are not scraped live listings.
          </p>
        </div>
        <Search className="h-6 w-6 text-cyan-200" />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_0.7fr]">
        <CareerInput
          label="Preferred location"
          onChange={(preferredLocation) =>
            onPreferencesChange({
              ...preferences,
              preferredLocation,
            })
          }
          value={preferences.preferredLocation}
        />
        <label className="grid gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Work mode</span>
          <select
            className="min-h-11 rounded-xl border border-white/10 bg-slate-950/80 px-3 font-semibold text-white outline-none focus:border-cyan-200/45"
            onChange={(event) =>
              onPreferencesChange({
                ...preferences,
                workMode: event.target.value as WorkModePreference,
              })
            }
            value={preferences.workMode}
          >
            {workModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {jobBoards.map((board) => {
          const selected = preferences.selectedBoards.includes(board);

          return (
            <button
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition",
                selected
                  ? "border-cyan-200/35 bg-cyan-200/14 text-cyan-50"
                  : "border-white/10 bg-white/[0.045] text-slate-400 hover:border-white/20 hover:text-white",
              )}
              key={board}
              onClick={() => onToggleBoard(board)}
              type="button"
            >
              <ExternalLink className="h-4 w-4" />
              {board}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {roleCards.map((card, index) => (
          <JobSearchCardView
            card={card}
            index={index}
            isSaved={preferences.savedSearchCardIds.includes(card.id)}
            key={card.id}
            onAddToTracker={onAddToTracker}
            onOpen={onOpenCard}
            onToggleSaved={onToggleSaved}
            preferences={preferences}
            weakCategories={weakCategories}
          />
        ))}
      </div>
    </GlassPanel>
  );
}

function JobSearchCardView({
  card,
  index,
  isSaved,
  onAddToTracker,
  onOpen,
  onToggleSaved,
  preferences,
  weakCategories,
}: {
  card: JobSearchCard;
  index: number;
  isSaved: boolean;
  onAddToTracker: (card: JobSearchCard) => void;
  onOpen: (card: JobSearchCard) => void;
  onToggleSaved: (cardId: string) => void;
  preferences: JobSearchPreferences;
  weakCategories: string[];
}) {
  const query = buildSearchQuery(card, preferences, weakCategories);
  const primaryBoards = preferences.selectedBoards.slice(0, 3);

  return (
    <motion.article
      animate={{ opacity: 1, y: 0 }}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] transition hover:-translate-y-1 hover:border-cyan-200/30 hover:bg-white/[0.075]"
      initial={{ opacity: 0, y: 12 }}
      transition={{ delay: Math.min(index * 0.04, 0.2) }}
    >
      <button className="w-full p-4 text-left" onClick={() => onOpen(card)} type="button">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold leading-6 text-white">{card.role}</p>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{card.headline}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-1 text-xs font-semibold",
              isSaved
                ? "border-teal-200/25 bg-teal-200/10 text-teal-100"
                : "border-white/10 bg-black/20 text-slate-300",
            )}
          >
            {isSaved ? "Saved" : "Search"}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {card.keywords.slice(0, 4).map((keyword) => (
            <span
              className="rounded-full border border-cyan-200/15 bg-cyan-200/10 px-3 py-1 text-xs font-semibold text-cyan-100"
              key={keyword}
            >
              {keyword}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <MapPin className="h-4 w-4 text-amber-200" />
          {preferences.workMode} / {preferences.preferredLocation}
        </div>
      </button>
      <div className="border-t border-white/10 p-4">
        <div className="flex flex-wrap gap-2">
          {primaryBoards.map((board) => (
            <a
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 text-xs font-semibold text-slate-300 transition hover:border-cyan-200/30 hover:text-cyan-100"
              href={getSearchUrl(board, query)}
              key={board}
              rel="noreferrer"
              target="_blank"
            >
              {board}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
          <Button className="min-h-9 px-3 text-xs" onClick={() => onAddToTracker(card)} variant="ghost">
            Add to Tracker
          </Button>
          <Button className="min-h-9 px-3 text-xs" onClick={() => onToggleSaved(card.id)} variant="ghost">
            {isSaved ? "Unsave" : "Save"}
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

function ApplicationTracker({
  applications,
  editingId,
  form,
  onCancelEdit,
  onEdit,
  onFormChange,
  onRemove,
  onStatusChange,
  onSubmit,
}: {
  applications: JobApplication[];
  editingId: string | null;
  form: typeof emptyApplicationForm;
  onCancelEdit: () => void;
  onEdit: (application: JobApplication) => void;
  onFormChange: (form: typeof emptyApplicationForm) => void;
  onRemove: (id: string) => void;
  onStatusChange: (id: string, status: JobApplicationStatus) => void;
  onSubmit: () => void;
}) {
  return (
    <GlassPanel className="p-5" glow="cyan">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Application tracker
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Job pipeline</h2>
        </div>
        <BriefcaseBusiness className="h-6 w-6 text-cyan-200" />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <CareerInput label="Company" onChange={(company) => onFormChange({ ...form, company })} value={form.company} />
        <CareerInput label="Role title" onChange={(title) => onFormChange({ ...form, title })} value={form.title} />
        <CareerInput label="Job link" onChange={(link) => onFormChange({ ...form, link })} value={form.link} />
        <label className="grid gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</span>
          <select
            className="min-h-11 rounded-xl border border-white/10 bg-slate-950/80 px-3 font-semibold text-white outline-none focus:border-cyan-200/45"
            onChange={(event) => onFormChange({ ...form, status: event.target.value as JobApplicationStatus })}
            value={form.status}
          >
            {applicationStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <CareerInput label="Deadline" onChange={(deadline) => onFormChange({ ...form, deadline })} type="date" value={form.deadline} />
        <CareerInput label="Interview date" onChange={(interviewDate) => onFormChange({ ...form, interviewDate })} type="date" value={form.interviewDate} />
        <label className="grid gap-2 text-sm md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Notes</span>
          <textarea
            className="min-h-24 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 font-medium leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/45"
            onChange={(event) => onFormChange({ ...form, notes: event.target.value })}
            placeholder="Recruiter name, next step, salary range, contacts..."
            value={form.notes}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button icon={<ListPlus className="h-4 w-4" />} onClick={onSubmit} variant="primary">
          {editingId ? "Update job" : "Add job"}
        </Button>
        {editingId ? (
          <Button onClick={onCancelEdit} variant="ghost">
            Cancel edit
          </Button>
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        {applications.length ? (
          applications.slice(0, 8).map((application) => (
            <ApplicationCard
              application={application}
              key={application.id}
              onEdit={onEdit}
              onRemove={onRemove}
              onStatusChange={onStatusChange}
            />
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-white/12 bg-black/20 p-4 text-sm leading-6 text-slate-400">
            Add target roles as you find them. Career OS will track status, dates, and prep notes locally.
          </p>
        )}
      </div>
    </GlassPanel>
  );
}

function ApplicationCard({
  application,
  onEdit,
  onRemove,
  onStatusChange,
}: {
  application: JobApplication;
  onEdit: (application: JobApplication) => void;
  onRemove: (id: string) => void;
  onStatusChange: (id: string, status: JobApplicationStatus) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{application.title}</p>
          <p className="mt-1 text-sm text-slate-400">{application.company}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-9 rounded-xl border border-white/10 bg-slate-950/80 px-2 text-xs font-semibold text-white outline-none"
            onChange={(event) => onStatusChange(application.id, event.target.value as JobApplicationStatus)}
            value={application.status}
          >
            {applicationStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button
            aria-label={`Edit ${application.title}`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-slate-300 transition hover:border-cyan-200/30 hover:text-cyan-100"
            onClick={() => onEdit(application)}
            type="button"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            aria-label={`Remove ${application.title}`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-slate-300 transition hover:border-rose-200/30 hover:text-rose-100"
            onClick={() => onRemove(application.id)}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
          Deadline {formatDate(application.deadline)}
        </span>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
          Interview {formatDate(application.interviewDate)}
        </span>
        {application.link ? (
          <a
            className="inline-flex items-center gap-1 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 font-semibold text-cyan-100"
            href={application.link}
            rel="noreferrer"
            target="_blank"
          >
            Link <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
      {application.notes ? (
        <p className="mt-3 text-sm leading-6 text-slate-400">{application.notes}</p>
      ) : null}
    </div>
  );
}

function InterviewPrepPanel({
  notes,
  onSaveNote,
  prompts,
  roles,
}: {
  notes: CareerOsState["interviewNotes"];
  onSaveNote: (promptId: string, category: InterviewCategory, prompt: string, notes: string) => void;
  prompts: typeof interviewPrompts;
  roles: TargetRole[];
}) {
  return (
    <GlassPanel className="p-5" glow="teal">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Interview prep
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Role-aligned question bank</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Prioritized for {roles.join(", ")}.
          </p>
        </div>
        <MessageSquareText className="h-6 w-6 text-teal-200" />
      </div>

      <div className="mt-5 space-y-4">
        {prompts.map((prompt, index) => {
          const savedNote = notes.find((item) => item.id === prompt.id);

          return (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
              initial={{ opacity: 0, y: 10 }}
              key={prompt.id}
              transition={{ delay: Math.min(index * 0.03, 0.18) }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                  {prompt.category}
                </span>
                {savedNote ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-teal-200/20 bg-teal-200/10 px-3 py-1 text-xs font-semibold text-teal-100">
                    <CheckCircle2 className="h-3 w-3" />
                    Notes saved
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-base font-semibold leading-7 text-white">{prompt.prompt}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{prompt.signal}</p>
              <PromptNoteBox
                defaultValue={savedNote?.notes ?? ""}
                onSave={(value) => onSaveNote(prompt.id, prompt.category, prompt.prompt, value)}
              />
            </motion.div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

function PromptNoteBox({
  defaultValue,
  onSave,
}: {
  defaultValue: string;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  return (
    <div className="mt-3 grid gap-3">
      <textarea
        className="min-h-20 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/40"
        onChange={(event) => setValue(event.target.value)}
        placeholder="Draft your answer using STAR, architecture tradeoffs, or troubleshooting steps..."
        value={value}
      />
      <div>
        <Button icon={<FileText className="h-4 w-4" />} onClick={() => onSave(value)} variant="ghost">
          Save notes
        </Button>
      </div>
    </div>
  );
}

function ProofBuilderPanel({
  bullets,
  missionCount,
  onOpenLab,
  onOpenWiki,
  onSave,
  savedBulletCount,
  savedServiceCount,
}: {
  bullets: string[];
  missionCount: number;
  onOpenLab: () => void;
  onOpenWiki: () => void;
  onSave: () => void;
  savedBulletCount: number;
  savedServiceCount: number;
}) {
  return (
    <GlassPanel className="p-5" glow="amber">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Proof builder
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Resume and LinkedIn bullets</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Generated locally from missions, saved services, and exam progress.
          </p>
        </div>
        <Button icon={<BadgeCheck className="h-4 w-4" />} onClick={onSave} variant="primary">
          Save bullets
        </Button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Missions" value={missionCount} />
        <MiniStat label="Saved services" value={savedServiceCount} />
        <MiniStat label="Saved bullets" value={savedBulletCount} />
      </div>

      <div className="mt-5 space-y-3">
        {bullets.map((bullet) => (
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm leading-7 text-slate-300" key={bullet}>
            {bullet}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button icon={<GraduationCap className="h-4 w-4" />} onClick={onOpenLab}>
          Add mission proof
        </Button>
        <Button icon={<LinkIcon className="h-4 w-4" />} onClick={onOpenWiki}>
          Save more services
        </Button>
      </div>
    </GlassPanel>
  );
}

function PipelinePanel({
  applications,
  reviewQueueCount,
}: {
  applications: JobApplication[];
  reviewQueueCount: number;
}) {
  const counts = applicationStatuses.map((status) => ({
    count: applications.filter((item) => item.status === status).length,
    status,
  }));

  return (
    <GlassPanel className="p-5" glow="cyan">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Execution board
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Search operating rhythm</h2>
        </div>
        <TrendingUp className="h-6 w-6 text-cyan-200" />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-6">
        {counts.map((item) => (
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4" key={item.status}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.status}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{item.count}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <ExecutionCard
          icon={<ClipboardList className="h-5 w-5 text-cyan-200" />}
          text="Apply to a focused set of roles, then spend equal time practicing the interview stories behind your projects."
          title="Weekly balance"
        />
        <ExecutionCard
          icon={<CalendarClock className="h-5 w-5 text-amber-200" />}
          text="Keep deadlines and interview dates visible so prep is tied to real next steps, not vague motivation."
          title="Date awareness"
        />
        <ExecutionCard
          icon={<MessageSquareText className="h-5 w-5 text-teal-200" />}
          text={`${reviewQueueCount} Study OS review item${reviewQueueCount === 1 ? "" : "s"} can become interview talking points.`}
          title="Study to story"
        />
      </div>
    </GlassPanel>
  );
}

function AdzunaListingModal({
  listing,
  onAddToTracker,
  onClose,
  preferences,
  role,
}: {
  listing: AdzunaListing;
  onAddToTracker: (listing: AdzunaListing) => void;
  onClose: () => void;
  preferences: JobSearchPreferences;
  role: TargetRole;
}) {
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

  const card = getRoleCard(role);
  const salary = formatSalary(listing);
  const query = buildAdzunaQuery(role, preferences);

  return createPortal(
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/78 p-4 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      onMouseDown={onClose}
    >
      <motion.article
        animate={{ opacity: 1, y: 0, scale: 1 }}
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-white/12 bg-[#07101d]/95 shadow-[0_40px_120px_rgba(0,0,0,0.65)]"
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        transition={{ duration: 0.22 }}
      >
        <div className="service-visual relative min-h-48 border-b border-white/10 p-5 md:p-7">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-transparent" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <span className="rounded-full border border-teal-200/25 bg-teal-200/10 px-3 py-2 text-xs font-semibold text-teal-100">
                Live Adzuna listing
              </span>
              <h2 className="mt-5 max-w-4xl text-3xl font-semibold leading-tight text-white md:text-5xl">
                {listing.title}
              </h2>
              <p className="mt-3 text-sm font-semibold text-cyan-100">{listing.company}</p>
            </div>
            <button
              aria-label="Close live listing detail"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-slate-300 transition hover:border-cyan-200/30 hover:text-cyan-100"
              onClick={onClose}
              type="button"
            >
              x
            </button>
          </div>
        </div>

        <div className="max-h-[calc(92vh-12rem)] overflow-y-auto p-5 md:p-7">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-5">
              <DetailPanel icon={<BriefcaseBusiness className="h-4 w-4 text-cyan-200" />} title="Listing snapshot">
                <p className="text-sm leading-7 text-slate-300">{listing.description}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MiniStat label="Location" value={listing.location} />
                  <MiniStat label="Posted" value={formatPostedDate(listing.created)} />
                  <MiniStat label="Salary" value={salary || "Not listed"} />
                  <MiniStat label="Category" value={listing.category ?? "Not listed"} />
                </div>
              </DetailPanel>

              <DetailPanel icon={<Search className="h-4 w-4 text-teal-200" />} title="Search context">
                <p className="rounded-xl border border-white/10 bg-black/24 p-3 text-sm font-semibold leading-6 text-cyan-50">
                  {query}
                </p>
              </DetailPanel>

              <DetailPanel icon={<ShieldCheck className="h-4 w-4 text-amber-200" />} title="How to tailor your story">
                <div className="space-y-3 text-sm leading-6 text-slate-300">
                  <p>{card.overview}</p>
                  <p>
                    Lead with Nebula-Hub proof that matches this role: timed AWS exam practice, architecture missions,
                    service review notes, and local-first product discipline.
                  </p>
                </div>
              </DetailPanel>
            </div>

            <aside className="space-y-5">
              <DetailPanel icon={<Sparkles className="h-4 w-4 text-cyan-200" />} title="Skills to highlight">
                <TagList items={card.skills} />
              </DetailPanel>

              <DetailPanel icon={<MessageSquareText className="h-4 w-4 text-teal-200" />} title="Interview focus">
                <ul className="space-y-2">
                  {card.interviewFocus.map((item) => (
                    <li className="text-sm leading-6 text-slate-300" key={item}>
                      - {item}
                    </li>
                  ))}
                </ul>
              </DetailPanel>

              <DetailPanel icon={<FileText className="h-4 w-4 text-amber-200" />} title="Resume angle">
                <div className="space-y-3">
                  {card.resumeBullets.map((bullet) => (
                    <p className="rounded-xl border border-white/10 bg-black/24 p-3 text-sm leading-6 text-slate-300" key={bullet}>
                      {bullet}
                    </p>
                  ))}
                </div>
              </DetailPanel>

              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
                <div className="grid gap-3">
                  <a
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-cyan-300/45 bg-cyan-300/15 px-4 py-2 text-sm font-semibold text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,0.18)] transition hover:border-cyan-200 hover:bg-cyan-300/22"
                    href={listing.redirectUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open listing
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <Button
                    className="justify-start"
                    icon={<ListPlus className="h-4 w-4" />}
                    onClick={() => onAddToTracker(listing)}
                  >
                    Add to Tracker
                  </Button>
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-500">
                  Listing snippets are provided by Adzuna. Full job details open externally through the listing link.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </motion.article>
    </motion.div>,
    document.body,
  );
}

function JobSearchModal({
  card,
  isSaved,
  onAddToTracker,
  onClose,
  onToggleSaved,
  preferences,
  weakCategories,
}: {
  card: JobSearchCard;
  isSaved: boolean;
  onAddToTracker: (card: JobSearchCard) => void;
  onClose: () => void;
  onToggleSaved: (cardId: string) => void;
  preferences: JobSearchPreferences;
  weakCategories: string[];
}) {
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

  const query = buildSearchQuery(card, preferences, weakCategories);

  return createPortal(
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/78 p-4 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      onMouseDown={onClose}
    >
      <motion.article
        animate={{ opacity: 1, y: 0, scale: 1 }}
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-white/12 bg-[#07101d]/95 shadow-[0_40px_120px_rgba(0,0,0,0.65)]"
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        transition={{ duration: 0.22 }}
      >
        <div className="service-visual relative min-h-44 border-b border-white/10 p-5 md:p-7">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/88 via-slate-950/58 to-transparent" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <span className="rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                Curated AWS search
              </span>
              <h2 className="mt-5 text-3xl font-semibold leading-tight text-white md:text-5xl">
                {card.role}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{card.headline}</p>
            </div>
            <button
              aria-label="Close job search detail"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-slate-300 transition hover:border-cyan-200/30 hover:text-cyan-100"
              onClick={onClose}
              type="button"
            >
              x
            </button>
          </div>
        </div>

        <div className="max-h-[calc(92vh-11rem)] overflow-y-auto p-5 md:p-7">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-5">
              <DetailPanel icon={<BriefcaseBusiness className="h-4 w-4 text-cyan-200" />} title="Role overview">
                <p className="text-sm leading-7 text-slate-300">{card.overview}</p>
              </DetailPanel>

              <DetailPanel icon={<Search className="h-4 w-4 text-teal-200" />} title="Search query">
                <p className="rounded-xl border border-white/10 bg-black/24 p-3 text-sm font-semibold leading-6 text-cyan-50">
                  {query}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {preferences.selectedBoards.map((board) => (
                    <a
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.055] px-3 text-sm font-semibold text-slate-300 transition hover:border-cyan-200/30 hover:text-cyan-100"
                      href={getSearchUrl(board, query)}
                      key={board}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open {board}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </DetailPanel>

              <DetailPanel icon={<ShieldCheck className="h-4 w-4 text-amber-200" />} title="AWS skills to highlight">
                <TagList items={card.skills} />
              </DetailPanel>

              <DetailPanel icon={<MessageSquareText className="h-4 w-4 text-teal-200" />} title="Interview prep focus">
                <ul className="space-y-2">
                  {card.interviewFocus.map((item) => (
                    <li className="text-sm leading-6 text-slate-300" key={item}>
                      - {item}
                    </li>
                  ))}
                </ul>
              </DetailPanel>
            </div>

            <aside className="space-y-5">
              <DetailPanel icon={<Sparkles className="h-4 w-4 text-cyan-200" />} title="Common titles">
                <TagList items={card.commonTitles} />
              </DetailPanel>

              <DetailPanel icon={<FileText className="h-4 w-4 text-amber-200" />} title="Resume bullets">
                <div className="space-y-3">
                  {card.resumeBullets.map((bullet) => (
                    <p className="rounded-xl border border-white/10 bg-black/24 p-3 text-sm leading-6 text-slate-300" key={bullet}>
                      {bullet}
                    </p>
                  ))}
                </div>
              </DetailPanel>

              <DetailPanel icon={<MapPin className="h-4 w-4 text-teal-200" />} title="Search settings">
                <div className="space-y-3 text-sm leading-6 text-slate-300">
                  <p>Location: {preferences.preferredLocation}</p>
                  <p>Mode: {preferences.workMode}</p>
                  <p>Boards: {preferences.selectedBoards.join(", ")}</p>
                </div>
              </DetailPanel>

              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
                <div className="grid gap-3">
                  <Button
                    className="justify-start"
                    icon={<ListPlus className="h-4 w-4" />}
                    onClick={() => onAddToTracker(card)}
                    variant="primary"
                  >
                    Add to Tracker
                  </Button>
                  <Button
                    className="justify-start"
                    icon={<BadgeCheck className="h-4 w-4" />}
                    onClick={() => onToggleSaved(card.id)}
                  >
                    {isSaved ? "Saved search card" : "Save search card"}
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </motion.article>
    </motion.div>,
    document.body,
  );
}

function DetailPanel({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          className="rounded-full border border-cyan-200/15 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-100"
          key={item}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function ExecutionCard({ icon, text, title }: { icon: ReactNode; text: string; title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        {icon}
        {title}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
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

function CareerInput({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <input
        className="min-h-11 rounded-xl border border-white/10 bg-slate-950/80 px-3 font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/45"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}
