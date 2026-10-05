// @ts-nocheck
import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { invitationDeliveryResultSchema } from "@/lib/classes/schemas";
import { ClassInvitationOwnershipError } from "@/lib/services/class-invitations";

import { createInviteStudentsHandler } from "./invite";

vi.mock("astro:env/server", () => ({
  PUBLIC_APP_ORIGIN: undefined,
  RESEND_API_KEY: undefined,
  RESEND_FROM_EMAIL: undefined,
  SUPABASE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_URL: undefined,
}));

const classId = "00000000-0000-4000-8000-000000000001";
const request = { classId, emails: ["One@Example.Test", "two@example.test"] };

function context(body = JSON.stringify(request)): APIContext {
  return {
    request: new Request("http://localhost/api/classes/invite", { method: "POST", body }),
    locals: { user: { id: "teacher" } },
    cookies: {},
  } as APIContext;
}

function configuredHandler(deliver = vi.fn().mockResolvedValue([])) {
  return {
    deliver,
    handler: createInviteStudentsHandler({
      authorize: vi.fn().mockResolvedValue({ status: "authorized-teacher" }),
      createSupabaseClient: vi.fn(() => ({}) as never),
      createWriterClient: vi.fn(() => ({}) as never),
      providerConfig: { apiKey: "key", fromEmail: "from@example.test", appOrigin: "https://app.example.test" },
      createPersistence: vi.fn(() => ({}) as never),
      deliver,
    }),
  };
}

describe("POST /api/classes/invite", () => {
  it("rejects invalid and duplicate batches before authorization", async () => {
    const authorize = vi.fn();
    const handler = createInviteStudentsHandler({ authorize });
    const response = await handler(context(JSON.stringify({ classId, emails: ["a@example.test", "A@example.test"] })));
    expect(response.status).toBe(400);
    expect(authorize).not.toHaveBeenCalled();
  });

  it("returns service unavailable before preparing invitations", async () => {
    const deliver = vi.fn();
    const response = await createInviteStudentsHandler({
      authorize: vi.fn().mockResolvedValue({ status: "authorized-teacher" }),
      createSupabaseClient: vi.fn(() => ({}) as never),
      createWriterClient: vi.fn(() => ({}) as never),
      deliver,
      providerConfig: {},
    })(context());
    expect(response.status).toBe(503);
    expect(deliver).not.toHaveBeenCalled();
  });

  it("returns normalized ordered results without bearer tokens", async () => {
    const { handler, deliver } = configuredHandler(
      vi.fn().mockResolvedValue([
        { email: "one@example.test", status: "sent" },
        { email: "two@example.test", status: "failed" },
      ]),
    );
    const response = await handler(context());
    const body: unknown = await response.json();
    expect(response.status).toBe(200);
    expect(z.object({ results: invitationDeliveryResultSchema.array() }).parse(body)).toEqual({
      results: [
        { email: "one@example.test", status: "sent" },
        { email: "two@example.test", status: "failed" },
      ],
    });
    expect(JSON.stringify(body)).not.toContain("token");
    expect(deliver).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ emails: ["one@example.test", "two@example.test"] }),
      expect.anything(),
    );
  });

  it("maps class ownership failures to forbidden", async () => {
    const { handler } = configuredHandler(vi.fn().mockRejectedValue(new ClassInvitationOwnershipError()));
    expect((await handler(context())).status).toBe(403);
  });
});
