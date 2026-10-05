import type { APIContext, APIRoute } from "astro";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { classApiErrorSchema, classSummarySchema } from "@/lib/classes/schemas";
import { createCreateClassHandler } from "./create";

vi.mock("astro:env/server", () => ({ SUPABASE_KEY: undefined, SUPABASE_URL: undefined }));

const classId = "00000000-0000-4000-8000-000000000001";
const studentId = "student-without-teacher-role";

function context(body: string, userId = "teacher"): APIContext {
  return {
    request: new Request("http://localhost/api/classes/create", { method: "POST", body }),
    locals: { user: { id: userId } },
    cookies: {},
  } as APIContext;
}

describe("POST /api/classes/create", () => {
  it("rejects invalid class names before authorization", async () => {
    const authorize = vi.fn();
    const handler = createCreateClassHandler({ authorize });
    const response = await handler(context(JSON.stringify({ name: "   " })));
    expect(response.status).toBe(400);
    expect(authorize).not.toHaveBeenCalled();
  });

  it.each([
    ["unauthenticated", 401],
    ["non-teacher", 403],
    ["profile-unavailable", 403],
  ] as const)("maps %s authorization", async (status, expectedStatus) => {
    const createClass = vi.fn().mockResolvedValue([{ class_id: classId, class_code: "PRIVATE01" }]);
    const handler = createCreateClassHandler({
      authorize: vi.fn().mockResolvedValue({ status }),
      createSupabaseClient: vi.fn(() => ({}) as never),
      createClass,
    });
    const response = await handler(
      context(JSON.stringify({ name: "Private 4A class" }), status === "non-teacher" ? studentId : "teacher"),
    );
    expect(response.status).toBe(expectedStatus);
    expect(createClass).not.toHaveBeenCalled();

    if (status === "non-teacher") {
      const body = classApiErrorSchema.parse(await response.json());
      expect(body).toEqual({
        error: { code: "FORBIDDEN", message: "Tworzenie klas jest dostępne tylko dla nauczycieli." },
      });
      expect(JSON.stringify(body)).not.toContain("Private 4A class");
      expect(JSON.stringify(body)).not.toContain(classId);
      expect(JSON.stringify(body)).not.toContain("PRIVATE01");
    }
  });

  it("uses the production authorizer for a signed-in student without a teacher role", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const teacherRoleFilter = vi.fn(() => ({ maybeSingle }));
    const userIdFilter = vi.fn(() => ({ eq: teacherRoleFilter }));
    const select = vi.fn(() => ({ eq: userIdFilter }));
    const from = vi.fn(() => ({ select }));
    const createClass = vi.fn();
    const handler = createCreateClassHandler({
      createSupabaseClient: vi.fn(() => ({ from }) as never),
      createClass,
    });

    const response = await handler(context(JSON.stringify({ name: "Private 4A class" }), studentId));

    expect(response.status).toBe(403);
    expect(classApiErrorSchema.parse(await response.json())).toEqual({
      error: { code: "FORBIDDEN", message: "Tworzenie klas jest dostępne tylko dla nauczycieli." },
    });
    expect(from).toHaveBeenCalledWith("profile_roles");
    expect(select).toHaveBeenCalledWith("role");
    expect(userIdFilter).toHaveBeenCalledWith("user_id", studentId);
    expect(teacherRoleFilter).toHaveBeenCalledWith("role", "teacher");
    expect(createClass).not.toHaveBeenCalled();
  });

  it("creates a trimmed class through the authenticated RPC", async () => {
    const createClass = vi.fn().mockResolvedValue([{ class_id: classId, class_code: "AB12CD34" }]);
    const handler: APIRoute = createCreateClassHandler({
      authorize: vi.fn().mockResolvedValue({ status: "authorized-teacher" }),
      createSupabaseClient: vi.fn(() => ({}) as never),
      createClass,
    });
    const response = await handler(context(JSON.stringify({ name: "  4A  " })));
    expect(response.status).toBe(201);
    expect(createClass).toHaveBeenCalledWith(expect.anything(), "4A");
    const body: unknown = await response.json();
    expect(z.object({ class: classSummarySchema }).parse(body).class).toMatchObject({
      id: classId,
      name: "4A",
      classCode: "AB12CD34",
    });
  });
});
