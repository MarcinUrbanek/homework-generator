// @ts-nocheck
import type { APIContext, APIRoute } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TeacherAuthorizationResult } from "@/lib/services/teacher-authorization";
import type { ExerciseApprovalError, ExerciseApprovalSuccess } from "@/types";

import { createExerciseApproveHandler } from "./approve";

vi.mock("astro:env/server", () => ({
  SUPABASE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_URL: undefined,
}));

const teacherId = "00000000-0000-4000-8000-000000000001";
const verificationId = "00000000-0000-4000-8000-000000000101";
const secondVerificationId = "00000000-0000-4000-8000-000000000102";
const exerciseId = "00000000-0000-4000-8000-000000000201";
const secondExerciseId = "00000000-0000-4000-8000-000000000202";

function contextFor(body: string): APIContext {
  return {
    request: new Request("http://localhost/api/exercises/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
    locals: { user: { id: teacherId } },
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
    approveImplementation?: (client: unknown, verificationIds: string[]) => Promise<unknown>;
  } = {},
) {
  const authorize = vi.fn().mockResolvedValue(options.authorization ?? { status: "authorized-teacher" });
  const approve = vi.fn(
    options.approveImplementation ??
      (() => Promise.resolve([{ verification_id: verificationId, exercise_id: exerciseId, created: true }])),
  );
  const handler = createExerciseApproveHandler({
    authorize,
    createSupabaseClient: vi.fn(() => (options.clientAvailable === false ? null : ({} as never))),
    approve,
  });

  return { handler, authorize, approve };
}

async function invoke(handler: APIRoute, value: unknown = { verificationIds: [verificationId] }): Promise<Response> {
  const body = typeof value === "string" ? value : JSON.stringify(value);
  return handler(contextFor(body));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/exercises/approve", () => {
  it.each([
    { label: "invalid JSON", body: "{" },
    { label: "empty selection", body: { verificationIds: [] } },
    { label: "duplicate IDs", body: { verificationIds: [verificationId, verificationId] } },
    { label: "invalid UUID", body: { verificationIds: ["not-a-uuid"] } },
  ])("returns 400 for $label before authorization", async ({ body }) => {
    const { handler, authorize, approve } = handlerFor();

    const response = await invoke(handler, body);

    expect(response.status).toBe(400);
    expect(await responseBody<ExerciseApprovalError>(response)).toEqual({
      error: { code: "INVALID_REQUEST", message: "Nieprawidłowe dane żądania zatwierdzenia." },
    });
    expect(authorize).not.toHaveBeenCalled();
    expect(approve).not.toHaveBeenCalled();
  });

  it.each([
    { authorization: { status: "unauthenticated" } as const, status: 401, code: "UNAUTHENTICATED" },
    { authorization: { status: "non-teacher" } as const, status: 403, code: "FORBIDDEN" },
    { authorization: { status: "profile-unavailable" } as const, status: 403, code: "FORBIDDEN" },
  ])("maps $authorization.status authorization", async ({ authorization, status, code }) => {
    const { handler, approve } = handlerFor({ authorization });

    const response = await invoke(handler);

    expect(response.status).toBe(status);
    expect((await responseBody<ExerciseApprovalError>(response)).error.code).toBe(code);
    expect(approve).not.toHaveBeenCalled();
  });

  it("returns 503 when the request-scoped database client is unavailable", async () => {
    const { handler, approve } = handlerFor({ clientAvailable: false });

    const response = await invoke(handler);

    expect(response.status).toBe(503);
    expect((await responseBody<ExerciseApprovalError>(response)).error.code).toBe("DATABASE_UNAVAILABLE");
    expect(approve).not.toHaveBeenCalled();
  });

  it("returns ordered mappings for new and replayed approvals", async () => {
    const approveImplementation = () =>
      Promise.resolve([
        { verification_id: verificationId, exercise_id: exerciseId, created: true },
        { verification_id: secondVerificationId, exercise_id: secondExerciseId, created: false },
      ]);
    const { handler, approve } = handlerFor({ approveImplementation });

    const response = await invoke(handler, { verificationIds: [verificationId, secondVerificationId] });

    expect(response.status).toBe(200);
    expect(await responseBody<ExerciseApprovalSuccess>(response)).toEqual({
      mappings: [
        { verificationId, exerciseId, created: true },
        { verificationId: secondVerificationId, exerciseId: secondExerciseId, created: false },
      ],
    });
    expect(approve).toHaveBeenCalledWith(expect.anything(), [verificationId, secondVerificationId]);
  });

  it.each([
    { databaseCode: "22023", status: 422, responseCode: "INVALID_SELECTION" },
    { databaseCode: "42501", status: 403, responseCode: "FORBIDDEN" },
    { databaseCode: "08006", status: 503, responseCode: "DATABASE_UNAVAILABLE" },
    { databaseCode: "PGRST001", status: 503, responseCode: "DATABASE_UNAVAILABLE" },
    { databaseCode: "XX000", status: 500, responseCode: "PERSISTENCE_FAILURE" },
  ])("maps database failure $databaseCode without leaking details", async ({ databaseCode, status, responseCode }) => {
    const approveImplementation = (): Promise<unknown> => {
      return Promise.reject(Object.assign(new Error("sensitive database detail"), { code: databaseCode }));
    };
    const { handler } = handlerFor({ approveImplementation });

    const response = await invoke(handler);
    const body = await responseBody<ExerciseApprovalError>(response);

    expect(response.status).toBe(status);
    expect(body.error.code).toBe(responseCode);
    expect(body.error.message).not.toContain("sensitive");
  });

  it("maps a malformed or partial RPC result to one atomic persistence failure", async () => {
    const approveImplementation = () =>
      Promise.resolve([{ verification_id: verificationId, exercise_id: exerciseId, created: true }]);
    const { handler } = handlerFor({ approveImplementation });

    const response = await invoke(handler, { verificationIds: [verificationId, secondVerificationId] });

    expect(response.status).toBe(500);
    expect((await responseBody<ExerciseApprovalError>(response)).error.code).toBe("PERSISTENCE_FAILURE");
  });
});
