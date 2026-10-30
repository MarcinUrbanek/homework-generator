import * as Sentry from "@sentry/cloudflare";

export interface ErrorLogContext {
  event: string;
  route: string;
  userId?: string | null;
  [key: string]: unknown;
}

/**
 * Logs an error before it is mapped to a typed response. The error object is passed as its own
 * argument so the runtime prints its stack and `[cause]` chain. Never put emails, exercise text,
 * provider bodies or secrets into `context`.
 *
 * When Sentry is enabled (SENTRY_DSN set, see sentry.server.config.ts) the error is also captured
 * there, with the context as tags/extra. Without a DSN this is a plain console.error.
 */
export function logError(context: ErrorLogContext, error?: unknown): void {
  if (error === undefined) {
    // eslint-disable-next-line no-console -- Structured server-side error signal for Workers Logs.
    console.error(context);
  } else {
    // eslint-disable-next-line no-console -- Structured server-side error signal for Workers Logs.
    console.error(context, error);
  }

  if (!Sentry.isEnabled()) return;

  const { event, route, userId, ...extra } = context;
  const captureContext = {
    tags: { event, route },
    extra,
    ...(userId ? { user: { id: userId } } : {}),
  };
  if (error === undefined) {
    Sentry.captureMessage(event, { level: "error", ...captureContext });
  } else {
    Sentry.captureException(error, captureContext);
  }
}
