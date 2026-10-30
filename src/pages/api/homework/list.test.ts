import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";

import { StudentHomeworkServiceError } from "@/lib/services/student-homework";
import type { StudentHomeworkListSuccess } from "@/types";

import { createStudentHomeworkListHandler } from "./list";

vi.mock("astro:env/server", () => ({
  SUPABASE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_URL: undefined,
}));

const assignmentId = "00000000-0000-4000-8000-000000000001";
const listResult: StudentHomeworkListSuccess = {
  assignments: [
    {
      assignmentId,
      className: "Matematyka 4A",
      title: null,
      createdAt: "2026-10-09T10:00:00.000Z",
      exerciseCount: 2,
      submitted: false,
      submittedAt: null,
      correctCount: null,
      passed: null,
      hasFeedback: false,
    },
  ],
};

function context(userId: string | null = "student"): APIContext {
  return {
    request: new Request("http://localhost/api/homework/list"),
    locals: { user: userId ? { id: userId } : null },
    cookies: {},
  } as APIContext;
}

async function responseBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function handlerFor(
  options: {
    authorization?: { status: "not-student" | "profile-unavailable" | "authorized-student" };
    clientAvailable?: boolean;
    listImplementation?: () => Promise<unknown>;
  } = {},
) {
  const authorize = vi.fn().mockResolvedValue(options.authorization ?? { status: "authorized-student" as const });
  const list = vi.fn(options.listImplementation ?? (() => Promise.resolve(listResult)));
  const handler = createStudentHomeworkListHandler({
    authorize,
    createSupabaseClient: vi.fn(() => (options.clientAvailable === false ? null : ({} as never))),
    list,
  });
  return { handler, authorize, list };
}

describe("GET /api/homework/list", () => {
  it("rejects anonymous users before creating a session client or reading homework", async () => {
    const { authorize, list } = handlerFor();
    const createSupabaseClient = vi.fn();
    const response = await createStudentHomeworkListHandler({
      authorize,
      createSupabaseClient,
      list,
    })(context(null));

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await responseBody(response)).toEqual({
      error: { code: "UNAUTHENTICATED", message: "Zaloguj się, aby zobaczyć zadania domowe." },
    });
    expect(createSupabaseClient).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it.each([
    { authorization: { status: "not-student" } as const, status: 403, code: "FORBIDDEN" },
    { authorization: { status: "profile-unavailable" } as const, status: 503, code: "DATABASE_UNAVAILABLE" },
  ])("denies unavailable student-role checks without listing homework", async ({ authorization, status, code }) => {
    const { handler, list } = handlerFor({ authorization });
    const response = await handler(context());

    expect(response.status).toBe(status);
    const body = await responseBody<{ error: { code: string } }>(response);
    expect(body.error.code).toBe(code);
    expect(JSON.stringify(body)).not.toContain(assignmentId);
    expect(list).not.toHaveBeenCalled();
  });

  it("returns the exact student summary shape without truncating or exposing private fields", async () => {
    const manyAssignments = {
      assignments: Array.from({ length: 24 }, (_, index) => ({
        ...listResult.assignments[0],
        assignmentId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      })),
    };
    const { handler, list } = handlerFor({ listImplementation: () => Promise.resolve(manyAssignments) });
    const response = await handler(context());
    const body = await responseBody<StudentHomeworkListSuccess>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body).toEqual(manyAssignments);
    expect(body.assignments).toHaveLength(24);
    expect(list).toHaveBeenCalledWith(expect.anything());
    const serialized = JSON.stringify(body);
    for (const privateField of [
      "canonical_answer",
      "normalized_answer",
      "exercise_id",
      "recipient_id",
      "student_email",
      "verifier",
      "classmate",
    ]) {
      expect(serialized).not.toContain(privateField);
    }
  });

  it("composes the handler with the session-bound RPC adapter", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          assignment_id: assignmentId,
          class_name: "Matematyka 4A",
          assignment_title: null,
          created_at: "2026-10-09T10:00:00.000Z",
          exercise_count: 2,
          submitted: false,
          submitted_at: null,
          correct_count: null,
          passed: null,
          has_feedback: false,
        },
      ],
      error: null,
    });
    const handler = createStudentHomeworkListHandler({
      authorize: vi.fn().mockResolvedValue({ status: "authorized-student" }),
      createSupabaseClient: vi.fn(() => ({ rpc }) as never),
    });

    const response = await handler(context());

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual(listResult);
    expect(rpc).toHaveBeenCalledWith("list_student_homework");
  });

  it.each([
    {
      failure: new StudentHomeworkServiceError("DATABASE_UNAVAILABLE"),
      status: 503,
      code: "DATABASE_UNAVAILABLE",
    },
    {
      failure: Object.assign(new Error("sensitive SQL detail"), { code: "XX000" }),
      status: 500,
      code: "PERSISTENCE_FAILURE",
    },
  ])("returns stable non-disclosing service failures", async ({ failure, status, code }) => {
    const { handler } = handlerFor({ listImplementation: () => Promise.reject(failure) });
    const response = await handler(context());
    const body = await responseBody<{ error: { code: string; message: string } }>(response);

    expect(response.status).toBe(status);
    expect(body.error.code).toBe(code);
    expect(JSON.stringify(body)).not.toContain("sensitive SQL detail");
    expect(JSON.stringify(body)).not.toContain(assignmentId);
  });

  it("logs 5xx service failures with the original error but not expected 4xx denials", async () => {
    const failure = Object.assign(new Error("sensitive SQL detail"), { code: "XX000" });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const failed = await handlerFor({ listImplementation: () => Promise.reject(failure) }).handler(context());
    expect(failed.status).toBe(500);
    expect(log).toHaveBeenCalledWith(
      { event: "student_homework_list_failed", route: "/api/homework/list", userId: "student" },
      failure,
    );

    log.mockClear();
    const denied = await handlerFor({
      listImplementation: () => Promise.reject(new StudentHomeworkServiceError("FORBIDDEN")),
    }).handler(context());
    expect(denied.status).toBe(403);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("rejects malformed service output without serializing unexpected fields", async () => {
    const { handler } = handlerFor({
      listImplementation: () =>
        Promise.resolve({
          assignments: [{ ...listResult.assignments[0], canonicalAnswer: "private-answer" }],
        }),
    });
    const response = await handler(context());
    const body = await responseBody<{ error: { code: string } }>(response);

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("PERSISTENCE_FAILURE");
    expect(JSON.stringify(body)).not.toContain("private-answer");
  });

  it("reports a missing session client as database unavailability", async () => {
    const { handler, list } = handlerFor({ clientAvailable: false });
    const response = await handler(context());

    expect(response.status).toBe(503);
    expect((await responseBody<{ error: { code: string } }>(response)).error.code).toBe("DATABASE_UNAVAILABLE");
    expect(list).not.toHaveBeenCalled();
  });
});
