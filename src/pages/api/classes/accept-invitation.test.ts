import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";

import { createAcceptInvitationHandler } from "./accept-invitation";

vi.mock("astro:env/server", () => ({ SUPABASE_KEY: undefined, SUPABASE_URL: undefined }));

const token = "a".repeat(64);

function context(body: string, userId: string | null = "student"): APIContext {
  return {
    request: new Request("http://localhost/api/classes/accept-invitation", { method: "POST", body }),
    locals: { user: userId ? { id: userId } : null },
    cookies: {},
  } as APIContext;
}

describe("POST /api/classes/accept-invitation", () => {
  it.each([false, true])("returns joined destination for alreadyMember=%s", async (alreadyMember) => {
    const digestToken = vi.fn().mockResolvedValue("d".repeat(64));
    const acceptInvitation = vi
      .fn()
      .mockResolvedValue([{ class_id: "00000000-0000-4000-8000-000000000001", already_member: alreadyMember }]);
    const response = await createAcceptInvitationHandler({
      createSupabaseClient: vi.fn(() => ({}) as never),
      digestToken,
      acceptInvitation,
    })(context(JSON.stringify({ token })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirectTo: "/classes/joined", alreadyMember });
    expect(digestToken).toHaveBeenCalledWith(token);
    expect(acceptInvitation).toHaveBeenCalledWith(expect.anything(), "d".repeat(64));
  });

  it("requires authentication before digesting or accepting an invitation", async () => {
    const digestToken = vi.fn();
    const acceptInvitation = vi.fn();
    const response = await createAcceptInvitationHandler({ digestToken, acceptInvitation })(
      context(JSON.stringify({ token }), null),
    );

    expect(response.status).toBe(401);
    expect(digestToken).not.toHaveBeenCalled();
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it("does not disclose token or persistence details on rejection", async () => {
    const response = await createAcceptInvitationHandler({
      createSupabaseClient: vi.fn(() => ({}) as never),
      digestToken: vi.fn().mockResolvedValue("d".repeat(64)),
      acceptInvitation: vi.fn().mockRejectedValue(new Error("private recipient and token detail")),
    })(context(JSON.stringify({ token })));
    const body: unknown = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain(token);
    expect(JSON.stringify(body)).not.toContain("private recipient and token detail");
  });
});
