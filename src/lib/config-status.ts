import {
  OPENROUTER_API_KEY,
  OPENROUTER_MODEL,
  OPENROUTER_VERIFIER_MODEL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  SUPABASE_KEY,
} from "astro:env/server";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  message: string;
  docsUrl?: string;
  docsLabel?: string;
}

export const configStatuses: ConfigStatus[] = [
  {
    name: "Supabase",
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    message: "Supabase nie jest skonfigurowany — funkcje uwierzytelniania są wyłączone.",
    docsUrl: "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration",
    docsLabel: "Zobacz instrukcję konfiguracji",
  },
  {
    name: "OpenRouter",
    configured: Boolean(OPENROUTER_API_KEY && OPENROUTER_MODEL),
    message: "OpenRouter nie jest skonfigurowany — generowanie zadań jest wyłączone.",
  },
  {
    name: "Weryfikacja zadań",
    configured: Boolean(OPENROUTER_API_KEY && OPENROUTER_VERIFIER_MODEL && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
    message: "Weryfikacja zadań nie jest skonfigurowana — zatwierdzanie zadań jest wyłączone.",
  },
];

export const missingConfigs = configStatuses.filter((s) => !s.configured);
