import type { NebulaSupabaseClient } from "./client";
import type { AwsQuizQuestion, AwsService, ConnectionSmoke, Json } from "./types";

const serviceColumns =
  "id, service_name, category, summary, gotcha, use_case, contributor, created_at, cli_snippets, mastery_level, detailed_docs";

const quizColumns =
  "id, question, options, correct_answer_index, explanation, category, created_at";

function uniqueCategories(rows: Array<{ category: string | null }>): string[] {
  return [...new Set(rows.map((row) => row.category).filter(Boolean) as string[])].sort(
    (a, b) => a.localeCompare(b),
  );
}

export function normalizeOptions(options: Json): string[] {
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .map((option) => {
      if (typeof option === "string") {
        return option;
      }

      if (option && typeof option === "object" && "label" in option) {
        const label = option.label;
        return typeof label === "string" ? label : JSON.stringify(option);
      }

      return String(option);
    })
    .filter(Boolean);
}

export function normalizeCliSnippets(snippets: Json | null): string[] {
  if (!Array.isArray(snippets)) {
    return [];
  }

  return snippets
    .map((snippet) => {
      if (typeof snippet === "string") {
        return snippet;
      }

      if (snippet && typeof snippet === "object") {
        if ("command" in snippet && typeof snippet.command === "string") {
          return snippet.command;
        }

        return JSON.stringify(snippet, null, 2);
      }

      return String(snippet);
    })
    .filter(Boolean);
}

export async function runConnectionSmoke(
  supabase: NebulaSupabaseClient,
): Promise<ConnectionSmoke> {
  const [serviceResult, quizResult] = await Promise.all([
    supabase.from("aws_services").select(serviceColumns, { count: "exact" }).limit(12),
    supabase.from("aws_quiz_questions").select(quizColumns, { count: "exact" }).limit(12),
  ]);

  if (serviceResult.error) {
    throw new Error(serviceResult.error.message);
  }

  if (quizResult.error) {
    throw new Error(quizResult.error.message);
  }

  const services = (serviceResult.data ?? []) as AwsService[];
  const quiz = (quizResult.data ?? []) as AwsQuizQuestion[];

  return {
    services: {
      count: serviceResult.count ?? services.length,
      categories: uniqueCategories(services),
      sample: services,
    },
    quiz: {
      count: quizResult.count ?? quiz.length,
      categories: uniqueCategories(quiz),
      sample: quiz,
    },
  };
}

export async function fetchServices(
  supabase: NebulaSupabaseClient,
): Promise<AwsService[]> {
  const result = await supabase
    .from("aws_services")
    .select(serviceColumns)
    .order("service_name", { ascending: true });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? []) as AwsService[];
}

export async function fetchQuizQuestions(
  supabase: NebulaSupabaseClient,
): Promise<AwsQuizQuestion[]> {
  const result = await supabase
    .from("aws_quiz_questions")
    .select(quizColumns)
    .order("created_at", { ascending: false });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? []) as AwsQuizQuestion[];
}
