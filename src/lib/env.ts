export type AppEnv = {
  adzunaAppId?: string;
  adzunaAppKey?: string;
  adzunaCountry: string;
  adzunaProxyUrl?: string;
  geminiApiKey?: string;
  supabaseAnonKey?: string;
  supabaseUrl?: string;
};

export type EnvStatus = {
  adzunaCountry: string;
  env: AppEnv;
  isAdzunaReady: boolean;
  isGeminiReady: boolean;
  isSupabaseReady: boolean;
  missingAdzunaKeys: string[];
  missingSupabaseKeys: string[];
};

export function getEnvStatus(): EnvStatus {
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  const normalizedGeminiKey =
    geminiApiKey && !geminiApiKey.toLowerCase().includes("optional-rotated")
      ? geminiApiKey
      : undefined;
  const adzunaProxyUrl =
    import.meta.env.VITE_ADZUNA_PROXY_URL?.trim() ||
    (import.meta.env.DEV ? "/adzuna-api" : undefined);
  const hasSecureAdzunaProxy = Boolean(
    adzunaProxyUrl && !adzunaProxyUrl.startsWith("/adzuna-api"),
  );

  const env: AppEnv = {
    adzunaAppId: import.meta.env.VITE_ADZUNA_APP_ID?.trim(),
    adzunaAppKey: import.meta.env.VITE_ADZUNA_APP_KEY?.trim(),
    adzunaCountry: import.meta.env.VITE_ADZUNA_COUNTRY?.trim().toLowerCase() || "us",
    adzunaProxyUrl,
    geminiApiKey: normalizedGeminiKey,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim(),
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.trim(),
  };

  const missingAdzunaKeys: string[] = [];
  const missingSupabaseKeys: string[] = [];

  if (!hasSecureAdzunaProxy && !env.adzunaAppId) {
    missingAdzunaKeys.push("VITE_ADZUNA_APP_ID");
  }

  if (!hasSecureAdzunaProxy && !env.adzunaAppKey) {
    missingAdzunaKeys.push("VITE_ADZUNA_APP_KEY");
  }

  if (!env.supabaseUrl) {
    missingSupabaseKeys.push("VITE_SUPABASE_URL");
  }

  if (!env.supabaseAnonKey) {
    missingSupabaseKeys.push("VITE_SUPABASE_ANON_KEY");
  }

  return {
    adzunaCountry: env.adzunaCountry,
    env,
    isAdzunaReady: missingAdzunaKeys.length === 0,
    isGeminiReady: Boolean(normalizedGeminiKey),
    isSupabaseReady: missingSupabaseKeys.length === 0,
    missingAdzunaKeys,
    missingSupabaseKeys,
  };
}
