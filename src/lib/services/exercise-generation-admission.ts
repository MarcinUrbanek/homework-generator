import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  exerciseGenerationAdmissionResultSchema,
  exerciseGenerationReleaseResultSchema,
} from "@/lib/exercises/schemas";

const supabaseRpcResponseSchema = z.looseObject({
  data: z.unknown(),
  error: z.unknown(),
});

export type ExerciseGenerationAdmissionDecision =
  | { status: "admitted"; reservationId: string }
  | { status: "quota-exceeded"; retryAfterSeconds: number }
  | { status: "in-progress"; retryAfterSeconds: number }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type ExerciseGenerationReleaseDecision = "released" | "stale-token" | "unavailable";

function isForbiddenRpcError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42501";
}

export async function admitExerciseGeneration(
  supabase: SupabaseClient | null,
): Promise<ExerciseGenerationAdmissionDecision> {
  if (!supabase) return { status: "unavailable" };

  try {
    const response: unknown = await supabase.rpc("admit_exercise_generation");
    const parsedResponse = supabaseRpcResponseSchema.safeParse(response);
    if (!parsedResponse.success) return { status: "unavailable" };
    if (parsedResponse.data.error !== null) {
      return isForbiddenRpcError(parsedResponse.data.error) ? { status: "forbidden" } : { status: "unavailable" };
    }

    const result = exerciseGenerationAdmissionResultSchema.safeParse(parsedResponse.data.data);
    if (!result.success) return { status: "unavailable" };

    switch (result.data.status) {
      case "admitted":
        return { status: "admitted", reservationId: result.data.reservation_id };
      case "quota-exceeded":
      case "in-progress":
        return { status: result.data.status, retryAfterSeconds: result.data.retry_after_seconds };
    }
  } catch {
    return { status: "unavailable" };
  }
}

export async function releaseExerciseGeneration(
  supabase: SupabaseClient | null,
  reservationId: string,
): Promise<ExerciseGenerationReleaseDecision> {
  if (!supabase) return "unavailable";

  try {
    const response: unknown = await supabase.rpc("release_exercise_generation", {
      p_reservation_id: reservationId,
    });
    const parsedResponse = supabaseRpcResponseSchema.safeParse(response);
    if (!parsedResponse.success || parsedResponse.data.error !== null) return "unavailable";

    const result = exerciseGenerationReleaseResultSchema.safeParse(parsedResponse.data.data);
    if (!result.success) return "unavailable";
    return result.data ? "released" : "stale-token";
  } catch {
    return "unavailable";
  }
}
