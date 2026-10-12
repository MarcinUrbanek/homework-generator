import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PROFILE_ROLES = ["student", "teacher"] as const;
export type ProfileRole = (typeof PROFILE_ROLES)[number];

const profileRoleRowsSchema = z
  .object({ role: z.enum(PROFILE_ROLES) })
  .strict()
  .array();

export type ProfileRolesResult = { status: "loaded"; roles: ProfileRole[] } | { status: "unavailable" };

export async function loadProfileRoles(
  client: SupabaseClient | null,
  userId: string | null,
): Promise<ProfileRolesResult> {
  if (!client || !userId) return { status: "unavailable" };

  try {
    const { data, error } = await client.from("profile_roles").select("role").eq("user_id", userId);
    if (error) return { status: "unavailable" };

    const parsed = profileRoleRowsSchema.safeParse(data);
    if (!parsed.success) return { status: "unavailable" };

    const roles = parsed.data.map(({ role }) => role);
    if (new Set(roles).size !== roles.length) return { status: "unavailable" };

    return { status: "loaded", roles: PROFILE_ROLES.filter((role) => roles.includes(role)) };
  } catch {
    return { status: "unavailable" };
  }
}
