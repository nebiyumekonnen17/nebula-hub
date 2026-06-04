import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type NebulaSupabaseClient = SupabaseClient<Database>;

export function createNebulaClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
): NebulaSupabaseClient {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "x-application-name": "nebula-hub",
      },
    },
  });
}
