import type { APIRoute } from "astro";
import { z } from "zod";

import { classApiErrorSchema, classJoinPreviewSchema, previewClassByCodeRequestSchema } from "@/lib/classes/schemas";
import { createClient } from "@/lib/supabase";
import type { ClassApiError, ClassApiErrorCode, ClassJoinPreview } from "@/types";

export const prerender = false;

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

const ERROR_MESSAGES: Record<ClassApiErrorCode, string> = {
  INVALID_REQUEST: "Nieprawidłowy kod klasy.",
  UNAUTHENTICATED: "Zaloguj się, aby sprawdzić kod klasy.",
  FORBIDDEN: "Brak dostępu do tej klasy.",
  DATABASE_UNAVAILABLE: "Baza danych jest chwilowo niedostępna.",
  PERSISTENCE_FAILURE: "Nie udało się sprawdzić kodu klasy.",
  SERVICE_UNAVAILABLE: "Usługa jest chwilowo niedostępna.",
};

const previewResultSchema = z.array(
  z
    .object({
      class_id: z.uuid(),
      class_name: z.string().trim().min(1),
      teacher_display_name: z.string().trim().min(1).nullable(),
      already_member: z.boolean(),
    })
    .strict(),
);
const supabaseResponseSchema = z.object({ data: z.unknown(), error: z.unknown().nullable() });

export interface PreviewCodeHandlerDependencies {
  createSupabaseClient?: typeof createClient;
  previewClass?: (client: RequestClient, classCode: string) => Promise<unknown>;
}

function jsonResponse(body: ClassApiError | { class: ClassJoinPreview }, status: number): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json; charset=utf-8" }, status });
}

function errorResponse(code: ClassApiErrorCode, status: number): Response {
  return jsonResponse(classApiErrorSchema.parse({ error: { code, message: ERROR_MESSAGES[code] } }), status);
}

async function previewClass(client: RequestClient, classCode: string): Promise<unknown> {
  const response: unknown = await client.rpc("preview_class_by_code", { p_class_code: classCode });
  const { data, error } = supabaseResponseSchema.parse(response);
  if (error) throw new Error("Class preview failed");
  return data;
}

export function createPreviewCodeHandler(dependencies: PreviewCodeHandlerDependencies = {}): APIRoute {
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const preview = dependencies.previewClass ?? previewClass;

  return async (context) => {
    let value: unknown;
    try {
      value = await context.request.json();
    } catch {
      return errorResponse("INVALID_REQUEST", 400);
    }
    const parsed = previewClassByCodeRequestSchema.safeParse(value);
    if (!parsed.success) return errorResponse("INVALID_REQUEST", 400);
    if (!context.locals.user) return errorResponse("UNAUTHENTICATED", 401);

    const supabase = createSupabaseClient(context.request.headers, context.cookies);
    if (!supabase) return errorResponse("DATABASE_UNAVAILABLE", 503);

    try {
      const rows = previewResultSchema.safeParse(await preview(supabase, parsed.data.classCode));
      if (!rows.success || !rows.data[0]) return errorResponse("PERSISTENCE_FAILURE", 500);
      const row = rows.data[0];
      const result = classJoinPreviewSchema.safeParse({
        name: row.class_name,
        teacherDisplayName: row.teacher_display_name,
        alreadyMember: row.already_member,
      });
      if (!result.success) return errorResponse("PERSISTENCE_FAILURE", 500);
      return jsonResponse({ class: result.data }, 200);
    } catch {
      return errorResponse("PERSISTENCE_FAILURE", 500);
    }
  };
}

export const POST = createPreviewCodeHandler();
