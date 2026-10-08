import type { APIRoute } from "astro";

import { homeworkApiErrorSchema, homeworkClassIdSchema, homeworkRosterSuccessSchema } from "@/lib/homework/schemas";
import { loadHomeworkRoster, HomeworkAssignmentServiceError } from "@/lib/services/homework-assignments";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient } from "@/lib/supabase";
import type { HomeworkApiError, HomeworkApiErrorCode, HomeworkRosterSuccess } from "@/types";

export const prerender = false;

const ERROR_MESSAGES: Record<HomeworkApiErrorCode, string> = {
  INVALID_REQUEST: "Nieprawidłowe dane żądania.",
  UNAUTHENTICATED: "Zaloguj się, aby zobaczyć listę uczniów.",
  FORBIDDEN: "Lista uczniów jest dostępna tylko dla nauczyciela.",
  CLASS_UNAVAILABLE: "Klasa jest niedostępna lub nie masz do niej dostępu.",
  EMPTY_ELIGIBLE_ROSTER: "Wybrani uczniowie nie należą już do tej klasy.",
  INSUFFICIENT_POOL: "Zatwierdzona pula zadań jest zbyt mała.",
  DATABASE_UNAVAILABLE: "Baza danych jest chwilowo niedostępna.",
  PERSISTENCE_FAILURE: "Nie udało się pobrać listy uczniów. Spróbuj ponownie później.",
};

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

export interface HomeworkRosterHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  createSupabaseClient?: typeof createClient;
  loadRoster?: (client: RequestClient, classId: string) => Promise<unknown>;
}

function jsonResponse(body: HomeworkApiError | HomeworkRosterSuccess, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function errorResponse(code: HomeworkApiErrorCode, status: number): Response {
  return jsonResponse(homeworkApiErrorSchema.parse({ error: { code, message: ERROR_MESSAGES[code] } }), status);
}

function serviceErrorResponse(error: unknown): Response {
  const code = error instanceof HomeworkAssignmentServiceError ? error.code : "PERSISTENCE_FAILURE";
  const status =
    code === "INVALID_REQUEST" ? 400 : code === "CLASS_UNAVAILABLE" ? 404 : code === "DATABASE_UNAVAILABLE" ? 503 : 500;
  return errorResponse(code, status);
}

export function createHomeworkRosterHandler(dependencies: HomeworkRosterHandlerDependencies = {}): APIRoute {
  const authorize = dependencies.authorize ?? authorizeTeacher;
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const loadRoster = dependencies.loadRoster ?? loadHomeworkRoster;

  return async (context) => {
    const classId = homeworkClassIdSchema.safeParse(context.params.classId);
    if (!classId.success) return errorResponse("INVALID_REQUEST", 400);

    const supabase = createSupabaseClient(context.request.headers, context.cookies);
    const authorization = await authorize(context.locals, supabase);
    if (authorization.status === "unauthenticated") return errorResponse("UNAUTHENTICATED", 401);
    if (authorization.status !== "authorized-teacher") return errorResponse("FORBIDDEN", 403);
    if (!supabase) return errorResponse("DATABASE_UNAVAILABLE", 503);

    try {
      const members = homeworkRosterSuccessSchema.safeParse({ members: await loadRoster(supabase, classId.data) });
      if (!members.success) return errorResponse("PERSISTENCE_FAILURE", 500);
      return jsonResponse(members.data, 200);
    } catch (error) {
      return serviceErrorResponse(error);
    }
  };
}

export const GET = createHomeworkRosterHandler();
