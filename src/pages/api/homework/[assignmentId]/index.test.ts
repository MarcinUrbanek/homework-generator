import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";

import { StudentHomeworkServiceError } from "@/lib/services/student-homework";
import type { StudentHomeworkDetailSuccess } from "@/types";

import { createStudentHomeworkDetailHandler } from "./index";

vi.mock("astro:env/server", () => ({
  SUPABASE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_URL: undefined,
}));

const assignmentId = "00000000-0000-4000-8000-000000000001";
const exerciseId = "00000000-0000-4000-8000-000000000002";
const privateCanonicalAnswer = "private-canonical-answer";

const detail: StudentHomeworkDetailSuccess = {
  assignment: {
    assignmentId,
    className: "Matematyka 4A",
    title: "Powtórka",
    createdAt: "2026-10-09T10:00:00.000Z",
    exerciseCount: 2,
  },
  exercises: [
    { position: 1, prompt: "Ile to 1 + 1?" },
    { position: 2, prompt: "Ile to 2 + 2?" },
  ],
  submission: null,
};

function context(userId: string | null = "student", pathAssignmentId: string = assignmentId): APIContext {
  return {
    request: new Request(`http://localhost/api/homework/${pathAssignmentId}`),
    params: { assignmentId: pathAssignmentId },
    locals: { user: userId ? { id: userId } : null },
    cookies: {},
  } as unknown as APIContext;
}

async function responseBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function handlerFor(
  options: {
    authorization?: { status: "not-student" | "profile-unavailable" | "authorized-student" };
    clientAvailable?: boolean;
    detail?: unknown;
    getImplementation?: (id: string) => Promise<unknown>;
  } = {},
) {
  const authorize = vi.fn().mockResolvedValue(options.authorization ?? { status: "authorized-student" as const });
  const getHomework = vi.fn((_: unknown, id: string) =>
    options.getImplementation ? options.getImplementation(id) : Promise.resolve(options.detail ?? detail),
  );
  const handler = createStudentHomeworkDetailHandler({
    authorize,
    createSupabaseClient: vi.fn(() => (options.clientAvailable === false ? null : ({} as never))),
    getHomework,
  });
  return { handler, authorize, getHomework };
}

describe("GET /api/homework/:assignmentId", () => {
  it("rejects invalid IDs before authentication or database access", async () => {
    const { handler, authorize, getHomework } = handlerFor();
    const response = await handler(context(null, "not-a-uuid"));

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await responseBody<{ error: { code: string } }>(response)).error.code).toBe("INVALID_REQUEST");
    expect(authorize).not.toHaveBeenCalled();
    expect(getHomework).not.toHaveBeenCalled();
  });

  it("returns 401 for anonymous callers without looking up homework", async () => {
    const { handler, authorize, getHomework } = handlerFor();
    const response = await handler(context(null));

    expect(response.status).toBe(401);
    expect((await responseBody<{ error: { code: string } }>(response)).error.code).toBe("UNAUTHENTICATED");
    expect(authorize).not.toHaveBeenCalled();
    expect(getHomework).not.toHaveBeenCalled();
  });

  it("returns ordered assigned prompts and only the saved raw result", async () => {
    const savedDetail: StudentHomeworkDetailSuccess = {
      ...detail,
      submission: {
        submissionId: "00000000-0000-4000-8000-000000000003",
        submittedAt: "2026-10-09T11:00:00.000Z",
        correctCount: 1,
        assignedCount: 2,
        passed: true,
        answers: [
          { position: 1, answer: " 2 ", isCorrect: true },
          { position: 2, answer: "3", isCorrect: false },
        ],
      },
    };
    const { handler, getHomework } = handlerFor({ detail: savedDetail });
    const response = await handler(context());
    const body = await responseBody<StudentHomeworkDetailSuccess>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body).toEqual(savedDetail);
    expect(body.exercises.map(({ position }) => position)).toEqual([1, 2]);
    expect(getHomework).toHaveBeenCalledWith(expect.anything(), assignmentId);
    const serialized = JSON.stringify(body);
    for (const privateValue of [
      privateCanonicalAnswer,
      exerciseId,
      "normalized_answer",
      "canonicalAnswer",
      "verifier",
      "classmate",
      "recipientId",
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
    expect(serialized).toContain('"answer":" 2 "');
  });

  it("composes the handler with the session-bound detail RPC adapter", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        assignment: {
          assignment_id: assignmentId,
          class_name: "Matematyka 4A",
          title: "Powtórka",
          created_at: "2026-10-09T10:00:00.000Z",
          exercise_count: 2,
        },
        exercises: [
          { position: 1, prompt: "Ile to 1 + 1?" },
          { position: 2, prompt: "Ile to 2 + 2?" },
        ],
        submission: null,
      },
      error: null,
    });
    const handler = createStudentHomeworkDetailHandler({
      authorize: vi.fn().mockResolvedValue({ status: "authorized-student" }),
      createSupabaseClient: vi.fn(() => ({ rpc }) as never),
    });

    const response = await handler(context());

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual(detail);
    expect(rpc).toHaveBeenCalledWith("get_student_homework", { p_assignment_id: assignmentId });
  });

  it.each([
    { failure: new StudentHomeworkServiceError("HOMEWORK_UNAVAILABLE"), status: 404, code: "HOMEWORK_UNAVAILABLE" },
    { failure: new StudentHomeworkServiceError("DATABASE_UNAVAILABLE"), status: 503, code: "DATABASE_UNAVAILABLE" },
    {
      failure: Object.assign(new Error("raw SQL detail"), { code: "XX000" }),
      status: 500,
      code: "PERSISTENCE_FAILURE",
    },
  ])(
    "maps unavailable and persistence failures without disclosing assignment details",
    async ({ failure, status, code }) => {
      const { handler } = handlerFor({ getImplementation: () => Promise.reject(failure) });
      const response = await handler(context());
      const body = await responseBody<{ error: { code: string } }>(response);

      expect(response.status).toBe(status);
      expect(body.error.code).toBe(code);
      expect(JSON.stringify(body)).not.toContain("raw SQL detail");
      expect(JSON.stringify(body)).not.toContain(assignmentId);
    },
  );

  it("uses the same unavailable outcome for foreign or departed homework", async () => {
    const { handler, getHomework } = handlerFor({
      getImplementation: () => Promise.reject(new StudentHomeworkServiceError("HOMEWORK_UNAVAILABLE")),
    });
    const response = await handler(context());

    expect(response.status).toBe(404);
    expect(await responseBody(response)).toEqual({
      error: { code: "HOMEWORK_UNAVAILABLE", message: "Zadanie domowe jest niedostępne." },
    });
    expect(getHomework).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed adapter output and unavailable database clients", async () => {
    const malformed = handlerFor({ detail: { ...detail, canonicalAnswer: privateCanonicalAnswer } });
    const malformedResponse = await malformed.handler(context());
    expect(malformedResponse.status).toBe(500);
    expect((await responseBody<{ error: { code: string } }>(malformedResponse)).error.code).toBe("PERSISTENCE_FAILURE");

    const unavailable = handlerFor({ clientAvailable: false });
    const unavailableResponse = await unavailable.handler(context());
    expect(unavailableResponse.status).toBe(503);
    expect((await responseBody<{ error: { code: string } }>(unavailableResponse)).error.code).toBe(
      "DATABASE_UNAVAILABLE",
    );
    expect(unavailable.getHomework).not.toHaveBeenCalled();
  });
});
