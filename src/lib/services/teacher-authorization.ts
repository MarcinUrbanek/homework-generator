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
    result = await supabase.from("profiles").select("role").eq("id", locals.user.id).maybeSingle();
  } catch {
    return { status: "profile-unavailable" };
  }

  const { data, error } = result;

  if (error || !data || (data.role !== "teacher" && data.role !== "student")) {
    return { status: "profile-unavailable" };
  }

  return data.role === "teacher" ? { status: "authorized-teacher" } : { status: "non-teacher" };
}
