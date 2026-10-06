import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";

import { createDisplayNameHandler } from "./display-name";

vi.mock("astro:env/server", () => ({ SUPABASE_KEY: undefined, SUPABASE_URL: undefined }));

function context(body: string, userId = "teacher"): APIContext {
  return {
    request: new Request("http://localhost/api/profile/display-name", { method: "POST", body }),
    locals: { user: { id: userId } },
    cookies: {},
  } as APIContext;
}

describe("POST /api/profile/display-name", () => {
  it("trims and returns the teacher display name", async () => {
    const updateDisplayName = vi.fn().mockResolvedValue("Ada Teacher");
    const response = await createDisplayNameHandler({
      authorize: vi.fn().mockResolvedValue({ status: "authorized-teacher" }),
      createSupabaseClient: vi.fn(() => ({}) as never),
      updateDisplayName,
    })(context(JSON.stringify({ displayName: "  Ada Teacher  " })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ displayName: "Ada Teacher" });
    expect(updateDisplayName).toHaveBeenCalledWith(expect.anything(), "Ada Teacher");
  });

  it("denies non-teachers before updating the profile", async () => {
    const updateDisplayName = vi.fn();
    const response = await createDisplayNameHandler({
      authorize: vi.fn().mockResolvedValue({ status: "non-teacher" }),
      createSupabaseClient: vi.fn(() => ({}) as never),
      updateDisplayName,
    })(context(JSON.stringify({ displayName: "Student" }), "student"));

    expect(response.status).toBe(403);
    expect(updateDisplayName).not.toHaveBeenCalled();
  });

  it.each(["   ", "x".repeat(81)])("rejects invalid display names before authorization", async (displayName) => {
    const authorize = vi.fn();
    const response = await createDisplayNameHandler({ authorize })(context(JSON.stringify({ displayName })));

    expect(response.status).toBe(400);
    expect(authorize).not.toHaveBeenCalled();
  });
});
