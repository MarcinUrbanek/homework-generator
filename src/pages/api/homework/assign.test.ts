import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";

import type { TeacherAuthorizationResult } from "@/lib/services/teacher-authorization";
import { HomeworkAssignmentServiceError } from "@/lib/services/homework-assignments";
import type { HomeworkApiError, HomeworkAssignmentRequest, HomeworkAssignmentSuccess } from "@/types";

import { createHomeworkAssignmentHandler } from "./assign";

vi.mock("astro:env/server", () => ({
  SUPABASE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_URL: undefined,
}));

const classId = "00000000-0000-4000-8000-000000000001";
const studentId = "00000000-0000-4000-8000-000000000002";
const departedStudentId = "00000000-0000-4000-8000-000000000003";
const assignmentId = "00000000-0000-4000-8000-000000000004";
const idempotencyKey = "00000000-0000-4000-8000-000000000005";
const exerciseId = "00000000-0000-4000-8000-000000000006";
const privateAnswer = "private-canonical-answer";

const requestBody: HomeworkAssignmentRequest = {
  classId,
  studentIds: [studentId, departedStudentId],
  title: "  Powtórka  ",
  topic: "addition-subtraction",
  difficulty: "easy",
  exerciseCount: 2,
  idempotencyKey,
};

const assignment: HomeworkAssignmentSuccess = {
  assignmentId,
  title: "Powtórka",
  createdAt: "2026-10-08T12:00:00.000Z",
  assignedCount: 1,
  excludedStudentIds: [departedStudentId],
  excludedCount: 1,
  replayed: false,
};

function context(body: string, userId = "teacher"): APIContext {
  return {
    request: new Request("http://localhost/api/homework/assign", { method: "POST", body }),
    locals: { user: userId ? { id: userId } : null },
    cookies: {},
  } as APIContext;
}

async function responseBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function handlerFor(
  options: {
    authorization?: TeacherAuthorizationResult;
    clientAvailable?: boolean;
    assignment?: unknown;
    assignImplementation?: (request: HomeworkAssignmentRequest) => Promise<unknown>;
  } = {},
) {
  const authorize = vi.fn().mockResolvedValue(options.authorization ?? { status: "authorized-teacher" });
  const assign = vi.fn((_: unknown, request: HomeworkAssignmentRequest) =>
    options.assignImplementation
      ? options.assignImplementation(request)
      : Promise.resolve(options.assignment ?? assignment),
  );
  const handler = createHomeworkAssignmentHandler({
    authorize,
    createSupabaseClient: vi.fn(() => (options.clientAvailable === false ? null : ({} as never))),
    assign,
  });
  return { handler, authorize, assign };
}

