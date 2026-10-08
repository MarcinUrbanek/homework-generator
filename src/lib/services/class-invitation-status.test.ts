import { describe, expect, it } from "vitest";

import { resolveClassInvitationStatus } from "./class-invitation-status";

const validToken = "a".repeat(64);
const recipientEmail = "student@example.test";
const classId = "00000000-0000-4000-8000-000000000001";
const fixedNow = new Date("2026-10-02T12:00:00.000Z");

function createInvitation(
  overrides: Partial<{
    normalizedEmail: string;
    expiresAt: string;
    deliveryState: "sent" | "failed" | "pending";
    classId: string;
    redeemedBy: string | null;
  }> = {},
) {
  return {
    normalizedEmail: recipientEmail,
    expiresAt: "2026-10-03T12:00:00.000Z",
    deliveryState: "sent" as const,
    classId,
    redeemedBy: null,
    ...overrides,
  };
}

function createDependencies(overrides: Partial<Parameters<typeof resolveClassInvitationStatus>[2]> = {}) {
  return {
    digestToken: () => Promise.resolve("private-digest"),
    findInvitation: () => Promise.resolve(createInvitation()),
    now: () => new Date(fixedNow),
    ...overrides,
  };
}

describe("resolveClassInvitationStatus", () => {
  it("distinguishes a missing token from empty or malformed token input", async () => {
    await expect(resolveClassInvitationStatus(null, null)).resolves.toBe("missing");
    await expect(resolveClassInvitationStatus("", null)).resolves.toBe("invalid");
    await expect(resolveClassInvitationStatus("not-a-token", null)).resolves.toBe("invalid");
  });

  it("returns the same privacy-preserving state for unknown or rotated token digests", async () => {
    const dependencies = createDependencies({ findInvitation: () => Promise.resolve(null) });
    await expect(resolveClassInvitationStatus(validToken, null, dependencies)).resolves.toBe("invalid");
  });

  it("treats an invitation expiring at the current instant as expired", async () => {
    const dependencies = createDependencies({
      findInvitation: () => Promise.resolve(createInvitation({ expiresAt: fixedNow.toISOString() })),
    });

    await expect(resolveClassInvitationStatus(validToken, null, dependencies)).resolves.toBe("expired");
  });

  it.each(["failed", "pending"] as const)("does not accept a %s delivery", async (deliveryState) => {
    const dependencies = createDependencies({
      findInvitation: () => Promise.resolve(createInvitation({ deliveryState })),
    });

    await expect(resolveClassInvitationStatus(validToken, null, dependencies)).resolves.toBe("delivery-failed");
  });

  it("returns invalid when token hashing or invitation lookup fails", async () => {
    const digestFailure = createDependencies({
      digestToken: () => Promise.reject(new Error("digest unavailable")),
    });
    const lookupFailure = createDependencies({
      findInvitation: () => Promise.reject(new Error("database unavailable")),
    });

    await expect(resolveClassInvitationStatus(validToken, null, digestFailure)).resolves.toBe("invalid");
    await expect(resolveClassInvitationStatus(validToken, null, lookupFailure)).resolves.toBe("invalid");
  });

  it("returns valid for an unexpired, sent link when no account is signed in", async () => {
    await expect(resolveClassInvitationStatus(validToken, null, createDependencies())).resolves.toBe("valid");
  });

  it("requires a normalized matching email and does not disclose the recipient", async () => {
    const dependencies = createDependencies();

    await expect(resolveClassInvitationStatus(validToken, "other@example.test", dependencies)).resolves.toBe(
      "email-mismatch",
    );
    await expect(resolveClassInvitationStatus(validToken, " STUDENT@example.test ", dependencies)).resolves.toBe(
      "valid",
    );
    const mismatch = await resolveClassInvitationStatus(validToken, "other@example.test", dependencies);
    expect(JSON.stringify(mismatch)).not.toContain(recipientEmail);
  });

  it("returns only a safe class preview to the matching account", async () => {
    const result = await resolveClassInvitationStatus(
      validToken,
      recipientEmail,
      createDependencies({
        findClassPreview: () => Promise.resolve({ name: "Matematyka 4A", teacherDisplayName: "Ada" }),
        findMembership: () => Promise.resolve(false),
      }),
      "student-id",
    );

    expect(result).toEqual({
      status: "ready",
      preview: { name: "Matematyka 4A", teacherDisplayName: "Ada", alreadyMember: false },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(recipientEmail);
    expect(serialized).not.toContain(validToken);
    expect(serialized).not.toContain("private-digest");
    expect(serialized).not.toContain(classId);
  });

  it("returns invalid when class or membership details cannot be loaded", async () => {
    const missingClass = createDependencies({ findClassPreview: () => Promise.resolve(null) });
    const classLookupFailure = createDependencies({
      findClassPreview: () => Promise.reject(new Error("class lookup failed")),
      findMembership: () => Promise.resolve(false),
    });
    const membershipLookupFailure = createDependencies({
      findClassPreview: () => Promise.resolve({ name: "Matematyka 4A", teacherDisplayName: null }),
      findMembership: () => Promise.reject(new Error("membership lookup failed")),
    });

    await expect(resolveClassInvitationStatus(validToken, recipientEmail, missingClass, "student-id")).resolves.toBe(
      "invalid",
    );
    await expect(
      resolveClassInvitationStatus(validToken, recipientEmail, classLookupFailure, "student-id"),
    ).resolves.toBe("invalid");
    await expect(
      resolveClassInvitationStatus(validToken, recipientEmail, membershipLookupFailure, "student-id"),
    ).resolves.toBe("invalid");
  });

  it.each([
    ["student-id", "student-id", true, "already-member"],
    ["other-id", "student-id", false, "invalid"],
  ] as const)(
    "preserves the existing redeemed-invitation result for %s",
    async (redeemedBy, userId, isMember, status) => {
      const result = await resolveClassInvitationStatus(
        validToken,
        recipientEmail,
        createDependencies({
          findInvitation: () => Promise.resolve(createInvitation({ redeemedBy })),
          findClassPreview: () => Promise.resolve({ name: "Matematyka 4A", teacherDisplayName: null }),
          findMembership: () => Promise.resolve(isMember),
        }),
        userId,
      );

      expect(typeof result === "string" ? result : result.status).toBe(status);
    },
  );
});
