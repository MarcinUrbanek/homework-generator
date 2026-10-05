import type { APIContext, APIRoute } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TeacherAuthorizationResult } from "@/lib/services/teacher-authorization";
import type { SavedExerciseError, SavedExerciseSuccess } from "@/types";

import { createSavedExercisesHandler } from "./saved";

vi.mock("astro:env/server", () => ({
  SUPABASE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_URL: undefined,
}));

const teacherId = "00000000-0000-4000-8000-000000000001";
const studentId = "student-without-teacher-role";
const exerciseId = "00000000-0000-4000-8000-000000000201";
const approvalTime = "2026-10-02T12:00:00.000Z";

function contextFor(query = "grade=4&topic=addition-subtraction", userId = teacherId): APIContext {
  return {
    request: new Request(`http://localhost/api/exercises/saved?${query}`),
    locals: { user: { id: userId } },
    cookies: {},
  } as APIContext;
}

function row(index = 1) {
  return {
    id: `00000000-0000-4000-8000-${String(200 + index).padStart(12, "0")}`,
    exercise_text: `Treść ${index}`,
    canonical_answer: String(index),
    grade: "4",
    topic: "addition-subtraction",
    difficulty: "easy",
    approved_at: approvalTime,
  };
}

async function responseBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function handlerFor(
  options: {
    authorization?: TeacherAuthorizationResult;
    clientAvailable?: boolean;
    retrieveImplementation?: (client: unknown, query: unknown) => Promise<unknown>;
  } = {},
) {
  const authorize = vi.fn().mockResolvedValue(options.authorization ?? { status: "authorized-teacher" });
  const retrieve = vi.fn(options.retrieveImplementation ?? (() => Promise.resolve([row()])));
  const handler = createSavedExercisesHandler({
    authorize,
    createSupabaseClient: vi.fn(() => (options.clientAvailable === false ? null : ({} as never))),
    retrieve,
  });
  return { handler, authorize, retrieve };
}

