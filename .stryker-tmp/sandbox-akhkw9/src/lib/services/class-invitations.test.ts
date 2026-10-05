// @ts-nocheck
import { describe, expect, it, vi } from "vitest";

import { deliverClassInvitations } from "./class-invitations";

const classId = "00000000-0000-4000-8000-000000000001";
const emails = ["one@example.test", "two@example.test"];

describe("deliverClassInvitations", () => {
  it("keeps input order and continues after delivery failures without exposing tokens", async () => {
    const persistence = {
      loadClassName: vi.fn().mockResolvedValue("4A"),
      prepare: vi.fn().mockResolvedValue([
        { recipientEmail: emails[1], invitationId: "00000000-0000-4000-8000-000000000102", preparation: "refreshed" },
        { recipientEmail: emails[0], invitationId: "00000000-0000-4000-8000-000000000101", preparation: "created" },
      ]),
      recordDelivery: vi.fn().mockResolvedValue(true),
    };
    const send = vi
      .fn()
      .mockResolvedValueOnce({ providerMessageId: "provider-1" })
      .mockRejectedValueOnce(new Error("provider diagnostic"));

    const results = await deliverClassInvitations(
      persistence,
      { classId, emails },
      { apiKey: "key", fromEmail: "from@example.test", appOrigin: "https://app.example.test" },
      {
        createToken: vi.fn().mockReturnValueOnce("token-one").mockReturnValueOnce("token-two"),
        digestToken: (token) => Promise.resolve(`digest-${token}`),
        send,
      },
    );

    expect(results).toEqual([
      { email: emails[0], status: "sent" },
      { email: emails[1], status: "failed" },
    ]);
    expect(JSON.stringify(results)).not.toContain("token-");
    expect(persistence.prepare).toHaveBeenCalledWith(classId, emails, ["digest-token-one", "digest-token-two"]);
    expect(persistence.recordDelivery).toHaveBeenLastCalledWith(
      "00000000-0000-4000-8000-000000000102",
      "digest-token-two",
      "failed",
    );
  });
});
