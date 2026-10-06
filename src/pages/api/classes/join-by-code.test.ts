import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";

import { createJoinByCodeHandler } from "./join-by-code";

vi.mock("astro:env/server", () => ({ SUPABASE_KEY: undefined, SUPABASE_URL: undefined }));

function context(body: string, userId: string | null = "student"): APIContext {
  return {
    request: new Request("http://localhost/api/classes/join-by-code", { method: "POST", body }),
    locals: { user: userId ? { id: userId } : null },
    cookies: {},
  } as APIContext;
}

describe("POST /api/classes/join-by-code", () => {
  it.each([false, true])("returns the joined destination for alreadyMember=%s", async (alreadyMember) => {
    const acceptClass = vi
      .fn()
      .mockResolvedValue([{ class_id: "00000000-0000-4000-8000-000000000001", already_member: alreadyMember }]);
    const response = await createJoinByCodeHandler({
      createSupabaseClient: vi.fn(() => ({}) as never),
      acceptClass,
    })(context(JSON.stringify({ classCode: " ab12cd34 " })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirectTo: "/classes/joined", alreadyMember });
    expect(acceptClass).toHaveBeenCalledWith(expect.anything(), "AB12CD34");
  });

  it("requires authentication before creating a database client", async () => {
    const createSupabaseClient = vi.fn();
    const response = await createJoinByCodeHandler({ createSupabaseClient })(
      context(JSON.stringify({ classCode: "AB12CD34" }), null),
    );

    expect(response.status).toBe(401);
    expect(createSupabaseClient).not.toHaveBeenCalled();
  });

  it("hides persistence details when acceptance is unavailable", async () => {
    const response = await createJoinByCodeHandler({
      createSupabaseClient: vi.fn(() => ({}) as never),
      acceptClass: vi.fn().mockRejectedValue(new Error("private database invitation detail")),
    })(context(JSON.stringify({ classCode: "AB12CD34" })));
    const body: unknown = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("private database invitation detail");
  });
});
