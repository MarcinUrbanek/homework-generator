import { z } from "zod";

import { classInvitationTokenSchema, classJoinPreviewSchema } from "@/lib/classes/schemas";
import { digestClassInvitationToken } from "@/lib/classes/invitation-token";
import type { ClassJoinPreview } from "@/types";

type CoarseClassInvitationStatus = "missing" | "invalid" | "expired" | "delivery-failed" | "valid" | "email-mismatch";

export type ClassInvitationStatus =
  | CoarseClassInvitationStatus
  | { status: "ready"; preview: ClassJoinPreview }
  | { status: "already-member"; preview: ClassJoinPreview };

interface InvitationRecord {
  normalizedEmail: string;
  expiresAt: string;
  deliveryState: "sent" | "failed" | "pending";
  classId: string;
  redeemedBy: string | null;
}

interface ClassPreviewRecord {
  name: string;
  teacherDisplayName: string | null;
}

export interface ClassInvitationStatusDependencies {
  digestToken?: (token: string) => Promise<string>;
  findInvitation?: (tokenDigest: string) => Promise<InvitationRecord | null>;
  findClassPreview?: (classId: string) => Promise<ClassPreviewRecord | null>;
  findMembership?: (classId: string, studentId: string) => Promise<boolean>;
  now?: () => Date;
}

const invitationRecordSchema = z
  .object({
    normalized_email: z.email(),
    expires_at: z.iso.datetime({ offset: true }),
    delivery_state: z.enum(["sent", "failed", "pending"]),
    class_id: z.uuid(),
    redeemed_by: z.uuid().nullable(),
  })
  .strict();
const classRecordSchema = z.object({ name: z.string().trim().min(1), teacher_id: z.uuid() }).strict();
const profileRecordSchema = z.object({ display_name: z.string().trim().min(1).max(80).nullable() }).strict();
const supabaseResponseSchema = z.object({ data: z.unknown(), error: z.unknown().nullable() });

async function createServiceClient() {
  const { createServiceClient: createClient } = await import("@/lib/supabase");
  return createClient();
}

async function findInvitation(tokenDigest: string): Promise<InvitationRecord | null> {
  const client = await createServiceClient();
  if (!client) return null;

  const response = await client
    .from("class_invitations")
    .select("normalized_email,expires_at,delivery_state,class_id,redeemed_by")
    .eq("token_digest", tokenDigest)
    .maybeSingle();
  if (response.error) throw new Error("Invitation lookup failed");
  const parsed = invitationRecordSchema.nullable().safeParse(response.data);
  if (!parsed.success || !parsed.data) return null;
  return {
    normalizedEmail: parsed.data.normalized_email,
    expiresAt: parsed.data.expires_at,
    deliveryState: parsed.data.delivery_state,
    classId: parsed.data.class_id,
    redeemedBy: parsed.data.redeemed_by,
  };
}

async function findClassPreview(classId: string): Promise<ClassPreviewRecord | null> {
  const client = await createServiceClient();
  if (!client) return null;
  const classResponse: unknown = await client.from("classes").select("name,teacher_id").eq("id", classId).maybeSingle();
  const parsedClass = supabaseResponseSchema.safeParse(classResponse);
  if (!parsedClass.success || parsedClass.data.error) throw new Error("Class preview lookup failed");
  const classRecord = classRecordSchema.safeParse(parsedClass.data.data);
  if (!classRecord.success) return null;

  const profileResponse: unknown = await client
    .from("profiles")
    .select("display_name")
    .eq("id", classRecord.data.teacher_id)
    .maybeSingle();
  const parsedProfile = supabaseResponseSchema.safeParse(profileResponse);
  if (!parsedProfile.success || parsedProfile.data.error) throw new Error("Teacher preview lookup failed");
  const profile = profileRecordSchema.safeParse(parsedProfile.data.data);
  if (!profile.success) return null;
  return { name: classRecord.data.name, teacherDisplayName: profile.data.display_name };
}

async function findMembership(classId: string, studentId: string): Promise<boolean> {
  const client = await createServiceClient();
  if (!client) throw new Error("Membership lookup unavailable");
  const response: unknown = await client
    .from("class_memberships")
    .select("class_id")
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .maybeSingle();
  const parsed = supabaseResponseSchema.parse(response);
  if (parsed.error) throw new Error("Membership lookup failed");
  return parsed.data !== null;
}

export async function resolveClassInvitationStatus(
  token: string | null,
  authenticatedEmail: string | null,
  dependencies: ClassInvitationStatusDependencies = {},
  authenticatedUserId: string | null = null,
): Promise<ClassInvitationStatus> {
  if (token === null) return "missing";
  if (!classInvitationTokenSchema.safeParse(token).success) return "invalid";

  const digestToken = dependencies.digestToken ?? digestClassInvitationToken;
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
  if (authenticatedEmail.trim().toLowerCase() !== invitation.normalizedEmail) return "email-mismatch";
  if (!authenticatedUserId) return "valid";
  if (invitation.redeemedBy && invitation.redeemedBy !== authenticatedUserId) return "invalid";

  const loadPreview = dependencies.findClassPreview ?? findClassPreview;
  const loadMembership = dependencies.findMembership ?? findMembership;
  let classDetails: ClassPreviewRecord | null;
  let alreadyMember: boolean;
  try {
    [classDetails, alreadyMember] = await Promise.all([
      loadPreview(invitation.classId),
      loadMembership(invitation.classId, authenticatedUserId),
    ]);
  } catch {
    return "invalid";
  }
  if (!classDetails || (invitation.redeemedBy === authenticatedUserId && !alreadyMember)) return "invalid";

  const preview = classJoinPreviewSchema.parse({ ...classDetails, alreadyMember });
  return alreadyMember ? { status: "already-member", preview } : { status: "ready", preview };
}
