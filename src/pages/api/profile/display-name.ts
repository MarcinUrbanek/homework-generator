import type { APIRoute } from "astro";
import { z } from "zod";

import { classApiErrorSchema, setTeacherDisplayNameRequestSchema } from "@/lib/classes/schemas";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient } from "@/lib/supabase";
import type { ClassApiError, ClassApiErrorCode, DisplayNameUpdateSuccess } from "@/types";

export const prerender = false;

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

const ERROR_MESSAGES: Record<ClassApiErrorCode, string> = {
  INVALID_REQUEST: "Podaj nazwę wyświetlaną o długości od 1 do 80 znaków.",
  UNAUTHENTICATED: "Zaloguj się, aby zmienić nazwę wyświetlaną.",
  FORBIDDEN: "Zmiana nazwy wyświetlanej jest dostępna tylko dla nauczycieli.",
  DATABASE_UNAVAILABLE: "Baza danych jest chwilowo niedostępna.",
  PERSISTENCE_FAILURE: "Nie udało się zapisać nazwy wyświetlanej.",
  SERVICE_UNAVAILABLE: "Usługa jest chwilowo niedostępna.",
};

const supabaseResponseSchema = z.object({ data: z.unknown(), error: z.unknown().nullable() });

export interface DisplayNameHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  createSupabaseClient?: typeof createClient;
  updateDisplayName?: (client: RequestClient, displayName: string) => Promise<unknown>;
}

function jsonResponse(body: ClassApiError | DisplayNameUpdateSuccess, status: number): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json; charset=utf-8" }, status });
}

function errorResponse(code: ClassApiErrorCode, status: number): Response {
  return jsonResponse(classApiErrorSchema.parse({ error: { code, message: ERROR_MESSAGES[code] } }), status);
}

async function updateDisplayName(client: RequestClient, displayName: string): Promise<unknown> {
  const response: unknown = await client.rpc("set_teacher_display_name", { p_display_name: displayName });
  const { data, error } = supabaseResponseSchema.parse(response);
  if (error) throw new Error("Display-name update failed");
  return data;
}

export function createDisplayNameHandler(dependencies: DisplayNameHandlerDependencies = {}): APIRoute {
  const authorize = dependencies.authorize ?? authorizeTeacher;
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const update = dependencies.updateDisplayName ?? updateDisplayName;

  return async (context) => {
    let value: unknown;
    try {
      value = await context.request.json();
    } catch {
      return errorResponse("INVALID_REQUEST", 400);
    }
    const parsed = setTeacherDisplayNameRequestSchema.safeParse(value);
    if (!parsed.success) return errorResponse("INVALID_REQUEST", 400);

    const supabase = createSupabaseClient(context.request.headers, context.cookies);
    const authorization = await authorize(context.locals, supabase);
    if (authorization.status === "unauthenticated") return errorResponse("UNAUTHENTICATED", 401);
    if (authorization.status !== "authorized-teacher") return errorResponse("FORBIDDEN", 403);
    if (!supabase) return errorResponse("DATABASE_UNAVAILABLE", 503);

    try {
      const result = z
        .string()
        .trim()
        .min(1)
        .max(80)
        .safeParse(await update(supabase, parsed.data.displayName));
      if (!result.success) return errorResponse("PERSISTENCE_FAILURE", 500);
      return jsonResponse({ displayName: result.data }, 200);
    } catch {
      return errorResponse("PERSISTENCE_FAILURE", 500);
    }
  };
}

export const POST = createDisplayNameHandler();
