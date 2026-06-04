import { readLocalValue, writeLocalValue } from "../storage/local";

export type JobApplicationStatus =
  | "saved"
  | "applied"
  | "screen"
  | "interview"
  | "offer"
  | "rejected";

export type TargetRole =
  | "Cloud Support Associate"
  | "Junior Cloud Engineer"
  | "AWS Cloud Practitioner"
  | "SOC/Cloud Security Associate"
  | "DevOps Intern"
  | "Cloud Operations Associate";

export type JobBoard = "Google" | "LinkedIn" | "Indeed" | "Dice";

export type WorkModePreference = "Remote" | "Hybrid" | "On-site" | "Any";

export type JobSearchPreferences = {
  preferredLocation: string;
  workMode: WorkModePreference;
  selectedBoards: JobBoard[];
  savedSearchCardIds: string[];
};

export type JobApplication = {
  id: string;
  company: string;
  title: string;
  link: string;
  status: JobApplicationStatus;
  notes: string;
  deadline: string;
  interviewDate: string;
  createdAt: string;
  updatedAt: string;
};

export type InterviewNote = {
  id: string;
  prompt: string;
  category: InterviewCategory;
  notes: string;
  updatedAt: string;
};

export type CareerOsState = {
  schemaVersion: 1;
  targetRoles: TargetRole[];
  weeklyApplicationGoal: number;
  applications: JobApplication[];
  interviewNotes: InterviewNote[];
  resumeBullets: string[];
  jobSearchPreferences: JobSearchPreferences;
};

export type InterviewCategory =
  | "AWS fundamentals"
  | "architecture scenarios"
  | "troubleshooting"
  | "security/IAM"
  | "behavioral STAR stories"
  | "resume/project walkthrough";

export type InterviewPrompt = {
  id: string;
  category: InterviewCategory;
  prompt: string;
  signal: string;
};

export const careerOsKey = "nebula-hub:career-os:v1";
export const careerStateEvent = "nebula-hub:career-state";

export const targetRoles: TargetRole[] = [
  "Cloud Support Associate",
  "Junior Cloud Engineer",
  "AWS Cloud Practitioner",
  "SOC/Cloud Security Associate",
  "DevOps Intern",
  "Cloud Operations Associate",
];

export const jobBoards: JobBoard[] = ["Google", "LinkedIn", "Indeed", "Dice"];

export const workModes: WorkModePreference[] = ["Remote", "Hybrid", "On-site", "Any"];

export const applicationStatuses: JobApplicationStatus[] = [
  "saved",
  "applied",
  "screen",
  "interview",
  "offer",
  "rejected",
];

export const interviewPrompts: InterviewPrompt[] = [
  {
    id: "aws-shared-responsibility",
    category: "AWS fundamentals",
    prompt: "Explain the AWS shared responsibility model to a non-technical manager.",
    signal: "Clear ownership split between AWS and the customer.",
  },
  {
    id: "aws-high-availability",
    category: "architecture scenarios",
    prompt: "Design a highly available public web application on AWS and explain each layer.",
    signal: "Multi-AZ, load balancing, private data tier, monitoring, and security controls.",
  },
  {
    id: "aws-ec2-no-connect",
    category: "troubleshooting",
    prompt: "An EC2 instance in a public subnet cannot be reached over SSH. How do you investigate?",
    signal: "Security group, NACL, route table, IGW, public IP, key pair, and instance status checks.",
  },
  {
    id: "aws-iam-least-privilege",
    category: "security/IAM",
    prompt: "How would you reduce permissions for an application that currently uses AdministratorAccess?",
    signal: "CloudTrail evidence, least privilege policy, role boundaries, and staged validation.",
  },
  {
    id: "star-pressure",
    category: "behavioral STAR stories",
    prompt: "Tell me about a time you solved a difficult technical problem under pressure.",
    signal: "Situation, task, action, result, and measurable learning.",
  },
  {
    id: "project-walkthrough",
    category: "resume/project walkthrough",
    prompt: "Walk me through Nebula-Hub as if I am a hiring manager for a cloud role.",
    signal: "Problem, architecture, security, local-first decisions, UI polish, and outcomes.",
  },
  {
    id: "aws-cost",
    category: "AWS fundamentals",
    prompt: "What AWS design choices help control cost while preserving reliability?",
    signal: "Right sizing, managed services, lifecycle policies, autoscaling, and observability.",
  },
  {
    id: "incident-response",
    category: "troubleshooting",
    prompt: "A production API has elevated 5xx errors. What is your first 30-minute response plan?",
    signal: "Triage, metrics/logs, rollback/mitigation, communication, and post-incident review.",
  },
  {
    id: "security-s3",
    category: "security/IAM",
    prompt: "How would you secure an S3 bucket containing sensitive reports?",
    signal: "Block public access, IAM policy, KMS encryption, CloudTrail, versioning, and access review.",
  },
  {
    id: "devops-pipeline",
    category: "resume/project walkthrough",
    prompt: "How would you deploy a static React app safely to GitHub Pages?",
    signal: "Build validation, environment handling, GitHub Actions, SPA fallback, and smoke checks.",
  },
];

export const defaultCareerOsState: CareerOsState = {
  schemaVersion: 1,
  targetRoles: ["Cloud Support Associate", "Junior Cloud Engineer"],
  weeklyApplicationGoal: 5,
  applications: [],
  interviewNotes: [],
  jobSearchPreferences: {
    preferredLocation: "United States",
    workMode: "Remote",
    selectedBoards: ["Google", "LinkedIn", "Indeed", "Dice"],
    savedSearchCardIds: [],
  },
  resumeBullets: [],
};

function notifyCareerStateChange() {
  window.dispatchEvent(new Event(careerStateEvent));
}

export function readCareerState() {
  const stored = readLocalValue<Partial<CareerOsState>>(careerOsKey, defaultCareerOsState);

  return {
    ...defaultCareerOsState,
    ...stored,
    jobSearchPreferences: {
      ...defaultCareerOsState.jobSearchPreferences,
      ...stored.jobSearchPreferences,
      selectedBoards: stored.jobSearchPreferences?.selectedBoards?.length
        ? stored.jobSearchPreferences.selectedBoards
        : defaultCareerOsState.jobSearchPreferences.selectedBoards,
      savedSearchCardIds: stored.jobSearchPreferences?.savedSearchCardIds ?? [],
    },
  };
}

export function writeCareerState(state: CareerOsState) {
  writeLocalValue(careerOsKey, state);
  notifyCareerStateChange();
}

export function createApplication(
  application: Omit<JobApplication, "createdAt" | "id" | "updatedAt">,
) {
  const now = new Date().toISOString();
  return {
    ...application,
    id: `job:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
}

export function getRecommendedPromptCategories(roles: TargetRole[]): InterviewCategory[] {
  const categories = new Set<InterviewCategory>([
    "AWS fundamentals",
    "architecture scenarios",
    "behavioral STAR stories",
    "resume/project walkthrough",
  ]);

  if (roles.includes("SOC/Cloud Security Associate")) {
    categories.add("security/IAM");
    categories.add("troubleshooting");
  }

  if (roles.includes("Junior Cloud Engineer") || roles.includes("DevOps Intern")) {
    categories.add("troubleshooting");
  }

  if (roles.includes("Cloud Operations Associate")) {
    categories.add("troubleshooting");
    categories.add("AWS fundamentals");
  }

  return [...categories];
}
