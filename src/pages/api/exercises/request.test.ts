import type { APIContext, APIRoute } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpenRouterExerciseGeneratorError } from "@/lib/services/openrouter-exercise-generator";
import type { TeacherAuthorizationResult } from "@/lib/services/teacher-authorization";
import type { ExerciseCandidate, ExerciseGenerationError, ExerciseGenerationSuccess } from "@/types";

import { createExerciseRequestHandler } from "./request";

vi.mock("astro:env/server", () => ({
  OPENROUTER_API_KEY: undefined,
  OPENROUTER_MODEL: undefined,
}));

const validRequest = {
  grade: 4,
  topic: "addition-subtraction",
  difficulty: "easy",
} as const;

const candidate: ExerciseCandidate = {
  id: "candidate-1",
  text: "Oblicz 20 + 5.",
  proposedCanonicalAnswer: "25",
  ...validRequest,
  approvalStatus: "unverified",
};

function contextFor(body: string): APIContext {
  return {
    request: new Request("http://localhost/api/exercises/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
    locals: { user: null },
    cookies: {},
  } as APIContext;
}

async function responseBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function handlerFor(
  options: {
    authorization?: TeacherAuthorizationResult;
    candidates?: ExerciseCandidate[];
    generationError?: Error;
    configured?: boolean;
  } = {},
) {
  const authorize = vi.fn().mockResolvedValue(options.authorization ?? { status: "authorized-teacher" });
  const generate = options.generationError
    ? vi.fn().mockRejectedValue(options.generationError)
    : vi.fn().mockResolvedValue(options.candidates ?? [candidate]);
  const handler = createExerciseRequestHandler({
    authorize,
    generate,
    createSupabaseClient: vi.fn(() => null),
    providerConfig: options.configured === false ? {} : { apiKey: "test-secret", model: "test/model" },
  });

  return { handler, authorize, generate };
}

async function invoke(handler: APIRoute, body = JSON.stringify(validRequest)): Promise<Response> {
  return handler(contextFor(body));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/exercises/request", () => {
  it.each([
    { label: "invalid JSON", body: "{" },
    { label: "invalid metadata", body: JSON.stringify({ ...validRequest, grade: 5 }) },
  ])("returns 400 for $label before authorization", async ({ body }) => {
    const { handler, authorize, generate } = handlerFor();

    const response = await invoke(handler, body);

    expect(response.status).toBe(400);
    expect(await responseBody<ExerciseGenerationError>(response)).toEqual({
      error: { code: "INVALID_REQUEST", message: "Nieprawidłowe dane żądania." },
    });
    expect(authorize).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("returns 401 without a session", async () => {
    const { handler, generate } = handlerFor({ authorization: { status: "unauthenticated" } });

    const response = await invoke(handler);

    expect(response.status).toBe(401);
    expect((await responseBody<ExerciseGenerationError>(response)).error.code).toBe("UNAUTHENTICATED");
    expect(generate).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-teacher", async () => {
    const { handler, generate } = handlerFor({ authorization: { status: "non-teacher" } });

    const response = await invoke(handler);

    expect(response.status).toBe(403);
    expect((await responseBody<ExerciseGenerationError>(response)).error.code).toBe("FORBIDDEN");
    expect(generate).not.toHaveBeenCalled();
  });

  it("fails closed when the profile is unavailable", async () => {
    const { handler, generate } = handlerFor({ authorization: { status: "profile-unavailable" } });

    const response = await invoke(handler);

    expect(response.status).toBe(403);
    expect(await responseBody<ExerciseGenerationError>(response)).toEqual({
      error: { code: "FORBIDDEN", message: "Nie można potwierdzić uprawnień nauczyciela." },
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("returns 503 for missing provider configuration after authorization", async () => {
    const { handler, generate } = handlerFor({ configured: false });

    const response = await invoke(handler);

    expect(response.status).toBe(503);
    expect((await responseBody<ExerciseGenerationError>(response)).error.code).toBe("PROVIDER_NOT_CONFIGURED");
    expect(generate).not.toHaveBeenCalled();
  });

  it("returns 502 for unusable provider output or upstream failure", async () => {
    const { handler } = handlerFor({
      generationError: new OpenRouterExerciseGeneratorError("PROVIDER_FAILURE"),
    });

    const response = await invoke(handler);

    expect(response.status).toBe(502);
    expect((await responseBody<ExerciseGenerationError>(response)).error.code).toBe("PROVIDER_FAILURE");
  });

  it("returns 502 if the generation service returns no usable candidates", async () => {
    const { handler } = handlerFor({ candidates: [] });

    const response = await invoke(handler);

    expect(response.status).toBe(502);
    expect((await responseBody<ExerciseGenerationError>(response)).error.code).toBe("PROVIDER_FAILURE");
  });

  it("returns 504 after exhausted provider timeouts", async () => {
    const { handler } = handlerFor({
      generationError: new OpenRouterExerciseGeneratorError("PROVIDER_TIMEOUT"),
    });

    const response = await invoke(handler);

    expect(response.status).toBe(504);
    expect((await responseBody<ExerciseGenerationError>(response)).error.code).toBe("PROVIDER_TIMEOUT");
  });

  it("returns a complete successful batch", async () => {
    const candidates = Array.from({ length: 5 }, (_, index) => ({
      ...candidate,
      id: `candidate-${index + 1}`,
      text: `Oblicz ${index + 1} + 1.`,
    }));
    const { handler, generate } = handlerFor({ candidates });

    const response = await invoke(handler);
    const body = await responseBody<ExerciseGenerationSuccess>(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({ requestedCount: 5, validCount: 5, candidates });
    expect(body).not.toHaveProperty("partial_batch");
    expect(generate).toHaveBeenCalledWith(validRequest, { apiKey: "test-secret", model: "test/model" });
  });

  it("returns partial_batch only for a non-empty short batch", async () => {
    const { handler } = handlerFor({ candidates: [candidate] });

    const response = await invoke(handler);

    expect(response.status).toBe(200);
    expect(await responseBody<ExerciseGenerationSuccess>(response)).toEqual({
      requestedCount: 5,
      validCount: 1,
      partial_batch: true,
      candidates: [candidate],
    });
  });
});
