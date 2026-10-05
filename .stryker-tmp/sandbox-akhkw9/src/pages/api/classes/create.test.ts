// @ts-nocheck
import type { APIContext, APIRoute } from "astro";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { classSummarySchema } from "@/lib/classes/schemas";
import { createCreateClassHandler } from "./create";

vi.mock("astro:env/server", () => ({ SUPABASE_KEY: undefined, SUPABASE_URL: undefined }));

const classId = "00000000-0000-4000-8000-000000000001";

function context(body: string): APIContext {
  return {
    request: new Request("http://localhost/api/classes/create", { method: "POST", body }),
    locals: { user: { id: "teacher" } },
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
    const handler = createCreateClassHandler({
      authorize: vi.fn().mockResolvedValue({ status }),
      createSupabaseClient: vi.fn(() => ({}) as never),
    });
    expect((await handler(context(JSON.stringify({ name: "  4A  " })))).status).toBe(expectedStatus);
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
