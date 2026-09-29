import type { APIRoute } from "astro";

import {
  exerciseApprovalErrorSchema,
  exerciseApprovalRequestSchema,
  exerciseApprovalRpcRowSchema,
  exerciseApprovalSuccessSchema,
} from "@/lib/exercises/schemas";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient } from "@/lib/supabase";
import type { ExerciseApprovalError, ExerciseApprovalErrorCode, ExerciseApprovalSuccess } from "@/types";

export const prerender = false;

const ERROR_MESSAGES: Record<ExerciseApprovalErrorCode, string> = {
  INVALID_REQUEST: "Nieprawidłowe dane żądania zatwierdzenia.",
  UNAUTHENTICATED: "Zaloguj się, aby zatwierdzić zadania.",
  FORBIDDEN: "Zatwierdzanie zadań jest dostępne tylko dla nauczycieli.",
  INVALID_SELECTION: "Wybrane zadania nie mogą zostać zatwierdzone.",
  DATABASE_UNAVAILABLE: "Baza danych jest chwilowo niedostępna. Spróbuj ponownie później.",
  PERSISTENCE_FAILURE: "Nie udało się zapisać zatwierdzonych zadań. Spróbuj ponownie później.",
};

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

interface ApprovalFailure {
  code?: string;
}

export interface ExerciseApproveHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  createSupabaseClient?: (
    headers: Headers,
    cookies: Parameters<typeof createClient>[1],
  ) => ReturnType<typeof createClient>;
  approve?: (client: RequestClient, verificationIds: string[]) => Promise<unknown>;
}

function jsonResponse(body: ExerciseApprovalError | ExerciseApprovalSuccess, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function errorResponse(code: ExerciseApprovalErrorCode, status: number, message = ERROR_MESSAGES[code]): Response {
  return jsonResponse(exerciseApprovalErrorSchema.parse({ error: { code, message } }), status);
}

async function approveVerifiedExercises(client: RequestClient, verificationIds: string[]): Promise<unknown> {
  const result = (await client.rpc("approve_verified_exercises", { verification_ids: verificationIds })) as {
    data: unknown;
    error: ApprovalFailure | null;
  };
  if (result.error) {
    throw Object.assign(new Error("Exercise approval failed"), { code: result.error.code });
  }
  return result.data;
}

function isDatabaseUnavailable(error: ApprovalFailure): boolean {
  return error.code?.startsWith("08") === true || ["PGRST000", "PGRST001", "PGRST002"].includes(error.code ?? "");
}

export function createExerciseApproveHandler(dependencies: ExerciseApproveHandlerDependencies = {}): APIRoute {
  const authorize = dependencies.authorize ?? authorizeTeacher;
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const approve = dependencies.approve ?? approveVerifiedExercises;

  return async (context) => {
    let requestValue: unknown;
    try {
      requestValue = await context.request.json();
    } catch {
      return errorResponse("INVALID_REQUEST", 400);
    }

    const parsedRequest = exerciseApprovalRequestSchema.safeParse(requestValue);
    if (!parsedRequest.success) {
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
      const rpcRows = exerciseApprovalRpcRowSchema
        .array()
        .parse(await approve(supabase, parsedRequest.data.verificationIds));
      if (
        rpcRows.length !== parsedRequest.data.verificationIds.length ||
        rpcRows.some((row, index) => row.verification_id !== parsedRequest.data.verificationIds[index])
      ) {
        return errorResponse("PERSISTENCE_FAILURE", 500);
      }

      const response = exerciseApprovalSuccessSchema.parse({
        mappings: rpcRows.map((row) => ({
          verificationId: row.verification_id,
          exerciseId: row.exercise_id,
          created: row.created,
        })),
      });
      return jsonResponse(response, 200);
    } catch (error) {
      const failure = typeof error === "object" && error !== null ? (error as ApprovalFailure) : {};
      if (failure.code === "22023") {
        return errorResponse("INVALID_SELECTION", 422);
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

export const POST = createExerciseApproveHandler();
