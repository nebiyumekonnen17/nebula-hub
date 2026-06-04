export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AwsService = {
  id: number;
  service_name: string;
  category: string | null;
  summary: string | null;
  gotcha: string | null;
  use_case: string | null;
  contributor: string | null;
  created_at: string | null;
  cli_snippets: Json | null;
  mastery_level: number | null;
  detailed_docs: string | null;
};

export type AwsQuizQuestion = {
  id: number;
  question: string;
  options: Json;
  correct_answer_index: number;
  explanation: string | null;
  category: string | null;
  created_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      aws_services: {
        Row: AwsService;
        Insert: never;
        Update: never;
      };
      aws_quiz_questions: {
        Row: AwsQuizQuestion;
        Insert: never;
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type ConnectionSmoke = {
  services: {
    count: number;
    categories: string[];
    sample: AwsService[];
  };
  quiz: {
    count: number;
    categories: string[];
    sample: AwsQuizQuestion[];
  };
};