async function invoke(handler: APIRoute, query?: string, userId = teacherId): Promise<Response> {
  return handler(contextFor(query, userId));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/exercises/saved", () => {
  it.each([
    "grade=3&topic=addition-subtraction",
    "grade=4&topic=unknown",
    "grade=4&topic=addition-subtraction&difficulty=unknown",
    "grade=4&topic=addition-subtraction&cursor=not-a-cursor",
  ])("returns 400 for invalid query before authorization: %s", async (query) => {
    const { handler, authorize, retrieve } = handlerFor();

    const response = await invoke(handler, query);

    expect(response.status).toBe(400);
    expect((await responseBody<SavedExerciseError>(response)).error.code).toBe("INVALID_REQUEST");
    expect(authorize).not.toHaveBeenCalled();
    expect(retrieve).not.toHaveBeenCalled();
  });

  it.each([
    { authorization: { status: "unauthenticated" } as const, status: 401, code: "UNAUTHENTICATED" },
    { authorization: { status: "profile-unavailable" } as const, status: 403, code: "FORBIDDEN" },
  ])("maps $authorization.status authorization", async ({ authorization, status, code }) => {
    const { handler, retrieve } = handlerFor({ authorization });

    const response = await invoke(handler);

    expect(response.status).toBe(status);
    expect((await responseBody<SavedExerciseError>(response)).error.code).toBe(code);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("denies a signed-in student before saved-exercise retrieval", async () => {
    const { handler, retrieve } = handlerFor({ authorization: { status: "non-teacher" } });

    const response = await invoke(handler, undefined, studentId);

    expect(response.status).toBe(403);
    const body = await responseBody<SavedExerciseError>(response);
    expect(body).toEqual({
      error: { code: "FORBIDDEN", message: "Przeglądanie zapisanych zadań jest dostępne tylko dla nauczycieli." },
    });
    expect(retrieve).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain(exerciseId);
    expect(JSON.stringify(body)).not.toContain("Treść 1");
    expect(JSON.stringify(body)).not.toContain("canonicalAnswer");
  });

  it("returns 503 when the request-scoped database client is unavailable", async () => {
    const { handler, retrieve } = handlerFor({ clientAvailable: false });

    const response = await invoke(handler);

    expect(response.status).toBe(503);
    expect((await responseBody<SavedExerciseError>(response)).error.code).toBe("DATABASE_UNAVAILABLE");
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("passes topic-only filters to retrieval and maps rows", async () => {
    const { handler, retrieve } = handlerFor();

    const response = await invoke(handler);

    expect(response.status).toBe(200);
    expect(await responseBody<SavedExerciseSuccess>(response)).toEqual({
      exercises: [
        {
          id: exerciseId,
          text: "Treść 1",
          canonicalAnswer: "1",
          grade: 4,
          topic: "addition-subtraction",
          difficulty: "easy",
          approvedAt: approvalTime,
        },
      ],
      nextCursor: null,
    });
    expect(retrieve).toHaveBeenCalledWith(expect.anything(), {
      filters: { grade: 4, topic: "addition-subtraction" },
      cursor: null,
    });
  });

  it("passes an optional difficulty filter to retrieval", async () => {
    const { handler, retrieve } = handlerFor();

    const response = await invoke(handler, "grade=4&topic=addition-subtraction&difficulty=hard");

    expect(response.status).toBe(200);
    expect(retrieve).toHaveBeenCalledWith(expect.anything(), {
      filters: { grade: 4, topic: "addition-subtraction", difficulty: "hard" },
      cursor: null,
    });
  });

  it("returns 20 rows and a filter-bound cursor from 21 retrieved rows", async () => {
    const { handler } = handlerFor({
      retrieveImplementation: () => Promise.resolve(Array.from({ length: 21 }, (_, index) => row(index + 1))),
    });

    const response = await invoke(handler);
    const body = await responseBody<SavedExerciseSuccess>(response);

    expect(response.status).toBe(200);
    expect(body.exercises).toHaveLength(20);
    expect(body.nextCursor).toEqual(expect.any(String));

    const nextResponse = await invoke(
      handler,
      `grade=4&topic=addition-subtraction&cursor=${encodeURIComponent(body.nextCursor ?? "")}`,
    );
    expect(nextResponse.status).toBe(200);
  });

  it("rejects a cursor reused with different filters", async () => {
    const { handler } = handlerFor({
      retrieveImplementation: () => Promise.resolve(Array.from({ length: 21 }, (_, index) => row(index + 1))),
    });
    const firstPage = await responseBody<SavedExerciseSuccess>(await invoke(handler));

    const response = await invoke(
      handler,
      `grade=4&topic=addition-subtraction&difficulty=easy&cursor=${encodeURIComponent(firstPage.nextCursor ?? "")}`,
    );

    expect(response.status).toBe(400);
    expect((await responseBody<SavedExerciseError>(response)).error.code).toBe("INVALID_REQUEST");
  });

  it("returns an empty success response", async () => {
    const { handler } = handlerFor({ retrieveImplementation: () => Promise.resolve([]) });

    expect(await responseBody<SavedExerciseSuccess>(await invoke(handler))).toEqual({
      exercises: [],
      nextCursor: null,
    });
  });

  it.each([
    {
      failure: Object.assign(new Error("sensitive database detail"), { code: "08006" }),
      status: 503,
      code: "DATABASE_UNAVAILABLE",
    },
    {
      failure: Object.assign(new Error("sensitive database detail"), { code: "XX000" }),
      status: 500,
      code: "PERSISTENCE_FAILURE",
    },
    { failure: null, status: 500, code: "PERSISTENCE_FAILURE" },
  ])("maps non-leaking retrieval failures", async ({ failure, status, code }) => {
    const { handler } = handlerFor({
      retrieveImplementation: () =>
        failure ? Promise.reject(failure) : Promise.resolve([{ ...row(), exercise_text: "" }]),
    });

    const response = await invoke(handler);
    const body = await responseBody<SavedExerciseError>(response);

    expect(response.status).toBe(status);
    expect(body.error.code).toBe(code);
    expect(body.error.message).not.toContain("sensitive");
  });
});
