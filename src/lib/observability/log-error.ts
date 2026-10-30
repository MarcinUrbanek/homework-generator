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
 */
export function logError(context: ErrorLogContext, error?: unknown): void {
  if (error === undefined) {
    // eslint-disable-next-line no-console -- Structured server-side error signal for Workers Logs.
    console.error(context);
    return;
  }
  // eslint-disable-next-line no-console -- Structured server-side error signal for Workers Logs.
  console.error(context, error);
}
