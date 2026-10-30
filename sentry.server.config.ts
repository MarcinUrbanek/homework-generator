import * as Sentry from "@sentry/cloudflare";
import handler from "@astrojs/cloudflare/entrypoints/server";

// Custom Worker entry (wrangler.jsonc "main"), per Sentry's "Astro on Cloudflare" guide.
// Without SENTRY_DSN the request goes straight to Astro's handler, so Sentry is never initialized.

interface SentryEnv {
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type AstroHandler = typeof handler;

const sentryHandler: AstroHandler = Sentry.withSentry(
  (env: SentryEnv) => ({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
  }),
  handler,
);

export default {
  fetch(request: Request, env: SentryEnv, context: WorkerContext) {
    // The Workers runtime passes its own Env/ExecutionContext; the local types only describe what we read.
    const target = env.SENTRY_DSN ? sentryHandler : handler;
    return target.fetch(request, env, context);
  },
};
