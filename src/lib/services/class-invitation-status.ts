import { z } from "zod";

export type ClassInvitationStatus =
  "missing" | "invalid" | "expired" | "delivery-failed" | "valid" | "email-mismatch" | "ready";

interface InvitationRecord {
  normalizedEmail: string;
  expiresAt: string;
  deliveryState: "sent" | "failed" | "pending";
}

export interface ClassInvitationStatusDependencies {
  digestToken?: (token: string) => Promise<string>;
  findInvitation?: (tokenDigest: string) => Promise<InvitationRecord | null>;
  now?: () => Date;
}

const tokenPattern = /^[a-f0-9]{64}$/;
const invitationRecordSchema = z
  .object({
    normalized_email: z.email(),
    expires_at: z.iso.datetime({ offset: true }),
    delivery_state: z.enum(["sent", "failed", "pending"]),
  })
  .strict();

async function defaultDigestToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function findInvitation(tokenDigest: string): Promise<InvitationRecord | null> {
  const { createServiceClient } = await import("@/lib/supabase");
  const client = createServiceClient();
  if (!client) return null;

  const response = await client
    .from("class_invitations")
    .select("normalized_email,expires_at,delivery_state")
    .eq("token_digest", tokenDigest)
    .maybeSingle();
  if (response.error) throw new Error("Invitation lookup failed");
  const parsed = invitationRecordSchema.nullable().safeParse(response.data);
  if (!parsed.success || !parsed.data) return null;
  return {
    normalizedEmail: parsed.data.normalized_email,
    expiresAt: parsed.data.expires_at,
    deliveryState: parsed.data.delivery_state,
  };
}

export async function resolveClassInvitationStatus(
  token: string | null,
  authenticatedEmail: string | null,
  dependencies: ClassInvitationStatusDependencies = {},
): Promise<ClassInvitationStatus> {
  if (token === null) return "missing";
  if (!tokenPattern.test(token)) return "invalid";

  const digestToken = dependencies.digestToken ?? defaultDigestToken;
  const lookup = dependencies.findInvitation ?? findInvitation;
  let invitation: InvitationRecord | null;
  try {
    invitation = await lookup(await digestToken(token));
  } catch {
    return "invalid";
  }

  // Rotated and unknown token digests intentionally share this state.
  if (!invitation) return "invalid";
  if (new Date(invitation.expiresAt).getTime() <= (dependencies.now ?? (() => new Date()))().getTime())
    return "expired";
  if (invitation.deliveryState !== "sent") return "delivery-failed";
  if (!authenticatedEmail) return "valid";
  return authenticatedEmail.trim().toLowerCase() === invitation.normalizedEmail ? "ready" : "email-mismatch";
}
