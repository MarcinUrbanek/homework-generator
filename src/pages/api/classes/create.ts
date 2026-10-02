import type { APIRoute } from "astro";
import { z } from "zod";

import { classApiErrorSchema, classSummarySchema, createClassRequestSchema } from "@/lib/classes/schemas";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient } from "@/lib/supabase";
import type { ClassApiError, ClassApiErrorCode, CreateClassSuccess } from "@/types";

export const prerender = false;

const ERROR_MESSAGES: Record<ClassApiErrorCode, string> = {
  INVALID_REQUEST: "Nieprawidłowa nazwa klasy.",
  UNAUTHENTICATED: "Zaloguj się, aby utworzyć klasę.",
  FORBIDDEN: "Tworzenie klas jest dostępne tylko dla nauczycieli.",
  DATABASE_UNAVAILABLE: "Baza danych jest chwilowo niedostępna.",
  PERSISTENCE_FAILURE: "Nie udało się utworzyć klasy. Spróbuj ponownie później.",
  SERVICE_UNAVAILABLE: "Usługa zaproszeń jest chwilowo niedostępna.",
};

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

const createClassResultSchema = z.array(
  z
    .object({
      class_id: z.uuid(),
      class_code: z.string().regex(/^[A-Z0-9]{8}$/),
    })
    .strict(),
);
const supabaseResponseSchema = z.object({ data: z.unknown(), error: z.unknown().nullable() });

export interface CreateClassHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  createSupabaseClient?: typeof createClient;
  createClass?: (client: RequestClient, name: string) => Promise<unknown>;
}

function jsonResponse(body: ClassApiError | CreateClassSuccess, status: number): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json; charset=utf-8" }, status });
}

function errorResponse(code: ClassApiErrorCode, status: number, message = ERROR_MESSAGES[code]): Response {
  return jsonResponse(classApiErrorSchema.parse({ error: { code, message } }), status);
}

function supabaseError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Supabase request failed");
}

async function createClass(client: RequestClient, name: string): Promise<unknown> {
  const response: unknown = await client.rpc("create_class", { p_name: name });
  const { data, error } = supabaseResponseSchema.parse(response);
  if (error) {
    throw supabaseError(error);
  }
  return data;
}

export function createCreateClassHandler(dependencies: CreateClassHandlerDependencies = {}): APIRoute {
  const authorize = dependencies.authorize ?? authorizeTeacher;
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const create = dependencies.createClass ?? createClass;

  return async (context) => {
    let value: unknown;
    try {
      value = await context.request.json();
    } catch {
      return errorResponse("INVALID_REQUEST", 400);
    }
    const parsed = createClassRequestSchema.safeParse(value);
    if (!parsed.success) {
      return errorResponse("INVALID_REQUEST", 400);
    }
    const supabase = createSupabaseClient(context.request.headers, context.cookies);
    const authorization = await authorize(context.locals, supabase);
    if (authorization.status === "unauthenticated") return errorResponse("UNAUTHENTICATED", 401);
    if (authorization.status !== "authorized-teacher") return errorResponse("FORBIDDEN", 403);
    if (!supabase) return errorResponse("DATABASE_UNAVAILABLE", 503);
    try {
      const rows = createClassResultSchema.safeParse(await create(supabase, parsed.data.name));
      const row = rows.success ? rows.data[0] : null;
      const result = classSummarySchema.safeParse(
        row && {
          id: row.class_id,
          name: parsed.data.name,
          classCode: row.class_code,
          createdAt: new Date().toISOString(),
        },
      );
      if (!result.success) return errorResponse("PERSISTENCE_FAILURE", 500);
      return jsonResponse({ class: result.data }, 201);
    } catch {
      return errorResponse("PERSISTENCE_FAILURE", 500);
    }
  };
}

export const POST = createCreateClassHandler();
