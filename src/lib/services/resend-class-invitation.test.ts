import { describe, expect, it, vi } from "vitest";

import {
  ResendClassInvitationError,
  type ResendEmailClient,
  sendResendClassInvitation,
} from "./resend-class-invitation";

const config = {
  apiKey: "test-key",
  fromEmail: "Klasy <classes@example.test>",
  appOrigin: "https://app.example.test/",
};

describe("sendResendClassInvitation", () => {
  it("sends a Polish escaped email with a stable invitation URL", async () => {
    const send = vi
      .fn<ResendEmailClient["emails"]["send"]>()
      .mockResolvedValue({ data: { id: "provider-message-id" }, error: null });

    await expect(
      sendResendClassInvitation(
        { className: "4A <math>", recipientEmail: "student@example.test", token: "raw-token" },
        config,
        { client: { emails: { send } }, clock: () => new Date("2026-10-02T12:00:00.000Z") },
      ),
    ).resolves.toEqual({ providerMessageId: "provider-message-id" });

    const sentMessage = send.mock.calls[0]?.[0];
    expect(sentMessage.to).toEqual(["student@example.test"]);
    expect(sentMessage.html).toContain("4A &lt;math&gt;");
    expect(sentMessage.text).toContain("https://app.example.test/classes/join?token=raw-token");
  });

  it("classifies provider failures without exposing their details", async () => {
    const send = vi
      .fn<ResendEmailClient["emails"]["send"]>()
      .mockRejectedValue(new Error("recipient-specific provider diagnostic"));

    await expect(
      sendResendClassInvitation(
        { className: "4A", recipientEmail: "student@example.test", token: "raw-token" },
        config,
        { client: { emails: { send } } },
      ),
    ).rejects.toEqual(new ResendClassInvitationError("PROVIDER_FAILURE"));
  });
});
