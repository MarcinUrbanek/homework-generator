import type { APIRoute } from "astro";

import {
  studentHomeworkApiErrorSchema,
  studentHomeworkAssignmentIdSchema,
  studentHomeworkSubmitRequestSchema,
  studentHomeworkSubmitSuccessSchema,
} from "@/lib/homework/schemas";
import { authorizeStudent, StudentHomeworkServiceError, submitStudentHomework } from "@/lib/services/student-homework";
import { createClient } from "@/lib/supabase";
import type {
  StudentHomeworkApiError,
  StudentHomeworkApiErrorCode,
  StudentHomeworkSubmitRequest,
  StudentHomeworkSubmitSuccess,
} from "@/types";

export const prerender = false;

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

const ERROR_MESSAGES: Record<StudentHomeworkApiErrorCode, string> = {
  INVALID_REQUEST: "Nieprawidłowe dane odpowiedzi.",
  UNAUTHENTICATED: "Zaloguj się, aby wysłać odpowiedzi.",
  FORBIDDEN: "Wysyłanie odpowiedzi jest dostępne tylko dla ucznia.",
  HOMEWORK_UNAVAILABLE: "Zadanie domowe jest niedostępne. W razie wątpliwości skontaktuj się z nauczycielem.",
  SUBMISSION_CONFLICT: "To zadanie zostało już wysłane z innymi odpowiedziami.",
  SCORING_UNAVAILABLE: "Sprawdzanie zadania jest chwilowo niedostępne.",
  DATABASE_UNAVAILABLE: "Baza danych jest chwilowo niedostępna.",
  PERSISTENCE_FAILURE: "Nie udało się zapisać odpowiedzi. Spróbuj ponownie później.",
};

export interface StudentHomeworkSubmitHandlerDependencies {
  authorize?: typeof authorizeStudent;
  createSupabaseClient?: typeof createClient;
  submit?: (client: RequestClient, assignmentId: string, request: StudentHomeworkSubmitRequest) => Promise<unknown>;
}

function jsonResponse(body: StudentHomeworkApiError | StudentHomeworkSubmitSuccess, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

function errorResponse(code: StudentHomeworkApiErrorCode, status: number): Response {
  return jsonResponse(studentHomeworkApiErrorSchema.parse({ error: { code, message: ERROR_MESSAGES[code] } }), status);
}

function serviceErrorResponse(error: unknown): Response {
  if (!(error instanceof StudentHomeworkServiceError)) return errorResponse("PERSISTENCE_FAILURE", 500);
  const status =
    error.code === "INVALID_REQUEST"
      ? 400
      : error.code === "FORBIDDEN"
        ? 403
        : error.code === "HOMEWORK_UNAVAILABLE"
          ? 404
          : error.code === "SUBMISSION_CONFLICT"
            ? 409
            : error.code === "SCORING_UNAVAILABLE" || error.code === "DATABASE_UNAVAILABLE"
              ? 503
              : 500;
  return errorResponse(error.code, status);
}

export function createStudentHomeworkSubmitHandler(
  dependencies: StudentHomeworkSubmitHandlerDependencies = {},
): APIRoute {
  const authorize = dependencies.authorize ?? authorizeStudent;
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const submit = dependencies.submit ?? submitStudentHomework;

  return async (context) => {
    const assignmentId = studentHomeworkAssignmentIdSchema.safeParse(context.params.assignmentId);
    if (!assignmentId.success) return errorResponse("INVALID_REQUEST", 400);

    let value: unknown;
    try {
      value = await context.request.json();
    } catch {
      return errorResponse("INVALID_REQUEST", 400);
    }
    const request = studentHomeworkSubmitRequestSchema.safeParse(value);
    if (!request.success) return errorResponse("INVALID_REQUEST", 400);

    if (!context.locals.user) return errorResponse("UNAUTHENTICATED", 401);
    const supabase = createSupabaseClient(context.request.headers, context.cookies);
    if (!supabase) return errorResponse("DATABASE_UNAVAILABLE", 503);

    let authorization: Awaited<ReturnType<typeof authorize>>;
    try {
      authorization = await authorize(context.locals, supabase);
    } catch {
      return errorResponse("DATABASE_UNAVAILABLE", 503);
    }
    if (authorization.status === "unauthenticated") return errorResponse("UNAUTHENTICATED", 401);
    if (authorization.status === "profile-unavailable") return errorResponse("DATABASE_UNAVAILABLE", 503);
    if (authorization.status !== "authorized-student") return errorResponse("FORBIDDEN", 403);

    try {
      const result = studentHomeworkSubmitSuccessSchema.safeParse(
        await submit(supabase, assignmentId.data, request.data),
      );
      if (!result.success) return errorResponse("PERSISTENCE_FAILURE", 500);
      return jsonResponse(result.data, result.data.replayed ? 200 : 201);
    } catch (error) {
      return serviceErrorResponse(error);
    }
  };
}

export const POST = createStudentHomeworkSubmitHandler();
