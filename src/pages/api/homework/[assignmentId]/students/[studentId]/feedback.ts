import type { APIRoute } from "astro";

import {
  homeworkFeedbackRequestSchema,
  homeworkFeedbackSuccessSchema,
  homeworkReviewApiErrorSchema,
  homeworkReviewIdSchema,
} from "@/lib/homework/review-schemas";
import { HomeworkReviewServiceError, saveHomeworkSubmissionFeedback } from "@/lib/services/homework-review";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient } from "@/lib/supabase";
import type { HomeworkFeedbackSuccess, HomeworkReviewApiError, HomeworkReviewApiErrorCode } from "@/types";

export const prerender = false;

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

const ERROR_MESSAGES: Record<HomeworkReviewApiErrorCode, string> = {
  INVALID_REQUEST: "Nieprawidłowy komentarz. Komentarz może mieć najwyżej 2000 znaków.",
  UNAUTHENTICATED: "Zaloguj się, aby zapisać komentarz.",
  FORBIDDEN: "Komentarze może zapisywać tylko nauczyciel.",
  HOMEWORK_UNAVAILABLE: "Zadanie domowe jest niedostępne lub nie masz do niego dostępu.",
  FEEDBACK_NOT_ALLOWED: "Nie można już dodać komentarza do tego zadania.",
  DATABASE_UNAVAILABLE: "Baza danych jest chwilowo niedostępna.",
  PERSISTENCE_FAILURE: "Nie udało się zapisać komentarza. Spróbuj ponownie później.",
};

export interface HomeworkFeedbackHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  createSupabaseClient?: typeof createClient;
  save?: (client: RequestClient, assignmentId: string, studentId: string, body: string) => Promise<unknown>;
}

function jsonResponse(body: HomeworkReviewApiError | HomeworkFeedbackSuccess, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

function errorResponse(code: HomeworkReviewApiErrorCode, status: number): Response {
  return jsonResponse(homeworkReviewApiErrorSchema.parse({ error: { code, message: ERROR_MESSAGES[code] } }), status);
}

function serviceErrorResponse(error: unknown): Response {
  const code = error instanceof HomeworkReviewServiceError ? error.code : "PERSISTENCE_FAILURE";
  const status =
    code === "INVALID_REQUEST"
      ? 400
      : code === "HOMEWORK_UNAVAILABLE"
        ? 404
        : code === "FEEDBACK_NOT_ALLOWED"
          ? 409
          : code === "DATABASE_UNAVAILABLE"
            ? 503
            : 500;
  return errorResponse(code, status);
}

export function createHomeworkFeedbackHandler(dependencies: HomeworkFeedbackHandlerDependencies = {}): APIRoute {
  const authorize = dependencies.authorize ?? authorizeTeacher;
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const save = dependencies.save ?? saveHomeworkSubmissionFeedback;

  return async (context) => {
    const assignmentId = homeworkReviewIdSchema.safeParse(context.params.assignmentId);
    const studentId = homeworkReviewIdSchema.safeParse(context.params.studentId);
    if (!assignmentId.success || !studentId.success) return errorResponse("INVALID_REQUEST", 400);

    let value: unknown;
    try {
      value = await context.request.json();
    } catch {
      return errorResponse("INVALID_REQUEST", 400);
    }
    const request = homeworkFeedbackRequestSchema.safeParse(value);
    if (!request.success) return errorResponse("INVALID_REQUEST", 400);

    if (!context.locals.user) return errorResponse("UNAUTHENTICATED", 401);
    const supabase = createSupabaseClient(context.request.headers, context.cookies);

    let authorization: Awaited<ReturnType<typeof authorize>>;
    try {
      authorization = await authorize(context.locals, supabase);
    } catch {
      return errorResponse("DATABASE_UNAVAILABLE", 503);
    }
    if (authorization.status === "unauthenticated") return errorResponse("UNAUTHENTICATED", 401);
    if (authorization.status !== "authorized-teacher") return errorResponse("FORBIDDEN", 403);
    if (!supabase) return errorResponse("DATABASE_UNAVAILABLE", 503);

    try {
      const result = homeworkFeedbackSuccessSchema.safeParse(
        await save(supabase, assignmentId.data, studentId.data, request.data.feedback),
      );
      if (!result.success) return errorResponse("PERSISTENCE_FAILURE", 500);
      return jsonResponse(result.data, 200);
    } catch (error) {
      return serviceErrorResponse(error);
    }
  };
}

export const PUT = createHomeworkFeedbackHandler();
