import type { SupabaseClient, User } from "@supabase/supabase-js";

export type TeacherAuthorizationResult =
  | { status: "unauthenticated" }
  | { status: "non-teacher" }
  | { status: "profile-unavailable" }
  | { status: "authorized-teacher" };

export interface TeacherAuthorizationLocals {
  user: User | null;
}

export async function authorizeTeacher(
  locals: TeacherAuthorizationLocals,
  supabase: SupabaseClient | null,
): Promise<TeacherAuthorizationResult> {
  if (!locals.user) {
    return { status: "unauthenticated" };
  }

  if (!supabase) {
    return { status: "profile-unavailable" };
  }

  let result: { data: { role?: unknown } | null; error: unknown };
  try {
    result = await supabase
      .from("profile_roles")
      .select("role")
      .eq("user_id", locals.user.id)
      .eq("role", "teacher")
      .maybeSingle();
  } catch {
    return { status: "profile-unavailable" };
  }

  const { data, error } = result;

  if (error) {
    return { status: "profile-unavailable" };
  }

  if (!data) {
    return { status: "non-teacher" };
  }

  return data.role === "teacher" ? { status: "authorized-teacher" } : { status: "profile-unavailable" };
}
