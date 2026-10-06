import type { APIRoute } from "astro";
import { z } from "zod";

import { acceptClassInvitationRequestSchema, classApiErrorSchema } from "@/lib/classes/schemas";
import { digestClassInvitationToken } from "@/lib/classes/invitation-token";
import { createClient } from "@/lib/supabase";
import type { ClassApiError, ClassApiErrorCode, ClassJoinSuccess } from "@/types";

export const prerender = false;

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

const ERROR_MESSAGES: Record<ClassApiErrorCode, string> = {
  INVALID_REQUEST: "Nieprawidłowe zaproszenie.",
  UNAUTHENTICATED: "Zaloguj się, aby przyjąć zaproszenie.",
  FORBIDDEN: "Nie można przyjąć tego zaproszenia.",
  DATABASE_UNAVAILABLE: "Baza danych jest chwilowo niedostępna.",
  PERSISTENCE_FAILURE: "Zaproszenie jest niedostępne. Sprawdź konto i spróbuj ponownie.",
  SERVICE_UNAVAILABLE: "Usługa jest chwilowo niedostępna.",
};

const acceptanceResultSchema = z.array(z.object({ class_id: z.uuid(), already_member: z.boolean() }).strict());
const supabaseResponseSchema = z.object({ data: z.unknown(), error: z.unknown().nullable() });

export interface AcceptInvitationHandlerDependencies {
  createSupabaseClient?: typeof createClient;
  digestToken?: typeof digestClassInvitationToken;
  acceptInvitation?: (client: RequestClient, tokenDigest: string) => Promise<unknown>;
}

function jsonResponse(body: ClassApiError | ClassJoinSuccess, status: number): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json; charset=utf-8" }, status });
}

function errorResponse(code: ClassApiErrorCode, status: number): Response {
  return jsonResponse(classApiErrorSchema.parse({ error: { code, message: ERROR_MESSAGES[code] } }), status);
}

async function acceptInvitation(client: RequestClient, tokenDigest: string): Promise<unknown> {
  const response: unknown = await client.rpc("accept_class_invitation", { p_token_digest: tokenDigest });
  const { data, error } = supabaseResponseSchema.parse(response);
  if (error) throw new Error("Invitation acceptance failed");
  return data;
}

export function createAcceptInvitationHandler(dependencies: AcceptInvitationHandlerDependencies = {}): APIRoute {
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const digestToken = dependencies.digestToken ?? digestClassInvitationToken;
  const accept = dependencies.acceptInvitation ?? acceptInvitation;

  return async (context) => {
    let value: unknown;
    try {
      value = await context.request.json();
    } catch {
      return errorResponse("INVALID_REQUEST", 400);
    }
    const parsed = acceptClassInvitationRequestSchema.safeParse(value);
    if (!parsed.success) return errorResponse("INVALID_REQUEST", 400);
    if (!context.locals.user) return errorResponse("UNAUTHENTICATED", 401);

    const supabase = createSupabaseClient(context.request.headers, context.cookies);
    if (!supabase) return errorResponse("DATABASE_UNAVAILABLE", 503);

    try {
      const tokenDigest = await digestToken(parsed.data.token);
      const result = acceptanceResultSchema.safeParse(await accept(supabase, tokenDigest));
      if (!result.success || !result.data[0]) return errorResponse("PERSISTENCE_FAILURE", 500);
      return jsonResponse({ redirectTo: "/classes/joined", alreadyMember: result.data[0].already_member }, 200);
    } catch {
      return errorResponse("PERSISTENCE_FAILURE", 500);
    }
  };
}

export const POST = createAcceptInvitationHandler();
