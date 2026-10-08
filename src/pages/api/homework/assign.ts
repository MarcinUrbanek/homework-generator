import type { APIRoute } from "astro";

import {
  homeworkApiErrorSchema,
  homeworkAssignmentRequestSchema,
  homeworkAssignmentSuccessSchema,
} from "@/lib/homework/schemas";
import { createHomeworkAssignment, HomeworkAssignmentServiceError } from "@/lib/services/homework-assignments";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient } from "@/lib/supabase";
import type {
  HomeworkApiError,
  HomeworkApiErrorCode,
  HomeworkAssignmentRequest,
  HomeworkAssignmentSuccess,
} from "@/types";

export const prerender = false;

const ERROR_MESSAGES: Record<HomeworkApiErrorCode, string> = {
  INVALID_REQUEST: "Nieprawidłowe dane przydzielanego zadania.",
  UNAUTHENTICATED: "Zaloguj się, aby przydzielić zadania.",
  FORBIDDEN: "Przydzielanie zadań jest dostępne tylko dla nauczyciela.",
  CLASS_UNAVAILABLE: "Klasa jest niedostępna lub nie masz do niej dostępu.",
  EMPTY_ELIGIBLE_ROSTER: "Wybrani uczniowie nie należą już do tej klasy.",
  INSUFFICIENT_POOL: "Zatwierdzona pula zadań jest zbyt mała dla wybranej liczby uczniów.",
  DATABASE_UNAVAILABLE: "Baza danych jest chwilowo niedostępna.",
  PERSISTENCE_FAILURE: "Nie udało się przydzielić zadań. Spróbuj ponownie później.",
};

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

export interface HomeworkAssignmentHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  createSupabaseClient?: typeof createClient;
  assign?: (client: RequestClient, request: HomeworkAssignmentRequest) => Promise<unknown>;
}

function jsonResponse(body: HomeworkApiError | HomeworkAssignmentSuccess, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function errorResponse(
  code: HomeworkApiErrorCode,
  status: number,
  details?: { requiredExerciseCount: number; availableExerciseCount: number },
): Response {
  return jsonResponse(
    homeworkApiErrorSchema.parse({
      error: { code, message: ERROR_MESSAGES[code], ...details },
    }),
    status,
  );
}

function serviceErrorResponse(error: unknown): Response {
  if (!(error instanceof HomeworkAssignmentServiceError)) return errorResponse("PERSISTENCE_FAILURE", 500);
  if (error.code === "INSUFFICIENT_POOL") {
    if (error.requiredExerciseCount === undefined || error.availableExerciseCount === undefined) {
      return errorResponse("PERSISTENCE_FAILURE", 500);
    }
    return errorResponse("INSUFFICIENT_POOL", 422, {
      requiredExerciseCount: error.requiredExerciseCount,
      availableExerciseCount: error.availableExerciseCount,
    });
  }

  const status =
    error.code === "INVALID_REQUEST"
      ? 400
      : error.code === "CLASS_UNAVAILABLE"
        ? 404
        : error.code === "EMPTY_ELIGIBLE_ROSTER"
          ? 409
          : error.code === "DATABASE_UNAVAILABLE"
            ? 503
            : 500;
  return errorResponse(error.code, status);
}

export function createHomeworkAssignmentHandler(dependencies: HomeworkAssignmentHandlerDependencies = {}): APIRoute {
  const authorize = dependencies.authorize ?? authorizeTeacher;
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const assign = dependencies.assign ?? createHomeworkAssignment;

  return async (context) => {
    let value: unknown;
    try {
      value = await context.request.json();
    } catch {
      return errorResponse("INVALID_REQUEST", 400);
    }

    const request = homeworkAssignmentRequestSchema.safeParse(value);
    if (!request.success) return errorResponse("INVALID_REQUEST", 400);

    const supabase = createSupabaseClient(context.request.headers, context.cookies);
    const authorization = await authorize(context.locals, supabase);
    if (authorization.status === "unauthenticated") return errorResponse("UNAUTHENTICATED", 401);
    if (authorization.status !== "authorized-teacher") return errorResponse("FORBIDDEN", 403);
    if (!supabase) return errorResponse("DATABASE_UNAVAILABLE", 503);

    try {
      const assignment = homeworkAssignmentSuccessSchema.safeParse(await assign(supabase, request.data));
      if (!assignment.success) return errorResponse("PERSISTENCE_FAILURE", 500);
      return jsonResponse(assignment.data, assignment.data.replayed ? 200 : 201);
    } catch (error) {
      return serviceErrorResponse(error);
    }
  };
}

export const POST = createHomeworkAssignmentHandler();
