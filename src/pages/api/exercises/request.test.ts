import type { APIContext, APIRoute } from "astro";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { exerciseGenerationErrorSchema } from "@/lib/exercises/schemas";
import {
  generateOpenRouterExercises,
  OpenRouterExerciseGeneratorError,
} from "@/lib/services/openrouter-exercise-generator";
import {
  admitExerciseGeneration,
  releaseExerciseGeneration,
  type ExerciseGenerationAdmissionDecision,
} from "@/lib/services/exercise-generation-admission";
import { authorizeTeacher, type TeacherAuthorizationResult } from "@/lib/services/teacher-authorization";
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
const teacherId = "b1000000-0000-4000-8000-000000000010";
const studentId = "b1000000-0000-4000-8000-000000000011";
const reservationId = "b1000000-0000-4000-8000-000000000012";

const candidate: ExerciseCandidate = {
  id: "candidate-1",
  text: "Oblicz 20 + 5.",
  proposedCanonicalAnswer: "25",
  ...validRequest,
  approvalStatus: "unverified",
};

function authenticatedUser(id: string): User {
  return {
    id,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function contextFor(body: string, userId: string | null = teacherId): APIContext {
  return {
    request: new Request("http://localhost/api/exercises/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
    locals: { user: userId ? authenticatedUser(userId) : null },
    cookies: {},
  } as APIContext;
}

async function responseBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function teacherClient(rpc: ReturnType<typeof vi.fn> = vi.fn()) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue({ data: { role: "teacher" }, error: null });

  const client = {
    from: vi.fn(() => query),
    rpc,
  } as unknown as SupabaseClient;

  return { client, query };
}

function handlerFor(
  options: {
    authorization?: TeacherAuthorizationResult;
    admission?: ExerciseGenerationAdmissionDecision;
    admissionError?: Error;
    candidates?: ExerciseCandidate[];
    generationError?: Error;
    releaseResult?: "released" | "stale-token" | "unavailable";
    releaseError?: Error;
    configured?: boolean;
  } = {},
) {
  const authorize = vi
    .fn<typeof authorizeTeacher>()
    .mockResolvedValue(options.authorization ?? { status: "authorized-teacher" });
  const generate = options.generationError
    ? vi.fn().mockRejectedValue(options.generationError)
    : vi.fn().mockResolvedValue(options.candidates ?? [candidate]);
  const admit = vi
    .fn<typeof admitExerciseGeneration>()
    .mockResolvedValue(options.admission ?? { status: "admitted", reservationId });
  if (options.admissionError) admit.mockRejectedValue(options.admissionError);

  const release = vi.fn<typeof releaseExerciseGeneration>().mockResolvedValue(options.releaseResult ?? "released");
  if (options.releaseError) release.mockRejectedValue(options.releaseError);

  const { client } = teacherClient();
  const createSupabaseClient = vi.fn(() => client);
  const handler = createExerciseRequestHandler({
    authorize,
    generate,
    admit,
    release,
    createSupabaseClient,
    providerConfig: options.configured === false ? {} : { apiKey: "test-secret", model: "test/model" },
  });

  return { handler, authorize, generate, admit, release, createSupabaseClient, client };
}

async function invoke(
  handler: APIRoute,
  body = JSON.stringify(validRequest),
  userId: string | null = teacherId,
): Promise<Response> {
  return handler(contextFor(body, userId));
}

function providerResponse(exercises: unknown[]): Response {
  return Response.json({
    choices: [{ message: { content: JSON.stringify({ exercises }) } }],
  });
}

function validProviderExercises(count = 5) {
  return Array.from({ length: count }, (_, index) => ({
    text: `Oblicz ${index + 1} + 1.`,
    proposedCanonicalAnswer: String(index + 2),
  }));
}

function composedHandler(admissionResponse: unknown, providerFetch: typeof fetch) {
  const rpc = vi.fn((name: string, ...args: unknown[]) => {
    if (name === "admit_exercise_generation") return admissionResponse;
    if (name === "release_exercise_generation" && args.length === 1) return { data: true, error: null };
    throw new Error("Unexpected RPC");
  });
  const { client } = teacherClient(rpc);
  const handler = createExerciseRequestHandler({
    authorize: authorizeTeacher,
    createSupabaseClient: vi.fn(() => client),
    generate: (request, config) =>
      generateOpenRouterExercises(request, config, {
        fetch: providerFetch,
        deadlineMs: 25,
        createId: () => candidate.id,
      }),
    providerConfig: { apiKey: "test-secret", model: "test/model" },
  });

  return { handler, rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("POST /api/exercises/request", () => {
  it.each([
    { label: "invalid JSON", body: "{" },
    { label: "invalid metadata", body: JSON.stringify({ ...validRequest, grade: 5 }) },
  ])("returns 400 for $label before authorization or admission", async ({ body }) => {
    const { handler, authorize, generate, admit, release } = handlerFor();

    const response = await invoke(handler, body);

    expect(response.status).toBe(400);
    expect(await responseBody<ExerciseGenerationError>(response)).toEqual({
      error: { code: "INVALID_REQUEST", message: "Nieprawidłowe dane żądania." },
    });
    expect(authorize).not.toHaveBeenCalled();
    expect(admit).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("returns 401 without a session before admission", async () => {
    const { handler, generate, admit, release } = handlerFor({ authorization: { status: "unauthenticated" } });

    const response = await invoke(handler, JSON.stringify(validRequest), null);

    expect(response.status).toBe(401);
    expect((await responseBody<ExerciseGenerationError>(response)).error.code).toBe("UNAUTHENTICATED");
    expect(admit).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-teacher before admission", async () => {
    const { handler, generate, admit, release } = handlerFor({ authorization: { status: "non-teacher" } });

    const response = await invoke(handler, JSON.stringify(validRequest), studentId);

    expect(response.status).toBe(403);
    const body = await responseBody<ExerciseGenerationError>(response);
    expect(body).toEqual({
      error: { code: "FORBIDDEN", message: "Generowanie zadań jest dostępne tylko dla nauczycieli." },
    });
    expect(admit).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain("test-secret");
    expect(JSON.stringify(body)).not.toContain(candidate.text);
  });

  it("fails closed when the profile is unavailable without attempting admission", async () => {
    const { handler, generate, admit, release } = handlerFor({ authorization: { status: "profile-unavailable" } });

    const response = await invoke(handler);

    expect(response.status).toBe(403);
    expect(await responseBody<ExerciseGenerationError>(response)).toEqual({
      error: { code: "FORBIDDEN", message: "Nie można potwierdzić uprawnień nauczyciela." },
    });
    expect(admit).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("returns 503 for missing provider configuration after authorization and before admission", async () => {
    const { handler, generate, admit, release } = handlerFor({ configured: false });

    const response = await invoke(handler);

    expect(response.status).toBe(503);
    expect((await responseBody<ExerciseGenerationError>(response)).error.code).toBe("PROVIDER_NOT_CONFIGURED");
    expect(admit).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it.each([
    {
      decision: { status: "quota-exceeded", retryAfterSeconds: 3600 } as const,
      code: "GENERATION_LIMIT_EXCEEDED",
      message: "Osiągnięto limit 10 żądań generowania w ciągu godziny. Spróbuj ponownie później.",
    },
    {
      decision: { status: "in-progress", retryAfterSeconds: 120 } as const,
      code: "GENERATION_IN_PROGRESS",
      message: "Generowanie zadań już trwa. Spróbuj ponownie po jego zakończeniu.",
    },
  ])("returns a typed 429 for $code without generation or release", async ({ decision, code, message }) => {
    const { handler, generate, admit, release } = handlerFor({ admission: decision });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await invoke(handler);
    const body = await responseBody<ExerciseGenerationError>(response);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe(String(decision.retryAfterSeconds));
    expect(body).toEqual({ error: { code, message } });
    expect(exerciseGenerationErrorSchema.safeParse(body).success).toBe(true);
    expect(JSON.stringify(body)).not.toContain("test-secret");
    expect(JSON.stringify(body)).not.toContain(reservationId);
    expect(admit).toHaveBeenCalledTimes(1);
    expect(generate).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it.each([
    { label: "an unavailable decision", admission: { status: "unavailable" } as const },
    { label: "a rejected admission transport", admissionError: new Error("raw database payload") },
  ])("fails closed for $label with a sanitized operation signal", async (options) => {
    const { handler, generate, admit, release } = handlerFor(options);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await invoke(handler);
    const body = await responseBody<ExerciseGenerationError>(response);

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: {
        code: "ADMISSION_UNAVAILABLE",
        message: "Nie można teraz sprawdzić limitu generowania. Spróbuj ponownie później.",
      },
    });
    expect(response.headers.has("Retry-After")).toBe(false);
    expect(JSON.stringify(body)).not.toContain("raw database payload");
    expect(admit).toHaveBeenCalledTimes(1);
    expect(generate).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("exercise_generation_admission_unavailable");
    expect(JSON.stringify(log.mock.calls)).not.toContain("raw database payload");
    expect(JSON.stringify(log.mock.calls)).not.toContain("test-secret");
  });

  it("translates an authorization race from the admission RPC to the existing forbidden response", async () => {
    const { handler, generate, admit, release } = handlerFor({ admission: { status: "forbidden" } });

    const response = await invoke(handler);

    expect(response.status).toBe(403);
    expect(await responseBody<ExerciseGenerationError>(response)).toEqual({
      error: { code: "FORBIDDEN", message: "Generowanie zadań jest dostępne tylko dla nauczycieli." },
    });
    expect(admit).toHaveBeenCalledTimes(1);
    expect(generate).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("returns 502 for unusable provider output or upstream failure and releases the reservation", async () => {
    const { handler, admit, release } = handlerFor({
      generationError: new OpenRouterExerciseGeneratorError("PROVIDER_FAILURE"),
    });

    const response = await invoke(handler);

    expect(response.status).toBe(502);
    expect((await responseBody<ExerciseGenerationError>(response)).error.code).toBe("PROVIDER_FAILURE");
    expect(admit).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(expect.anything(), reservationId);
  });

  it("returns 502 if the generation service returns no usable candidates and releases the reservation", async () => {
    const { handler, generate, admit, release } = handlerFor({ candidates: [] });

    const response = await invoke(handler);

    expect(response.status).toBe(502);
    expect((await responseBody<ExerciseGenerationError>(response)).error.code).toBe("PROVIDER_FAILURE");
    expect(generate).toHaveBeenCalledTimes(1);
    expect(admit).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("returns 504 after exhausted provider timeouts and releases the reservation", async () => {
    const { handler, admit, release } = handlerFor({
      generationError: new OpenRouterExerciseGeneratorError("PROVIDER_TIMEOUT"),
    });

    const response = await invoke(handler);

    expect(response.status).toBe(504);
    expect((await responseBody<ExerciseGenerationError>(response)).error.code).toBe("PROVIDER_TIMEOUT");
    expect(admit).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(expect.anything(), reservationId);
  });

  it("returns a complete successful batch with the existing response fields", async () => {
    const candidates = Array.from({ length: 5 }, (_, index) => ({
      ...candidate,
      id: `candidate-${index + 1}`,
      text: `Oblicz ${index + 1} + 1.`,
    }));
    const { handler, generate, admit, release, authorize, client } = handlerFor({ candidates });

    const response = await invoke(handler);
    const body = await responseBody<ExerciseGenerationSuccess>(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({ requestedCount: 5, validCount: 5, candidates });
    expect(body).not.toHaveProperty("partial_batch");
    expect(generate).toHaveBeenCalledWith(validRequest, { apiKey: "test-secret", model: "test/model" });
    const authorizationCall = authorize.mock.calls[0];
    expect(authorizationCall[0].user?.id).toBe(teacherId);
    expect(authorizationCall[1]).toBe(client);
    expect(admit).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("returns the existing partial batch without extra attempts and releases the reservation", async () => {
    const { handler, generate, admit, release } = handlerFor({ candidates: [candidate] });

    const response = await invoke(handler);

    expect(response.status).toBe(200);
    expect(await responseBody<ExerciseGenerationSuccess>(response)).toEqual({
      requestedCount: 5,
      validCount: 1,
      partial_batch: true,
      candidates: [candidate],
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(admit).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      label: "successful output",
      generationError: undefined,
      releaseResult: "unavailable" as const,
      status: 200,
      code: null,
    },
    {
      label: "a settled provider timeout",
      generationError: new OpenRouterExerciseGeneratorError("PROVIDER_TIMEOUT"),
      releaseError: new Error("raw release payload"),
      status: 504,
      code: "PROVIDER_TIMEOUT",
    },
  ])("preserves $label when release fails", async ({ generationError, releaseResult, releaseError, status, code }) => {
    const { handler, admit, release } = handlerFor({
      ...(generationError ? { generationError } : {}),
      ...(releaseResult ? { releaseResult } : {}),
      ...(releaseError ? { releaseError } : {}),
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await invoke(handler);
    const body = await responseBody<ExerciseGenerationSuccess | ExerciseGenerationError>(response);

    expect(response.status).toBe(status);
    if (code) {
      expect(body).toEqual({ error: { code, message: "Generator zadań nie odpowiedział na czas. Spróbuj ponownie." } });
    } else {
      expect(body).toEqual({
        requestedCount: 5,
        validCount: 1,
        partial_batch: true,
        candidates: [candidate],
      });
    }
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("exercise_generation_release_unavailable");
    expect(admit).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain("raw release payload");
    expect(JSON.stringify(log.mock.calls)).not.toContain(reservationId);
    expect(JSON.stringify(body)).not.toContain("raw release payload");
  });

  it("treats a validated stale-token result as a normal no-op", async () => {
    const { handler } = handlerFor({ releaseResult: "stale-token" });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await invoke(handler);

    expect(response.status).toBe(200);
    expect(await responseBody<ExerciseGenerationSuccess>(response)).toEqual({
      requestedCount: 5,
      validCount: 1,
      partial_batch: true,
      candidates: [candidate],
    });
    expect(log).not.toHaveBeenCalled();
  });

  it("uses the real admission service and generator, charging once across a retry", async () => {
    const providerFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(providerResponse(validProviderExercises()));
    const { handler, rpc } = composedHandler(
      { data: { status: "admitted", reservation_id: reservationId }, error: null },
      providerFetch,
    );

    const response = await invoke(handler);

    expect(response.status).toBe(200);
    expect(providerFetch).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["admit_exercise_generation", "release_exercise_generation"]);
  });

  it.each([
    {
      label: "quota denial",
      rpcResponse: { data: { status: "quota-exceeded", retry_after_seconds: 60 }, error: null },
      status: 429,
    },
    {
      label: "reservation denial",
      rpcResponse: { data: { status: "in-progress", retry_after_seconds: 45 }, error: null },
      status: 429,
    },
    {
      label: "admission unavailability",
      rpcResponse: { data: null, error: { code: "08006", message: "sensitive database response" } },
      status: 503,
    },
    {
      label: "authorization race",
      rpcResponse: { data: null, error: { code: "42501", message: "sensitive authorization detail" } },
      status: 403,
    },
    {
      label: "malformed admission",
      rpcResponse: { data: { status: "admitted", reservation_id: "invalid-token" }, error: null },
      status: 503,
    },
  ])("performs zero provider fetches for composed $label", async ({ rpcResponse, status }) => {
    const providerFetch = vi.fn<typeof fetch>();
    const { handler, rpc } = composedHandler(rpcResponse, providerFetch);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await invoke(handler);

    expect(response.status).toBe(status);
    expect(providerFetch).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("admit_exercise_generation");
  });

  it("preserves a composed timeout response and releases after exhausted attempts", async () => {
    vi.useFakeTimers();
    const providerFetch = vi.fn<typeof fetch>((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });
    const { handler, rpc } = composedHandler(
      { data: { status: "admitted", reservation_id: reservationId }, error: null },
      providerFetch,
    );

    const responsePromise = invoke(handler);
    await vi.runAllTimersAsync();
    const response = await responsePromise;

    expect(response.status).toBe(504);
    expect((await responseBody<ExerciseGenerationError>(response)).error.code).toBe("PROVIDER_TIMEOUT");
    expect(providerFetch).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["admit_exercise_generation", "release_exercise_generation"]);
  });

  it("preserves the partial response in the composed path without retrying", async () => {
    const providerFetch = vi.fn<typeof fetch>().mockResolvedValue(providerResponse(validProviderExercises(2)));
    const { handler, rpc } = composedHandler(
      { data: { status: "admitted", reservation_id: reservationId }, error: null },
      providerFetch,
    );

    const response = await invoke(handler);

    expect(response.status).toBe(200);
    expect((await responseBody<ExerciseGenerationSuccess>(response)).partial_batch).toBe(true);
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["admit_exercise_generation", "release_exercise_generation"]);
  });

  it("filters mixed provider candidates in the composed path without retrying and releases the reservation", async () => {
    const providerFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        providerResponse([
          { text: "Oblicz 1 + 1.", proposedCanonicalAnswer: "2" },
          { text: " ", proposedCanonicalAnswer: "3" },
          { text: "Oblicz 2 + 2.", proposedCanonicalAnswer: "4" },
          { text: "Oblicz 3 + 2.", proposedCanonicalAnswer: "" },
          { text: "Oblicz 4 + 2." },
        ]),
      );
    const { handler, rpc } = composedHandler(
      { data: { status: "admitted", reservation_id: reservationId }, error: null },
      providerFetch,
    );

    const response = await invoke(handler);
    const body = await responseBody<ExerciseGenerationSuccess>(response);

    expect(response.status).toBe(200);
    expect(body.requestedCount).toBe(5);
    expect(body.validCount).toBe(2);
    expect(body.partial_batch).toBe(true);
    expect(body.candidates.map(({ text, proposedCanonicalAnswer }) => ({ text, proposedCanonicalAnswer }))).toEqual([
      { text: "Oblicz 1 + 1.", proposedCanonicalAnswer: "2" },
      { text: "Oblicz 2 + 2.", proposedCanonicalAnswer: "4" },
    ]);
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls).toEqual([
      ["admit_exercise_generation"],
      ["release_exercise_generation", { p_reservation_id: reservationId }],
    ]);
  });
});
