export type AppEnv = {
  adzunaAppId?: string;
  adzunaAppKey?: string;
  adzunaCountry: string;
  adzunaProxyUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  geminiApiKey?: string;
};

export type EnvStatus = {
  env: AppEnv;
  adzunaCountry: string;
  isAdzunaReady: boolean;
  isSupabaseReady: boolean;
  missingAdzunaKeys: string[];
  missingSupabaseKeys: string[];
  isGeminiReady: boolean;
};

export function getEnvStatus(): EnvStatus {
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  const normalizedGeminiKey =
    geminiApiKey && !geminiApiKey.toLowerCase().includes("optional-rotated")
      ? geminiApiKey
      : undefined;

  const env: AppEnv = {
    adzunaAppId: import.meta.env.VITE_ADZUNA_APP_ID?.trim(),
    adzunaAppKey: import.meta.env.VITE_ADZUNA_APP_KEY?.trim(),
    adzunaCountry: import.meta.env.VITE_ADZUNA_COUNTRY?.trim().toLowerCase() || "us",
    adzunaProxyUrl: import.meta.env.VITE_ADZUNA_PROXY_URL?.trim() || (import.meta.env.DEV ? "/adzuna-api" : undefined),
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.trim(),
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim(),
    geminiApiKey: normalizedGeminiKey,
  };

  const missingAdzunaKeys: string[] = [];
  const missingSupabaseKeys: string[] = [];

  if (!env.adzunaAppId) {
    missingAdzunaKeys.push("VITE_ADZUNA_APP_ID");
  }

  if (!env.adzunaAppKey) {
    missingAdzunaKeys.push("VITE_ADZUNA_APP_KEY");
  }

  if (!env.supabaseUrl) {
    missingSupabaseKeys.push("VITE_SUPABASE_URL");
  }

  if (!env.supabaseAnonKey) {
    missingSupabaseKeys.push("VITE_SUPABASE_ANON_KEY");
  }

  return {
    env,
    adzunaCountry: env.adzunaCountry,
    isAdzunaReady: missingAdzunaKeys.length === 0,
    isSupabaseReady: missingSupabaseKeys.length === 0,
    missingAdzunaKeys,
    missingSupabaseKeys,
    isGeminiReady: Boolean(normalizedGeminiKey),
  };
}
