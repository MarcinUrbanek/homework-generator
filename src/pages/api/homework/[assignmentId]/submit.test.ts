import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";

import { StudentHomeworkServiceError } from "@/lib/services/student-homework";
import type { StudentHomeworkSubmitRequest, StudentHomeworkSubmitSuccess } from "@/types";

import { createStudentHomeworkSubmitHandler } from "./submit";

vi.mock("astro:env/server", () => ({
  SUPABASE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_URL: undefined,
}));

const assignmentId = "00000000-0000-4000-8000-000000000001";
const canonicalAnswer = "private-canonical-answer";
const request: StudentHomeworkSubmitRequest = {
  answers: [
    { position: 1, answer: " 0001 " },
    { position: 2, answer: null },
  ],
};
const firstSubmission: StudentHomeworkSubmitSuccess = {
  kind: "scored",
  submissionId: "00000000-0000-4000-8000-000000000002",
  submittedAt: "2026-10-09T11:00:00.000Z",
  correctCount: 1,
  assignedCount: 2,
  passed: true,
  answers: [
    { position: 1, answer: " 0001 ", isCorrect: true },
    { position: 2, answer: null, isCorrect: false },
  ],
  replayed: false,
};

function context(body: string, userId: string | null = "student", pathAssignmentId: string = assignmentId): APIContext {
  return {
    request: new Request(`http://localhost/api/homework/${pathAssignmentId}/submit`, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
    }),
    params: { assignmentId: pathAssignmentId },
    locals: { user: userId ? { id: userId } : null },
    cookies: {},
  } as never as APIContext;
}

async function responseBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function handlerFor(
  options: {
    authorization?: { status: "not-student" | "profile-unavailable" | "authorized-student" };
    clientAvailable?: boolean;
    result?: unknown;
    submitImplementation?: (id: string, request: StudentHomeworkSubmitRequest) => Promise<unknown>;
  } = {},
) {
  const authorize = vi.fn().mockResolvedValue(options.authorization ?? { status: "authorized-student" as const });
  const submit = vi.fn((_: unknown, id: string, submittedRequest: StudentHomeworkSubmitRequest) =>
    options.submitImplementation
      ? options.submitImplementation(id, submittedRequest)
      : Promise.resolve(options.result ?? firstSubmission),
  );
  const handler = createStudentHomeworkSubmitHandler({
    authorize,
    createSupabaseClient: vi.fn(() => (options.clientAvailable === false ? null : ({} as never))),
    submit,
  });
  return { handler, authorize, submit };
}

