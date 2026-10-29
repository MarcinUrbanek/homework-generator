import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";

import { HomeworkReviewServiceError } from "@/lib/services/homework-review";
import type { HomeworkFeedbackSuccess } from "@/types";

import { createHomeworkFeedbackHandler } from "./feedback";

vi.mock("astro:env/server", () => ({
  SUPABASE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_URL: undefined,
}));

const assignmentId = "00000000-0000-4000-8000-000000000001";
const studentId = "00000000-0000-4000-8000-000000000002";
const saved: HomeworkFeedbackSuccess = {
  feedback: { body: "Dobra praca.\nPopraw zadanie 2.", updatedAt: "2026-10-23T08:00:00.000Z" },
};

function context(
  body: string,
  options: { userId?: string | null; assignmentId?: string; studentId?: string } = {},
): APIContext {
  const pathAssignmentId = options.assignmentId ?? assignmentId;
  const pathStudentId = options.studentId ?? studentId;
  const userId = options.userId === undefined ? "teacher" : options.userId;
  return {
    request: new Request(`http://localhost/api/homework/${pathAssignmentId}/students/${pathStudentId}/feedback`, {
      method: "PUT",
      body,
      headers: { "Content-Type": "application/json" },
    }),
    params: { assignmentId: pathAssignmentId, studentId: pathStudentId },
    locals: { user: userId ? { id: userId } : null },
    cookies: {},
  } as never as APIContext;
}

async function responseBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function handlerFor(
  options: {
    authorization?: { status: "unauthenticated" | "non-teacher" | "profile-unavailable" | "authorized-teacher" };
    clientAvailable?: boolean;
    saveImplementation?: () => Promise<unknown>;
  } = {},
) {
  const authorize = vi.fn().mockResolvedValue(options.authorization ?? { status: "authorized-teacher" as const });
  const save = vi.fn(() => (options.saveImplementation ? options.saveImplementation() : Promise.resolve(saved)));
  const handler = createHomeworkFeedbackHandler({
    authorize,
    createSupabaseClient: vi.fn(() => (options.clientAvailable === false ? null : ({} as never))),
    save,
  });
  return { handler, authorize, save };
}

async function errorCode(response: Response): Promise<string> {
  return (await responseBody<{ error: { code: string } }>(response)).error.code;
}

