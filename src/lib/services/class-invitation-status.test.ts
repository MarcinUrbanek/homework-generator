import { describe, expect, it } from "vitest";

import { resolveClassInvitationStatus } from "./class-invitation-status";

const validToken = "a".repeat(64);
const now = () => new Date("2026-10-02T12:00:00.000Z");

describe("resolveClassInvitationStatus", () => {
  it.each([
    [null, "missing"],
    ["not-a-token", "invalid"],
  ] as const)("returns %s for a %s token", async (token, expected) => {
    await expect(resolveClassInvitationStatus(token, null)).resolves.toBe(expected);
  });

  it("treats unknown and rotated prior token digests as the same invalid state", async () => {
    const dependencies = {
      digestToken: () => Promise.resolve("digest"),
      findInvitation: () => Promise.resolve(null),
    };
    await expect(resolveClassInvitationStatus(validToken, null, dependencies)).resolves.toBe("invalid");
  });

  it("classifies expired and failed deliveries without exposing recipient data", async () => {
    await expect(
      resolveClassInvitationStatus(validToken, null, {
        digestToken: () => Promise.resolve("digest"),
        findInvitation: () =>
          Promise.resolve({
            normalizedEmail: "student@example.test",
            expiresAt: "2026-10-01T12:00:00.000Z",
            deliveryState: "sent" as const,
          }),
        now,
      }),
    ).resolves.toBe("expired");
    await expect(
      resolveClassInvitationStatus(validToken, null, {
        digestToken: () => Promise.resolve("digest"),
        findInvitation: () =>
          Promise.resolve({
            normalizedEmail: "student@example.test",
            expiresAt: "2026-10-03T12:00:00.000Z",
            deliveryState: "failed" as const,
          }),
        now,
      }),
    ).resolves.toBe("delivery-failed");
  });

  it("distinguishes unauthenticated, matching, and mismatched accounts without returning an email", async () => {
    const dependencies = {
      digestToken: () => Promise.resolve("digest"),
      findInvitation: () =>
        Promise.resolve({
          normalizedEmail: "student@example.test",
          expiresAt: "2026-10-03T12:00:00.000Z",
          deliveryState: "sent" as const,
        }),
      now,
    };
    await expect(resolveClassInvitationStatus(validToken, null, dependencies)).resolves.toBe("valid");
    await expect(resolveClassInvitationStatus(validToken, "other@example.test", dependencies)).resolves.toBe(
      "email-mismatch",
    );
    await expect(resolveClassInvitationStatus(validToken, " STUDENT@example.test ", dependencies)).resolves.toBe(
      "ready",
    );
  });
});