describe("POST /api/homework/:assignmentId/submit", () => {
  it("rejects malformed, unsupported, extra-field, and out-of-range requests before authorization", async () => {
    const { handler, authorize, submit } = handlerFor();
    const bodies = [
      "{",
      JSON.stringify({ answers: [{ position: 1, answer: "two" }] }),
      JSON.stringify({ ...request, grade: 4 }),
      JSON.stringify({ answers: [{ position: 1, answer: "1", isCorrect: true }] }),
      JSON.stringify({ answers: [{ position: 1, answer: "+1" }] }),
      JSON.stringify({ answers: [{ position: 6, answer: "1" }] }),
      JSON.stringify({
        answers: [
          { position: 1, answer: "1" },
          { position: 1, answer: "2" },
        ],
      }),
    ];

    for (const body of bodies) {
      const response = await handler(context(body));
      expect(response.status).toBe(400);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect((await responseBody<{ error: { code: string } }>(response)).error.code).toBe("INVALID_REQUEST");
    }
    expect(authorize).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it("rejects invalid assignment IDs before parsing or authenticating", async () => {
    const { handler, authorize, submit } = handlerFor();
    const response = await handler(context("{", "student", "not-a-uuid"));

    expect(response.status).toBe(400);
    expect((await responseBody<{ error: { code: string } }>(response)).error.code).toBe("INVALID_REQUEST");
    expect(authorize).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it("rejects anonymous callers and non-students without submitting", async () => {
    const anonymous = handlerFor();
    const anonymousResponse = await anonymous.handler(context(JSON.stringify(request), null));
    expect(anonymousResponse.status).toBe(401);
    expect((await responseBody<{ error: { code: string } }>(anonymousResponse)).error.code).toBe("UNAUTHENTICATED");
    expect(anonymous.submit).not.toHaveBeenCalled();

    const forbidden = handlerFor({ authorization: { status: "not-student" } });
    const forbiddenResponse = await forbidden.handler(context(JSON.stringify(request)));
    expect(forbiddenResponse.status).toBe(403);
    expect((await responseBody<{ error: { code: string } }>(forbiddenResponse)).error.code).toBe("FORBIDDEN");
    expect(forbidden.submit).not.toHaveBeenCalled();
  });

  it("returns a first final submission with 201 and only raw answers and correctness", async () => {
    const { handler, submit } = handlerFor();
    const response = await handler(context(JSON.stringify(request)));
    const body = await responseBody<StudentHomeworkSubmitSuccess>(response);

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body).toEqual(firstSubmission);
    expect(submit).toHaveBeenCalledWith(expect.anything(), assignmentId, request);
    const serialized = JSON.stringify(body);
    for (const privateValue of [
      canonicalAnswer,
      "normalized_answer",
      "canonicalAnswer",
      "exercise_id",
      "recipient_id",
      "verifier",
      "classmate",
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
    expect(serialized).toContain('"answer":" 0001 "');
  });

  it("returns an equivalent replay with 200 and the original result", async () => {
    const replay = { ...firstSubmission, replayed: true };
    const submitImplementation = vi.fn().mockResolvedValueOnce(firstSubmission).mockResolvedValueOnce(replay);
    const { handler, submit } = handlerFor({ submitImplementation });

    expect((await handler(context(JSON.stringify(request)))).status).toBe(201);
    const replayResponse = await handler(context(JSON.stringify(request)));

    expect(replayResponse.status).toBe(200);
    expect(await responseBody<StudentHomeworkSubmitSuccess>(replayResponse)).toEqual(replay);
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("returns quarantined historical retries as prompt-free result-only data", async () => {
    const historicalRetry: StudentHomeworkSubmitSuccess = {
      ...firstSubmission,
      kind: "result-only",
      replayed: true,
    };
    const { handler } = handlerFor({ result: historicalRetry });

    const response = await handler(context(JSON.stringify(request)));
    const body = await responseBody<StudentHomeworkSubmitSuccess>(response);

    expect(response.status).toBe(200);
    expect(body).toEqual(historicalRetry);
    expect(body.kind).toBe("result-only");
    expect(JSON.stringify(body)).not.toMatch(/prompt|canonical_answer|authority/i);
  });

  it("composes the handler with the session-bound scoring RPC adapter", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        kind: "scored",
        submission_id: firstSubmission.submissionId,
        submitted_at: firstSubmission.submittedAt,
        correct_count: 1,
        assigned_count: 2,
        passed: true,
        answers: [
          { position: 1, answer: " 0001 ", normalized_answer: "1", is_correct: true },
          { position: 2, answer: null, normalized_answer: null, is_correct: false },
        ],
        replayed: false,
      },
      error: null,
    });
    const handler = createStudentHomeworkSubmitHandler({
      authorize: vi.fn().mockResolvedValue({ status: "authorized-student" }),
      createSupabaseClient: vi.fn(() => ({ rpc }) as never),
    });

    const response = await handler(context(JSON.stringify(request)));

    expect(response.status).toBe(201);
    expect(await responseBody(response)).toEqual(firstSubmission);
    expect(rpc).toHaveBeenCalledWith("submit_student_homework", {
      p_assignment_id: assignmentId,
      p_answers: request.answers,
    });
  });

  it.each([
    { failure: new StudentHomeworkServiceError("HOMEWORK_UNAVAILABLE"), status: 404, code: "HOMEWORK_UNAVAILABLE" },
    { failure: new StudentHomeworkServiceError("SUBMISSION_CONFLICT"), status: 409, code: "SUBMISSION_CONFLICT" },
    { failure: new StudentHomeworkServiceError("SCORING_UNAVAILABLE"), status: 503, code: "SCORING_UNAVAILABLE" },
    { failure: new StudentHomeworkServiceError("DATABASE_UNAVAILABLE"), status: 503, code: "DATABASE_UNAVAILABLE" },
    {
      failure: Object.assign(new Error("raw SQL detail"), { code: "XX000" }),
      status: 500,
      code: "PERSISTENCE_FAILURE",
    },
  ])("maps $code to a stable non-disclosing result", async ({ failure, status, code }) => {
    const { handler } = handlerFor({
      submitImplementation: () => Promise.reject(failure),
    });
    const response = await handler(context(JSON.stringify(request)));
    const body = await responseBody<{ error: { code: string } }>(response);

    expect(response.status).toBe(status);
    expect(body.error.code).toBe(code);
    expect(JSON.stringify(body)).not.toContain("raw SQL detail");
    expect(JSON.stringify(body)).not.toContain(assignmentId);
  });

  it("rejects malformed results and an unavailable session client", async () => {
    const malformed = handlerFor({
      result: { ...firstSubmission, normalizedAnswer: canonicalAnswer },
    });
    const malformedResponse = await malformed.handler(context(JSON.stringify(request)));
    expect(malformedResponse.status).toBe(500);
    expect((await responseBody<{ error: { code: string } }>(malformedResponse)).error.code).toBe("PERSISTENCE_FAILURE");

    const unavailable = handlerFor({ clientAvailable: false });
    const unavailableResponse = await unavailable.handler(context(JSON.stringify(request)));
    expect(unavailableResponse.status).toBe(503);
    expect((await responseBody<{ error: { code: string } }>(unavailableResponse)).error.code).toBe(
      "DATABASE_UNAVAILABLE",
    );
    expect(unavailable.submit).not.toHaveBeenCalled();
  });
});
