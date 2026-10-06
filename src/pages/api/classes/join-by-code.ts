import type { APIRoute } from "astro";
import { z } from "zod";

import { classApiErrorSchema, previewClassByCodeRequestSchema } from "@/lib/classes/schemas";
import { createClient } from "@/lib/supabase";
import type { ClassApiError, ClassApiErrorCode, ClassJoinSuccess } from "@/types";

export const prerender = false;

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

const ERROR_MESSAGES: Record<ClassApiErrorCode, string> = {
  INVALID_REQUEST: "Nieprawidłowy kod klasy.",
  UNAUTHENTICATED: "Zaloguj się, aby dołączyć do klasy.",
  FORBIDDEN: "Nie można dołączyć do tej klasy.",
  DATABASE_UNAVAILABLE: "Baza danych jest chwilowo niedostępna.",
  PERSISTENCE_FAILURE: "Nie udało się dołączyć do klasy. Sprawdź kod i spróbuj ponownie.",
  SERVICE_UNAVAILABLE: "Usługa jest chwilowo niedostępna.",
};

const acceptanceResultSchema = z.array(z.object({ class_id: z.uuid(), already_member: z.boolean() }).strict());
const supabaseResponseSchema = z.object({ data: z.unknown(), error: z.unknown().nullable() });

export interface JoinByCodeHandlerDependencies {
  createSupabaseClient?: typeof createClient;
  acceptClass?: (client: RequestClient, classCode: string) => Promise<unknown>;
}

function jsonResponse(body: ClassApiError | ClassJoinSuccess, status: number): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json; charset=utf-8" }, status });
}

function errorResponse(code: ClassApiErrorCode, status: number): Response {
  return jsonResponse(classApiErrorSchema.parse({ error: { code, message: ERROR_MESSAGES[code] } }), status);
}

async function acceptClass(client: RequestClient, classCode: string): Promise<unknown> {
  const response: unknown = await client.rpc("accept_class_by_code", { p_class_code: classCode });
  const { data, error } = supabaseResponseSchema.parse(response);
  if (error) throw new Error("Class acceptance failed");
  return data;
}

export function createJoinByCodeHandler(dependencies: JoinByCodeHandlerDependencies = {}): APIRoute {
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const accept = dependencies.acceptClass ?? acceptClass;

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
      const result = acceptanceResultSchema.safeParse(await accept(supabase, parsed.data.classCode));
      if (!result.success || !result.data[0]) return errorResponse("PERSISTENCE_FAILURE", 500);
      return jsonResponse({ redirectTo: "/classes/joined", alreadyMember: result.data[0].already_member }, 200);
    } catch {
      return errorResponse("PERSISTENCE_FAILURE", 500);
    }
  };
}

export const POST = createJoinByCodeHandler();
