import { afterEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  isEnabled: vi.fn(() => false),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@sentry/cloudflare", () => sentry);

import { logError } from "./log-error";

afterEach(() => {
  vi.restoreAllMocks();
  sentry.isEnabled.mockReturnValue(false);
  sentry.captureException.mockClear();
  sentry.captureMessage.mockClear();
});

describe("logError", () => {
  it("logs the context and the original error object so stack and cause survive", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const cause = new Error("root cause");
    const error = new Error("wrapped", { cause });

    logError({ event: "probe", route: "/api/probe", userId: "user-1" }, error);

    expect(log).toHaveBeenCalledWith({ event: "probe", route: "/api/probe", userId: "user-1" }, error);
    expect((log.mock.calls[0][1] as Error).cause).toBe(cause);
  });

  it("is a plain console.error and never calls Sentry when Sentry is disabled", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    logError({ event: "probe", route: "/api/probe" }, new Error("boom"));
    logError({ event: "probe_without_error", route: "/api/probe" });

    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("routes the error to Sentry.captureException with tags, extra and user id when enabled", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    sentry.isEnabled.mockReturnValue(true);
    const error = new Error("boom");

    logError({ event: "probe", route: "/api/probe", userId: "user-1", reservationId: "r-1" }, error);

    expect(sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { event: "probe", route: "/api/probe" },
      extra: { reservationId: "r-1" },
      user: { id: "user-1" },
    });
  });

  it("captures a message when there is no error object and Sentry is enabled", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    sentry.isEnabled.mockReturnValue(true);

    logError({ event: "admission_unavailable", route: "/api/probe", userId: null });

    expect(sentry.captureMessage).toHaveBeenCalledWith("admission_unavailable", {
      level: "error",
      tags: { event: "admission_unavailable", route: "/api/probe" },
      extra: {},
    });
  });
});
