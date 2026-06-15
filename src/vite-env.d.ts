/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADZUNA_APP_ID?: string;
  readonly VITE_ADZUNA_APP_KEY?: string;
  readonly VITE_ADZUNA_COUNTRY?: string;
  readonly VITE_ADZUNA_PROXY_URL?: string;
  readonly VITE_ADZUNA_PROXY_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
