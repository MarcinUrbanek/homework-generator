import type { APIRoute } from "astro";
import { z } from "zod";

import { classApiErrorSchema, joinedClassSummarySchema } from "@/lib/classes/schemas";
import { createClient } from "@/lib/supabase";
import type { ClassApiError, ClassApiErrorCode, JoinedClassesSuccess } from "@/types";

export const prerender = false;

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

const ERROR_MESSAGES: Record<ClassApiErrorCode, string> = {
  INVALID_REQUEST: "Nieprawidłowe dane żądania.",
  UNAUTHENTICATED: "Zaloguj się, aby zobaczyć swoje klasy.",
  FORBIDDEN: "Brak dostępu do tych klas.",
  DATABASE_UNAVAILABLE: "Baza danych jest chwilowo niedostępna.",
  PERSISTENCE_FAILURE: "Nie udało się pobrać klas. Spróbuj ponownie później.",
  SERVICE_UNAVAILABLE: "Usługa jest chwilowo niedostępna.",
};

const membershipRowsSchema = z.array(
  z
    .object({
      class_id: z.uuid(),
      class_name: z.string().trim().min(1),
      teacher_display_name: z.string().trim().min(1).nullable(),
      joined_at: z.iso.datetime({ offset: true }),
    })
    .strict(),
);
const supabaseResponseSchema = z.object({ data: z.unknown(), error: z.unknown().nullable() });

export interface JoinedHandlerDependencies {
  createSupabaseClient?: typeof createClient;
  listMemberships?: (client: RequestClient) => Promise<unknown>;
}

function jsonResponse(body: ClassApiError | JoinedClassesSuccess, status: number): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json; charset=utf-8" }, status });
}

function errorResponse(code: ClassApiErrorCode, status: number): Response {
  return jsonResponse(classApiErrorSchema.parse({ error: { code, message: ERROR_MESSAGES[code] } }), status);
}

async function listMemberships(client: RequestClient): Promise<unknown> {
  const response: unknown = await client.rpc("list_my_class_memberships");
  const { data, error } = supabaseResponseSchema.parse(response);
  if (error) throw new Error("Membership lookup failed");
  return data;
}

export function createJoinedHandler(dependencies: JoinedHandlerDependencies = {}): APIRoute {
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const list = dependencies.listMemberships ?? listMemberships;

  return async (context) => {
    if (!context.locals.user) return errorResponse("UNAUTHENTICATED", 401);
    const supabase = createSupabaseClient(context.request.headers, context.cookies);
    if (!supabase) return errorResponse("DATABASE_UNAVAILABLE", 503);

    try {
      const rows = membershipRowsSchema.safeParse(await list(supabase));
      if (!rows.success) return errorResponse("PERSISTENCE_FAILURE", 500);
      const classes = joinedClassSummarySchema.array().safeParse(
        rows.data.map((row) => ({
          id: row.class_id,
          name: row.class_name,
          teacherDisplayName: row.teacher_display_name,
          joinedAt: row.joined_at,
        })),
      );
      if (!classes.success) return errorResponse("PERSISTENCE_FAILURE", 500);
      return jsonResponse({ classes: classes.data }, 200);
    } catch {
      return errorResponse("PERSISTENCE_FAILURE", 500);
    }
  };
}

export const GET = createJoinedHandler();
