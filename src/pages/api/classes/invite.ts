import type { APIRoute } from "astro";
import { PUBLIC_APP_ORIGIN, RESEND_API_KEY, RESEND_FROM_EMAIL } from "astro:env/server";
import { z } from "zod";

import { classApiErrorSchema, inviteStudentsRequestSchema } from "@/lib/classes/schemas";
import {
  ClassInvitationOwnershipError,
  deliverClassInvitations,
  type ClassInvitationPersistence,
} from "@/lib/services/class-invitations";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient, createServiceClient } from "@/lib/supabase";
import type { ClassApiError, ClassApiErrorCode, InviteStudentsSuccess } from "@/types";

export const prerender = false;

const ERROR_MESSAGES: Record<ClassApiErrorCode, string> = {
  INVALID_REQUEST: "Nieprawidłowa lista adresów e-mail.",
  UNAUTHENTICATED: "Zaloguj się, aby wysłać zaproszenia.",
  FORBIDDEN: "Zaproszenia są dostępne tylko dla właściciela klasy.",
  DATABASE_UNAVAILABLE: "Baza danych jest chwilowo niedostępna.",
  PERSISTENCE_FAILURE: "Nie udało się przygotować zaproszeń. Spróbuj ponownie później.",
  SERVICE_UNAVAILABLE: "Usługa wysyłki zaproszeń nie jest skonfigurowana.",
};

type RequestClient = NonNullable<ReturnType<typeof createClient>>;
type WriterClient = NonNullable<ReturnType<typeof createServiceClient>>;

const supabaseResponseSchema = z.object({ data: z.unknown(), error: z.unknown().nullable() });
const preparedInvitationSchema = z
  .object({
    recipient_email: z.string(),
    invitation_id: z.string(),
    preparation: z.enum(["created", "refreshed"]),
  })
  .strict();
const preparedInvitationsSchema = z.array(preparedInvitationSchema);

export interface InviteStudentsHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  createSupabaseClient?: typeof createClient;
  createWriterClient?: typeof createServiceClient;
  deliver?: typeof deliverClassInvitations;
  providerConfig?: { apiKey?: string; fromEmail?: string; appOrigin?: string };
  createPersistence?: (requestClient: RequestClient, writerClient: WriterClient) => ClassInvitationPersistence;
}

function jsonResponse(body: ClassApiError | InviteStudentsSuccess, status: number): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json; charset=utf-8" }, status });
}

function errorResponse(code: ClassApiErrorCode, status: number): Response {
  return jsonResponse(classApiErrorSchema.parse({ error: { code, message: ERROR_MESSAGES[code] } }), status);
}

function environmentValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function supabaseError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Supabase request failed");
}

function createPersistence(requestClient: RequestClient, writerClient: WriterClient): ClassInvitationPersistence {
  return {
    async loadClassName(classId) {
      const response: unknown = await requestClient.from("classes").select("name").eq("id", classId).maybeSingle();
      const { data, error } = supabaseResponseSchema.parse(response);
      if (error) throw supabaseError(error);
      const result = z.object({ name: z.string() }).nullable().safeParse(data);
      return result.success ? (result.data?.name ?? null) : null;
    },
    async prepare(classId, emails, tokenDigests) {
      const response: unknown = await requestClient.rpc("prepare_class_invitations", {
        p_class_id: classId,
        p_emails: emails,
        p_token_digests: tokenDigests,
      });
      const { data, error } = supabaseResponseSchema.parse(response);
      const prepared = preparedInvitationsSchema.safeParse(data);
      if (error) throw supabaseError(error);
      if (!prepared.success) throw new Error("Invalid invitation preparation result");
      return prepared.data.map((row) => ({
        recipientEmail: row.recipient_email,
        invitationId: row.invitation_id,
        preparation: row.preparation,
      }));
    },
    async recordDelivery(invitationId, tokenDigest, deliveryState, providerMessageId) {
      const response: unknown = await writerClient.rpc("record_class_invitation_delivery", {
        p_invitation_id: invitationId,
        p_token_digest: tokenDigest,
        p_delivery_state: deliveryState,
        p_provider_message_id: providerMessageId ?? null,
      });
      const { data, error } = supabaseResponseSchema.parse(response);
      const recorded = z.boolean().safeParse(data);
      if (error) throw supabaseError(error);
      if (!recorded.success) throw new Error("Invalid delivery record result");
      return recorded.data;
    },
  };
}

export function createInviteStudentsHandler(dependencies: InviteStudentsHandlerDependencies = {}): APIRoute {
  const authorize = dependencies.authorize ?? authorizeTeacher;
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const createWriterClient = dependencies.createWriterClient ?? createServiceClient;
  const deliver = dependencies.deliver ?? deliverClassInvitations;
  const providerConfig = dependencies.providerConfig ?? {
    apiKey: environmentValue(RESEND_API_KEY),
    fromEmail: environmentValue(RESEND_FROM_EMAIL),
    appOrigin: environmentValue(PUBLIC_APP_ORIGIN),
  };
  const persistenceFactory = dependencies.createPersistence ?? createPersistence;

  return async (context) => {
    let value: unknown;
    try {
      value = await context.request.json();
    } catch {
      return errorResponse("INVALID_REQUEST", 400);
    }
    const parsed = inviteStudentsRequestSchema.safeParse(value);
    if (!parsed.success) return errorResponse("INVALID_REQUEST", 400);

    const supabase = createSupabaseClient(context.request.headers, context.cookies);
    const authorization = await authorize(context.locals, supabase);
    if (authorization.status === "unauthenticated") return errorResponse("UNAUTHENTICATED", 401);
    if (authorization.status !== "authorized-teacher") return errorResponse("FORBIDDEN", 403);
    if (!supabase) return errorResponse("DATABASE_UNAVAILABLE", 503);

    const writer = createWriterClient();
    if (!providerConfig.apiKey || !providerConfig.fromEmail || !providerConfig.appOrigin || !writer) {
      return errorResponse("SERVICE_UNAVAILABLE", 503);
    }

    try {
      const results = await deliver(persistenceFactory(supabase, writer), parsed.data, {
        apiKey: providerConfig.apiKey,
        fromEmail: providerConfig.fromEmail,
        appOrigin: providerConfig.appOrigin,
      });
      return jsonResponse({ results }, 200);
    } catch (error) {
      if (error instanceof ClassInvitationOwnershipError) return errorResponse("FORBIDDEN", 403);
      return errorResponse("PERSISTENCE_FAILURE", 500);
    }
  };
}

export const POST = createInviteStudentsHandler();