describe("PUT /api/homework/:assignmentId/students/:studentId/feedback", () => {
  it("returns 401 for anonymous callers without saving", async () => {
    const { handler, save } = handlerFor();
    const response = await handler(context(JSON.stringify({ feedback: "Komentarz" }), { userId: null }));

    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("UNAUTHENTICATED");
    expect(save).not.toHaveBeenCalled();
  });

  it.each(["non-teacher", "profile-unavailable"] as const)("returns 403 for %s accounts", async (status) => {
    const { handler, save } = handlerFor({ authorization: { status } });
    const response = await handler(context(JSON.stringify({ feedback: "Komentarz" })));

    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe("FORBIDDEN");
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects invalid IDs and malformed bodies before authorization", async () => {
    const { handler, authorize, save } = handlerFor();
    const requests = [
      context(JSON.stringify({ feedback: "ok" }), { assignmentId: "not-a-uuid" }),
      context(JSON.stringify({ feedback: "ok" }), { studentId: "not-a-uuid" }),
      context("{"),
      context(JSON.stringify({ feedback: "a".repeat(2001) })),
      context(JSON.stringify({ feedback: 42 })),
      context(JSON.stringify({ feedback: null })),
      context(JSON.stringify({ feedback: "ok", teacherId: "x" })),
      context(JSON.stringify({})),
    ];

    for (const request of requests) {
      const response = await handler(request);
      expect(response.status).toBe(400);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await errorCode(response)).toBe("INVALID_REQUEST");
    }
    expect(authorize).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("accepts feedback that fits the limit after trimming surrounding whitespace", async () => {
    const { handler, save } = handlerFor();
    const response = await handler(context(JSON.stringify({ feedback: `  ${"a".repeat(2000)}\n` })));

    expect(response.status).toBe(200);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("saves feedback and returns the stored comment", async () => {
    const { handler, save } = handlerFor();
    const response = await handler(context(JSON.stringify({ feedback: "Dobra praca.\nPopraw zadanie 2." })));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await responseBody(response)).toEqual(saved);
    expect(save).toHaveBeenCalledWith(expect.anything(), assignmentId, studentId, "Dobra praca.\nPopraw zadanie 2.");
  });

  it("clears feedback with a blank body", async () => {
    const { handler, save } = handlerFor({ saveImplementation: () => Promise.resolve({ feedback: null }) });
    const response = await handler(context(JSON.stringify({ feedback: "   " })));

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual({ feedback: null });
    expect(save).toHaveBeenCalledWith(expect.anything(), assignmentId, studentId, "   ");
  });

  it.each([
    { failure: new HomeworkReviewServiceError("INVALID_REQUEST"), status: 400, code: "INVALID_REQUEST" },
    { failure: new HomeworkReviewServiceError("HOMEWORK_UNAVAILABLE"), status: 404, code: "HOMEWORK_UNAVAILABLE" },
    { failure: new HomeworkReviewServiceError("FEEDBACK_NOT_ALLOWED"), status: 409, code: "FEEDBACK_NOT_ALLOWED" },
    { failure: new HomeworkReviewServiceError("DATABASE_UNAVAILABLE"), status: 503, code: "DATABASE_UNAVAILABLE" },
    { failure: new HomeworkReviewServiceError("PERSISTENCE_FAILURE"), status: 500, code: "PERSISTENCE_FAILURE" },
    { failure: new Error("raw SQL detail"), status: 500, code: "PERSISTENCE_FAILURE" },
  ])("maps $code service failures to $status", async ({ failure, status, code }) => {
    const { handler } = handlerFor({ saveImplementation: () => Promise.reject(failure) });
    const response = await handler(context(JSON.stringify({ feedback: "Komentarz" })));

    expect(response.status).toBe(status);
    const text = await response.text();
    expect((JSON.parse(text) as { error: { code: string } }).error.code).toBe(code);
    expect(text).not.toContain("raw SQL detail");
  });

  it("returns 503 when no database client is available and 500 for malformed results", async () => {
    const unavailable = handlerFor({ clientAvailable: false });
    const unavailableResponse = await unavailable.handler(context(JSON.stringify({ feedback: "Komentarz" })));
    expect(unavailableResponse.status).toBe(503);
    expect(await errorCode(unavailableResponse)).toBe("DATABASE_UNAVAILABLE");

    const malformed = handlerFor({
      saveImplementation: () => Promise.resolve({ feedback: { body: "x", updatedAt: "nope" } }),
    });
    const malformedResponse = await malformed.handler(context(JSON.stringify({ feedback: "Komentarz" })));
    expect(malformedResponse.status).toBe(500);
    expect(await errorCode(malformedResponse)).toBe("PERSISTENCE_FAILURE");
  });

  it("composes the handler with the session-bound save RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      success: true,
      data: { feedback: { body: "Super", updated_at: "2026-10-23T08:00:00.000Z" } },
      error: null,
    });
    const handler = createHomeworkFeedbackHandler({
      authorize: vi.fn().mockResolvedValue({ status: "authorized-teacher" }),
      createSupabaseClient: vi.fn(() => ({ rpc }) as never),
    });

    const response = await handler(context(JSON.stringify({ feedback: "Super" })));

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual({
      feedback: { body: "Super", updatedAt: "2026-10-23T08:00:00.000Z" },
    });
    expect(rpc).toHaveBeenCalledWith("save_homework_submission_feedback", {
      p_assignment_id: assignmentId,
      p_student_id: studentId,
      p_body: "Super",
    });
  });
});
