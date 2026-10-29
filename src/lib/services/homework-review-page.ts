import { homeworkReviewIdSchema } from "@/lib/homework/review-schemas";
import { HomeworkReviewServiceError } from "@/lib/services/homework-review";
import { authorizeTeacher, type TeacherAuthorizationLocals } from "@/lib/services/teacher-authorization";
import { createClient } from "@/lib/supabase";

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

export type TeacherReviewPageResult<T> =
  | { state: "ready"; status: 200; data: T }
  | { state: "not-found" | "forbidden" | "error"; status: 403 | 404 | 500 | 503; data: null };

export interface TeacherReviewPageInput<T> {
  params: (string | undefined)[];
  locals: TeacherAuthorizationLocals;
  supabase: RequestClient | null;
  // Returning null means the record exists but does not belong to the requested route (for example another class).
  load: (client: RequestClient, ids: string[]) => Promise<T | null>;
  authorize?: typeof authorizeTeacher;
}

export async function loadTeacherReviewPage<T>({
  params,
  locals,
  supabase,
  load,
  authorize = authorizeTeacher,
}: TeacherReviewPageInput<T>): Promise<TeacherReviewPageResult<T>> {
  const ids: string[] = [];
  for (const param of params) {
    const parsed = homeworkReviewIdSchema.safeParse(param);
    if (!parsed.success) return { state: "not-found", status: 404, data: null };
    ids.push(parsed.data);
  }

  const authorization = await authorize(locals, supabase);
  if (authorization.status !== "authorized-teacher") return { state: "forbidden", status: 403, data: null };
  if (!supabase) return { state: "error", status: 503, data: null };

  try {
    const data = await load(supabase, ids);
    return data === null ? { state: "not-found", status: 404, data: null } : { state: "ready", status: 200, data };
  } catch (error) {
    if (
      error instanceof HomeworkReviewServiceError &&
      (error.code === "HOMEWORK_UNAVAILABLE" || error.code === "INVALID_REQUEST")
    ) {
      return { state: "not-found", status: 404, data: null };
    }
    if (error instanceof HomeworkReviewServiceError && error.code === "DATABASE_UNAVAILABLE") {
      return { state: "error", status: 503, data: null };
    }
    return { state: "error", status: 500, data: null };
  }
}
