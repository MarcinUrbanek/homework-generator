import { sendResendClassInvitation, type ResendClassInvitationConfig } from "@/lib/services/resend-class-invitation";
import { digestClassInvitationToken } from "@/lib/classes/invitation-token";
import type { InvitationDeliveryResult } from "@/types";

export interface PreparedInvitation {
  recipientEmail: string;
  invitationId: string;
  preparation: "created" | "refreshed";
}

export interface ClassInvitationPersistence {
  loadClassName: (classId: string) => Promise<string | null>;
  prepare: (classId: string, emails: string[], tokenDigests: string[]) => Promise<PreparedInvitation[]>;
  recordDelivery: (
    invitationId: string,
    tokenDigest: string,
    deliveryState: "sent" | "failed",
    providerMessageId?: string,
  ) => Promise<boolean>;
}

export interface ClassInvitationDependencies {
  createToken?: () => string;
  digestToken?: (token: string) => Promise<string>;
  send?: typeof sendResendClassInvitation;
}

export class ClassInvitationPersistenceError extends Error {}

export class ClassInvitationOwnershipError extends Error {}

function defaultToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function deliverClassInvitations(
  persistence: ClassInvitationPersistence,
  request: { classId: string; emails: string[] },
  config: ResendClassInvitationConfig,
  dependencies: ClassInvitationDependencies = {},
): Promise<InvitationDeliveryResult[]> {
  const createToken = dependencies.createToken ?? defaultToken;
  const digestToken = dependencies.digestToken ?? digestClassInvitationToken;
  const send = dependencies.send ?? sendResendClassInvitation;
  const className = await persistence.loadClassName(request.classId);
  if (!className) {
    throw new ClassInvitationOwnershipError();
  }

  const tokens = request.emails.map(() => createToken());
  const tokenDigests = await Promise.all(tokens.map((token) => digestToken(token)));
  const prepared = await persistence.prepare(request.classId, request.emails, tokenDigests);
  const preparedByEmail = new Map(prepared.map((invitation) => [invitation.recipientEmail, invitation]));

  if (preparedByEmail.size !== request.emails.length) {
    throw new ClassInvitationPersistenceError();
  }

  const results: InvitationDeliveryResult[] = [];
  for (const [index, email] of request.emails.entries()) {
    const invitation = preparedByEmail.get(email);
    if (!invitation) {
      throw new ClassInvitationPersistenceError();
    }

    try {
      const { providerMessageId } = await send({ className, recipientEmail: email, token: tokens[index] }, config);
      const recorded = await persistence.recordDelivery(
        invitation.invitationId,
        tokenDigests[index],
        "sent",
        providerMessageId,
      );
      if (!recorded) {
        throw new ClassInvitationPersistenceError();
      }
      results.push({ email, status: invitation.preparation === "created" ? "sent" : "refreshed" });
    } catch {
      try {
        await persistence.recordDelivery(invitation.invitationId, tokenDigests[index], "failed");
      } catch {
        // The recipient result remains failed even if the delivery ledger cannot be updated.
      }
      results.push({ email, status: "failed" });
    }
  }
  return results;
}
