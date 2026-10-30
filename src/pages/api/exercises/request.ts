import type { APIRoute } from "astro";
import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from "astro:env/server";

import { isSupportedArithmeticTopic } from "@/lib/exercises/catalog";
import { exerciseGenerationRequestSchema } from "@/lib/exercises/schemas";
import {
  generateOpenRouterExercises,
  OpenRouterExerciseGeneratorError,
} from "@/lib/services/openrouter-exercise-generator";
import { admitExerciseGeneration, releaseExerciseGeneration } from "@/lib/services/exercise-generation-admission";
import { logError } from "@/lib/observability/log-error";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient } from "@/lib/supabase";
import type { ExerciseGenerationError, ExerciseGenerationErrorCode, ExerciseGenerationSuccess } from "@/types";

export const prerender = false;

const ROUTE = "/api/exercises/request";

const ERROR_MESSAGES: Record<ExerciseGenerationErrorCode, string> = {
  INVALID_REQUEST: "Nieprawidłowe dane żądania.",
  UNSUPPORTED_TOPIC: "W tej wersji można generować tylko zadania z działań arytmetycznych.",
  UNAUTHENTICATED: "Zaloguj się, aby wygenerować zadania.",
  FORBIDDEN: "Generowanie zadań jest dostępne tylko dla nauczycieli.",
  PROVIDER_NOT_CONFIGURED: "Generator zadań nie jest skonfigurowany.",
  GENERATION_LIMIT_EXCEEDED: "Osiągnięto limit 10 żądań generowania w ciągu godziny. Spróbuj ponownie później.",
  GENERATION_IN_PROGRESS: "Generowanie zadań już trwa. Spróbuj ponownie po jego zakończeniu.",
  ADMISSION_UNAVAILABLE: "Nie można teraz sprawdzić limitu generowania. Spróbuj ponownie później.",
  PROVIDER_FAILURE: "Nie udało się wygenerować zadań. Spróbuj ponownie później.",
  PROVIDER_TIMEOUT: "Generator zadań nie odpowiedział na czas. Spróbuj ponownie.",
};

type AuthorizationFunction = typeof authorizeTeacher;
type GenerationFunction = typeof generateOpenRouterExercises;
type ClientFactory = typeof createClient;
type AdmissionFunction = typeof admitExerciseGeneration;
type ReleaseFunction = typeof releaseExerciseGeneration;

export interface ExerciseRequestHandlerDependencies {
  authorize?: AuthorizationFunction;
  generate?: GenerationFunction;
  admit?: AdmissionFunction;
  release?: ReleaseFunction;
  createSupabaseClient?: ClientFactory;
  providerConfig?: {
    apiKey?: string;
    model?: string;
  };
}

function jsonResponse(
  body: ExerciseGenerationError | ExerciseGenerationSuccess,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function errorResponse(
  code: ExerciseGenerationErrorCode,
  status: number,
  message = ERROR_MESSAGES[code],
  headers: Record<string, string> = {},
): Response {
  return jsonResponse({ error: { code, message } }, status, headers);
}

export function createExerciseRequestHandler(dependencies: ExerciseRequestHandlerDependencies = {}): APIRoute {
  const authorize = dependencies.authorize ?? authorizeTeacher;
  const generate = dependencies.generate ?? generateOpenRouterExercises;
  const admit = dependencies.admit ?? admitExerciseGeneration;
  const release = dependencies.release ?? releaseExerciseGeneration;
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const providerConfig = dependencies.providerConfig ?? {
    apiKey: OPENROUTER_API_KEY,
    model: OPENROUTER_MODEL,
  };

  return async (context) => {
    let requestValue: unknown;
    try {
      requestValue = await context.request.json();
    } catch {
      return errorResponse("INVALID_REQUEST", 400);
    }

    const parsedRequest = exerciseGenerationRequestSchema.safeParse(requestValue);
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

    if (!isSupportedArithmeticTopic(parsedRequest.data.topic)) {
      return errorResponse("UNSUPPORTED_TOPIC", 422);
    }

    if (!providerConfig.apiKey || !providerConfig.model) {
      return errorResponse("PROVIDER_NOT_CONFIGURED", 503);
    }

    const userId = context.locals.user?.id ?? null;

    let admission: Awaited<ReturnType<AdmissionFunction>>;
    try {
      admission = await admit(supabase);
    } catch (error) {
      logError({ event: "exercise_generation_admission_unavailable", route: ROUTE, userId }, error);
      return errorResponse("ADMISSION_UNAVAILABLE", 503);
    }

    if (admission.status === "forbidden") {
      return errorResponse("FORBIDDEN", 403);
    }
    if (admission.status === "quota-exceeded") {
      return errorResponse("GENERATION_LIMIT_EXCEEDED", 429, ERROR_MESSAGES.GENERATION_LIMIT_EXCEEDED, {
        "Retry-After": String(admission.retryAfterSeconds),
      });
    }
    if (admission.status === "in-progress") {
      return errorResponse("GENERATION_IN_PROGRESS", 429, ERROR_MESSAGES.GENERATION_IN_PROGRESS, {
        "Retry-After": String(admission.retryAfterSeconds),
      });
    }
    if (admission.status === "unavailable") {
      logError({ event: "exercise_generation_admission_unavailable", route: ROUTE, userId });
      return errorResponse("ADMISSION_UNAVAILABLE", 503);
    }

    const reservationId = admission.reservationId;
    try {
      try {
        const candidates = await generate(parsedRequest.data, {
          apiKey: providerConfig.apiKey,
          model: providerConfig.model,
        });
        if (candidates.length < 1 || candidates.length > 5) {
          logError({
            event: "exercise_generation_provider_failure",
            route: ROUTE,
            userId,
            reason: "candidate_count_out_of_range",
            candidateCount: candidates.length,
          });
          return errorResponse("PROVIDER_FAILURE", 502);
        }
        const validCount = candidates.length as 1 | 2 | 3 | 4 | 5;
        const response: ExerciseGenerationSuccess = {
          requestedCount: 5,
          validCount,
          candidates,
          ...(validCount < 5 ? { partial_batch: true as const } : {}),
        };

        return jsonResponse(response, 200);
      } catch (error) {
        if (error instanceof OpenRouterExerciseGeneratorError && error.code === "PROVIDER_TIMEOUT") {
          return errorResponse("PROVIDER_TIMEOUT", 504);
        }
        if (error instanceof OpenRouterExerciseGeneratorError && error.code === "UNSUPPORTED_TOPIC") {
          return errorResponse("UNSUPPORTED_TOPIC", 422);
        }
        // The public contract stays 502 PROVIDER_FAILURE; the log tells provider failures apart from our own bugs.
        logError(
          {
            event:
              error instanceof OpenRouterExerciseGeneratorError
                ? "exercise_generation_provider_failure"
                : "exercise_generation_unexpected_error",
            route: ROUTE,
            userId,
            reservationId,
          },
          error,
        );
        return errorResponse("PROVIDER_FAILURE", 502);
      }
    } finally {
      try {
        const releaseResult = await release(supabase, reservationId);
        if (releaseResult === "unavailable") {
          logError({ event: "exercise_generation_release_unavailable", route: ROUTE, userId, reservationId });
        }
      } catch (error) {
        logError({ event: "exercise_generation_release_unavailable", route: ROUTE, userId, reservationId }, error);
      }
    }
  };
}

export const POST = createExerciseRequestHandler();
