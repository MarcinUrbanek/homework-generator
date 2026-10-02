import type { APIRoute } from "astro";

import {
  savedExerciseCursorSchema,
  savedExerciseErrorSchema,
  savedExerciseFiltersSchema,
  savedExerciseRetrievalRowSchema,
  savedExerciseSuccessSchema,
} from "@/lib/exercises/schemas";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient } from "@/lib/supabase";
import type {
  SavedExerciseCursor,
  SavedExerciseError,
  SavedExerciseErrorCode,
  SavedExerciseFilters,
  SavedExerciseSuccess,
} from "@/types";

export const prerender = false;

const PAGE_SIZE = 20;
const RETRIEVAL_LIMIT = PAGE_SIZE + 1;
const QUERY_PARAMETER_NAMES = new Set(["grade", "topic", "difficulty", "cursor"]);

const ERROR_MESSAGES: Record<SavedExerciseErrorCode, string> = {
  INVALID_REQUEST: "Nieprawidłowe filtry zapisanych zadań.",
  UNAUTHENTICATED: "Zaloguj się, aby przeglądać zapisane zadania.",
  FORBIDDEN: "Przeglądanie zapisanych zadań jest dostępne tylko dla nauczycieli.",
  DATABASE_UNAVAILABLE: "Baza danych jest chwilowo niedostępna. Spróbuj ponownie później.",
  PERSISTENCE_FAILURE: "Nie udało się pobrać zapisanych zadań. Spróbuj ponownie później.",
};

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

interface RetrievalFailure {
  code?: string;
}

interface SavedExerciseQuery {
  filters: SavedExerciseFilters;
  cursor: SavedExerciseCursor | null;
}

export interface SavedExerciseHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  createSupabaseClient?: (
    headers: Headers,
    cookies: Parameters<typeof createClient>[1],
  ) => ReturnType<typeof createClient>;
  retrieve?: (client: RequestClient, query: SavedExerciseQuery) => Promise<unknown>;
}

function jsonResponse(body: SavedExerciseError | SavedExerciseSuccess, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function errorResponse(code: SavedExerciseErrorCode, status: number, message = ERROR_MESSAGES[code]): Response {
  return jsonResponse(savedExerciseErrorSchema.parse({ error: { code, message } }), status);
}

function decodeCursor(value: string): SavedExerciseCursor | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    return savedExerciseCursorSchema.safeParse(JSON.parse(atob(`${normalized}${padding}`))).data ?? null;
  } catch {
    return null;
  }
}

function encodeCursor(cursor: SavedExerciseCursor): string {
  return btoa(JSON.stringify(cursor)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function parseQuery(url: URL): SavedExerciseQuery | null {
  const seen = new Set<string>();
  for (const [name] of url.searchParams) {
    if (!QUERY_PARAMETER_NAMES.has(name) || seen.has(name)) {
      return null;
    }
    seen.add(name);
  }

  const filters = savedExerciseFiltersSchema.safeParse({
    grade: url.searchParams.has("grade") ? Number(url.searchParams.get("grade")) : undefined,
    topic: url.searchParams.get("topic") ?? undefined,
    difficulty: url.searchParams.has("difficulty") ? url.searchParams.get("difficulty") : undefined,
  });
  if (!filters.success) {
    return null;
  }

  const cursorValue = url.searchParams.get("cursor");
  if (cursorValue === null) {
    return { filters: filters.data, cursor: null };
  }

  const cursor = decodeCursor(cursorValue);
  if (cursor?.topic !== filters.data.topic || cursor.difficulty !== filters.data.difficulty) {
    return null;
  }

  return { filters: filters.data, cursor };
}

async function retrieveSavedExercises(client: RequestClient, query: SavedExerciseQuery): Promise<unknown> {
  const result = (await client.rpc("get_saved_exercises", {
    p_grade: String(query.filters.grade),
    p_topic: query.filters.topic,
    p_difficulty: query.filters.difficulty ?? null,
    p_cursor_approved_at: query.cursor?.approvedAt ?? null,
    p_cursor_id: query.cursor?.id ?? null,
    p_limit: RETRIEVAL_LIMIT,
  })) as { data: unknown; error: RetrievalFailure | null };
  if (result.error) {
    throw Object.assign(new Error("Saved exercise retrieval failed"), { code: result.error.code });
  }
  return result.data;
}

function isDatabaseUnavailable(error: RetrievalFailure): boolean {
  return error.code?.startsWith("08") === true || ["PGRST000", "PGRST001", "PGRST002"].includes(error.code ?? "");
}

export function createSavedExercisesHandler(dependencies: SavedExerciseHandlerDependencies = {}): APIRoute {
  const authorize = dependencies.authorize ?? authorizeTeacher;
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const retrieve = dependencies.retrieve ?? retrieveSavedExercises;

  return async (context) => {
    const query = parseQuery(new URL(context.request.url));
    if (!query) {
      return errorResponse("INVALID_REQUEST", 400);
    }

    const supabase = createSupabaseClient(context.request.headers, context.cookies);
    const authorization = await authorize(context.locals, supabase);
    if (authorization.status === "unauthenticated") {
      return errorResponse("UNAUTHENTICATED", 401);
    }
    if (authorization.status === "non-teacher") {
      return errorResponse("FORBIDDEN", 403);
    }
    if (authorization.status === "profile-unavailable") {
      return errorResponse("FORBIDDEN", 403, "Nie można potwierdzić uprawnień nauczyciela.");
    }
    if (!supabase) {
      return errorResponse("DATABASE_UNAVAILABLE", 503);
    }

    try {
      const rows = savedExerciseRetrievalRowSchema.array().parse(await retrieve(supabase, query));
      const exercises = rows.slice(0, PAGE_SIZE).map((row) => ({
        id: row.id,
        text: row.exercise_text,
        canonicalAnswer: row.canonical_answer,
        grade: 4 as const,
        topic: row.topic,
        difficulty: row.difficulty,
        approvedAt: row.approved_at,
      }));
      const finalExercise = exercises.at(-1);
      const response = savedExerciseSuccessSchema.parse({
        exercises,
        nextCursor:
          rows.length > PAGE_SIZE && finalExercise
            ? encodeCursor({
                grade: finalExercise.grade,
                topic: finalExercise.topic,
                difficulty: query.filters.difficulty,
                approvedAt: finalExercise.approvedAt,
                id: finalExercise.id,
              })
            : null,
      });
      return jsonResponse(response, 200);
    } catch (error) {
      const failure = typeof error === "object" && error !== null ? (error as RetrievalFailure) : {};
      if (failure.code === "22023") {
        return errorResponse("INVALID_REQUEST", 400);
      }
      if (failure.code === "42501") {
        return errorResponse("FORBIDDEN", 403);
      }
      if (isDatabaseUnavailable(failure)) {
        return errorResponse("DATABASE_UNAVAILABLE", 503);
      }
      return errorResponse("PERSISTENCE_FAILURE", 500);
    }
  };
}

export const GET = createSavedExercisesHandler();
