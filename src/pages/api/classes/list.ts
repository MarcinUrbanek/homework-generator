import type { APIRoute } from "astro";
import { z } from "zod";

import { classApiErrorSchema, classSummarySchema } from "@/lib/classes/schemas";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient } from "@/lib/supabase";
import type { ClassApiError, ClassApiErrorCode, ListClassesSuccess } from "@/types";

export const prerender = false;

const ERROR_MESSAGES: Record<ClassApiErrorCode, string> = {
  INVALID_REQUEST: "Nieprawidłowe dane żądania.",
  UNAUTHENTICATED: "Zaloguj się, aby zobaczyć klasy.",
  FORBIDDEN: "Lista klas jest dostępna tylko dla nauczycieli.",
  DATABASE_UNAVAILABLE: "Baza danych jest chwilowo niedostępna.",
  PERSISTENCE_FAILURE: "Nie udało się pobrać klas. Spróbuj ponownie później.",
  SERVICE_UNAVAILABLE: "Usługa zaproszeń jest chwilowo niedostępna.",
};

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

const listClassesResultSchema = z.array(
  z
    .object({
      id: z.uuid(),
      name: z.string(),
      class_code: z.string().regex(/^[A-Z0-9]{8}$/),
      created_at: z.iso.datetime({ offset: true }),
    })
    .strict(),
);
const supabaseResponseSchema = z.object({ data: z.unknown(), error: z.unknown().nullable() });

export interface ListClassesHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  createSupabaseClient?: typeof createClient;
  listClasses?: (client: RequestClient) => Promise<unknown>;
}

function jsonResponse(body: ClassApiError | ListClassesSuccess, status: number): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json; charset=utf-8" }, status });
}

function errorResponse(code: ClassApiErrorCode, status: number): Response {
  return jsonResponse(classApiErrorSchema.parse({ error: { code, message: ERROR_MESSAGES[code] } }), status);
}

function supabaseError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Supabase request failed");
}

async function listClasses(client: RequestClient): Promise<unknown> {
  const response: unknown = await client
    .from("classes")
    .select("id,name,class_code,created_at")
    .order("created_at", { ascending: false });
  const { data, error } = supabaseResponseSchema.parse(response);
  if (error) throw supabaseError(error);
  return data;
}

export function createListClassesHandler(dependencies: ListClassesHandlerDependencies = {}): APIRoute {
  const authorize = dependencies.authorize ?? authorizeTeacher;
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const list = dependencies.listClasses ?? listClasses;
  return async (context) => {
    const supabase = createSupabaseClient(context.request.headers, context.cookies);
    const authorization = await authorize(context.locals, supabase);
    if (authorization.status === "unauthenticated") return errorResponse("UNAUTHENTICATED", 401);
    if (authorization.status !== "authorized-teacher") return errorResponse("FORBIDDEN", 403);
    if (!supabase) return errorResponse("DATABASE_UNAVAILABLE", 503);
    try {
      const rows = listClassesResultSchema.safeParse(await list(supabase));
      if (!rows.success) return errorResponse("PERSISTENCE_FAILURE", 500);
      const classes = classSummarySchema.array().safeParse(
        rows.data.map((row) => ({
          id: row.id,
          name: row.name,
          classCode: row.class_code,
          createdAt: row.created_at,
        })),
      );
      if (!classes.success) return errorResponse("PERSISTENCE_FAILURE", 500);
      return jsonResponse({ classes: classes.data }, 200);
    } catch {
      return errorResponse("PERSISTENCE_FAILURE", 500);
    }
  };
}

export const GET = createListClassesHandler();