describe("POST /api/homework/assign", () => {
  it("rejects malformed, duplicate, and out-of-range requests before authorization", async () => {
    const { handler, authorize, assign } = handlerFor();
    for (const body of [
      "{",
      JSON.stringify({ ...requestBody, studentIds: [studentId, studentId] }),
      JSON.stringify({ ...requestBody, exerciseCount: 6 }),
      JSON.stringify({ ...requestBody, idempotencyKey: "not-a-uuid" }),
    ]) {
      const response = await handler(context(body));
      expect(response.status).toBe(400);
      expect((await responseBody<HomeworkApiError>(response)).error.code).toBe("INVALID_REQUEST");
    }
    expect(authorize).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it.each([
    { authorization: { status: "unauthenticated" } as const, status: 401, code: "UNAUTHENTICATED" },
    { authorization: { status: "non-teacher" } as const, status: 403, code: "FORBIDDEN" },
    { authorization: { status: "profile-unavailable" } as const, status: 403, code: "FORBIDDEN" },
  ])("maps $authorization.status without assignment work", async ({ authorization, status, code }) => {
    const { handler, assign } = handlerFor({ authorization });

    const response = await handler(
      context(JSON.stringify(requestBody), authorization.status === "non-teacher" ? studentId : "teacher"),
    );

    expect(response.status).toBe(status);
    const body = await responseBody<HomeworkApiError>(response);
    expect(body.error.code).toBe(code);
    expect(assign).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain(classId);
    expect(JSON.stringify(body)).not.toContain(studentId);
  });

  it("creates an assignment and reports departed recipients without exposing exercises or answers", async () => {
    const { handler, assign } = handlerFor();

    const response = await handler(context(JSON.stringify(requestBody)));
    const body = await responseBody<HomeworkAssignmentSuccess>(response);

    expect(response.status).toBe(201);
    expect(body).toEqual(assignment);
    expect(assign).toHaveBeenCalledWith(expect.anything(), { ...requestBody, title: "Powtórka" });
    const serialized = JSON.stringify(body);
    for (const privateValue of [studentEmailFixture, exerciseId, privateAnswer, "exerciseIds", "canonicalAnswer"]) {
      expect(serialized).not.toContain(privateValue);
    }
    expect(body.excludedStudentIds).toEqual([departedStudentId]);
  });

  it("normalizes a blank title and keeps the same idempotency key across retries", async () => {
    const retryAssignment = { ...assignment, replayed: true };
    const assignImplementation = vi.fn().mockResolvedValueOnce(assignment).mockResolvedValueOnce(retryAssignment);
    const { handler, assign } = handlerFor({ assignImplementation });
    const body = JSON.stringify({ ...requestBody, title: "   " });

    expect((await handler(context(body))).status).toBe(201);
    expect((await handler(context(body))).status).toBe(200);
    expect(assign).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ title: undefined, idempotencyKey }),
    );
    expect(assign).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ title: undefined, idempotencyKey }),
    );
  });

  it("returns actionable required and available pool counts without persistence", async () => {
    const { handler } = handlerFor({
      assignImplementation: () => Promise.reject(new HomeworkAssignmentServiceError("INSUFFICIENT_POOL", 4, 3)),
    });

    const response = await handler(context(JSON.stringify(requestBody)));
    const body = await responseBody<HomeworkApiError>(response);

    expect(response.status).toBe(422);
    expect(body.error).toEqual({
      code: "INSUFFICIENT_POOL",
      message: "Zatwierdzona pula zadań jest zbyt mała dla wybranej liczby uczniów.",
      requiredExerciseCount: 4,
      availableExerciseCount: 3,
    });
    expect(JSON.stringify(body)).not.toContain(classId);
    expect(JSON.stringify(body)).not.toContain(privateAnswer);
  });

  it.each([
    { code: "CLASS_UNAVAILABLE" as const, status: 404 },
    { code: "EMPTY_ELIGIBLE_ROSTER" as const, status: 409 },
    { code: "DATABASE_UNAVAILABLE" as const, status: 503 },
    { code: "PERSISTENCE_FAILURE" as const, status: 500 },
  ])("maps $code to a stable privacy-safe response", async ({ code, status }) => {
    const { handler } = handlerFor({
      assignImplementation: () => Promise.reject(new HomeworkAssignmentServiceError(code, undefined, undefined)),
    });

    const response = await handler(context(JSON.stringify(requestBody)));
    const body = await responseBody<HomeworkApiError>(response);

    expect(response.status).toBe(status);
    expect(body.error.code).toBe(code);
    expect(JSON.stringify(body)).not.toContain(classId);
    expect(JSON.stringify(body)).not.toContain(studentId);
    expect(JSON.stringify(body)).not.toContain("Error");
  });

  it("rejects malformed adapter output and an unavailable database client", async () => {
    const malformed = handlerFor({ assignment: { ...assignment, exerciseIds: [exerciseId] } });
    const malformedResponse = await malformed.handler(context(JSON.stringify(requestBody)));
    expect(malformedResponse.status).toBe(500);
    expect((await responseBody<HomeworkApiError>(malformedResponse)).error.code).toBe("PERSISTENCE_FAILURE");

    const unavailable = handlerFor({ clientAvailable: false });
    const unavailableResponse = await unavailable.handler(context(JSON.stringify(requestBody)));
    expect(unavailableResponse.status).toBe(503);
    expect((await responseBody<HomeworkApiError>(unavailableResponse)).error.code).toBe("DATABASE_UNAVAILABLE");
    expect(unavailable.assign).not.toHaveBeenCalled();
  });
});

const studentEmailFixture = "student@example.test";
