import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";

import type { TeacherAuthorizationResult } from "@/lib/services/teacher-authorization";
import { HomeworkAssignmentServiceError } from "@/lib/services/homework-assignments";
import type { HomeworkApiError, HomeworkRosterSuccess } from "@/types";

import { createHomeworkRosterHandler } from "./members";

vi.mock("astro:env/server", () => ({ SUPABASE_KEY: undefined, SUPABASE_URL: undefined }));

const classId = "00000000-0000-4000-8000-000000000001";
const studentId = "00000000-0000-4000-8000-000000000002";
const studentEmail = "student@example.test";
const joinedAt = "2026-10-01T09:00:00.000Z";

function context(pathClassId = classId, userId = "teacher"): APIContext {
  return {
    params: { classId: pathClassId },
    request: new Request(`http://localhost/api/classes/${pathClassId}/members`),
    locals: { user: userId ? { id: userId } : null },
    cookies: {},
  } as unknown as APIContext;
}

async function responseBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function handlerFor(
  options: {
    authorization?: TeacherAuthorizationResult;
    clientAvailable?: boolean;
    roster?: unknown;
  } = {},
) {
  const authorize = vi.fn().mockResolvedValue(options.authorization ?? { status: "authorized-teacher" });
  const loadRoster = vi.fn().mockResolvedValue(options.roster ?? [{ studentId, email: studentEmail, joinedAt }]);
  const handler = createHomeworkRosterHandler({
    authorize,
    createSupabaseClient: vi.fn(() => (options.clientAvailable === false ? null : ({} as never))),
    loadRoster,
  });
  return { handler, authorize, loadRoster };
}

describe("GET /api/classes/[classId]/members", () => {
  it("rejects an invalid class ID before authorization or roster access", async () => {
    const { handler, authorize, loadRoster } = handlerFor();

    const response = await handler(context("not-a-uuid"));

    expect(response.status).toBe(400);
    expect((await responseBody<HomeworkApiError>(response)).error.code).toBe("INVALID_REQUEST");
    expect(authorize).not.toHaveBeenCalled();
    expect(loadRoster).not.toHaveBeenCalled();
  });

  it.each([
    { authorization: { status: "unauthenticated" } as const, status: 401, code: "UNAUTHENTICATED" },
    { authorization: { status: "non-teacher" } as const, status: 403, code: "FORBIDDEN" },
    { authorization: { status: "profile-unavailable" } as const, status: 403, code: "FORBIDDEN" },
  ])("maps $authorization.status before reading the roster", async ({ authorization, status, code }) => {
    const { handler, loadRoster } = handlerFor({ authorization });

    const response = await handler(context(classId, authorization.status === "non-teacher" ? studentId : "teacher"));

    expect(response.status).toBe(status);
    expect((await responseBody<HomeworkApiError>(response)).error.code).toBe(code);
    expect(loadRoster).not.toHaveBeenCalled();
  });

  it("returns normalized current-member email only after teacher authorization", async () => {
    const { handler, loadRoster } = handlerFor();

    const response = await handler(context());

    expect(response.status).toBe(200);
    expect(await responseBody<HomeworkRosterSuccess>(response)).toEqual({
      members: [{ studentId, email: studentEmail, joinedAt }],
    });
    expect(loadRoster).toHaveBeenCalledWith(expect.anything(), classId);
  });

  it("returns an empty roster without exposing class ownership details", async () => {
    const { handler } = handlerFor({ roster: [] });

    const response = await handler(context());

    expect(response.status).toBe(200);
    expect(await responseBody<HomeworkRosterSuccess>(response)).toEqual({ members: [] });
  });

  it("maps ownership and persistence failures to privacy-safe errors", async () => {
    for (const [failure, expectedStatus, expectedCode] of [
      [
        Object.assign(new HomeworkAssignmentServiceError("CLASS_UNAVAILABLE"), { message: "private ownership detail" }),
        404,
        "CLASS_UNAVAILABLE",
      ],
      [new Error(`private persistence detail ${studentEmail}`), 500, "PERSISTENCE_FAILURE"],
    ] as const) {
      const loadRoster = vi.fn().mockRejectedValue(failure);
      const response = await createHomeworkRosterHandler({
        authorize: vi.fn().mockResolvedValue({ status: "authorized-teacher" }),
        createSupabaseClient: vi.fn(() => ({}) as never),
        loadRoster,
      })(context());
      const body = await responseBody<HomeworkApiError>(response);

      expect(response.status).toBe(expectedStatus);
      expect(body.error.code).toBe(expectedCode);
      expect(JSON.stringify(body)).not.toContain("private");
      expect(JSON.stringify(body)).not.toContain(studentEmail);
      expect(JSON.stringify(body)).not.toContain(classId);
    }
  });

  it("rejects malformed adapter output and unavailable database clients", async () => {
    const malformed = await createHomeworkRosterHandler({
      authorize: vi.fn().mockResolvedValue({ status: "authorized-teacher" }),
      createSupabaseClient: vi.fn(() => ({}) as never),
      loadRoster: vi.fn().mockResolvedValue([{ studentId, email: studentEmail, joinedAt, role: "student" }]),
    })(context());
    expect(malformed.status).toBe(500);
    expect((await responseBody<HomeworkApiError>(malformed)).error.code).toBe("PERSISTENCE_FAILURE");

    const { handler, loadRoster } = handlerFor({ clientAvailable: false });
    const unavailable = await handler(context());
    expect(unavailable.status).toBe(503);
    expect((await responseBody<HomeworkApiError>(unavailable)).error.code).toBe("DATABASE_UNAVAILABLE");
    expect(loadRoster).not.toHaveBeenCalled();
  });
});
