import type { APIRoute } from "astro";
import { OPENROUTER_API_KEY, OPENROUTER_VERIFIER_MODEL } from "astro:env/server";

import {
  exerciseVerificationLedgerRowSchema,
  exerciseVerificationErrorSchema,
  exerciseVerificationRequestSchema,
  exerciseVerificationSuccessSchema,
} from "@/lib/exercises/schemas";
import { OpenRouterExerciseVerifierError, verifyOpenRouterExercise } from "@/lib/services/openrouter-exercise-verifier";
import { authorizeTeacher } from "@/lib/services/teacher-authorization";
import { createClient, createServiceClient } from "@/lib/supabase";
import type {
  ExerciseCandidate,
  ExerciseVerificationError,
  ExerciseVerificationErrorCode,
  ExerciseVerificationEvidence,
  ExerciseVerificationResult,
  ExerciseVerificationSuccess,
} from "@/types";

export const prerender = false;

const LEDGER_COLUMNS = [
  "id",
  "teacher_id",
  "candidate_id",
  "candidate_text",
  "proposed_canonical_answer",
  "grade",
  "topic",
  "difficulty",
  "outcome",
  "verified_answer",
  "verifier_identity",
  "verifier_version",
  "verified_at",
  "rationale",
].join(",");

const ERROR_MESSAGES: Record<ExerciseVerificationErrorCode, string> = {
  INVALID_REQUEST: "Nieprawidłowe dane żądania weryfikacji.",
  UNAUTHENTICATED: "Zaloguj się, aby zweryfikować zadania.",
  FORBIDDEN: "Weryfikacja zadań jest dostępna tylko dla nauczycieli.",
  VERIFIER_NOT_CONFIGURED: "Weryfikacja zadań nie jest skonfigurowana.",
  CANDIDATE_CONFLICT: "Identyfikator kandydata został już użyty dla innej treści.",
  PERSISTENCE_FAILURE: "Nie udało się zapisać wyniku weryfikacji. Spróbuj ponownie później.",
};

type RequestClient = ReturnType<typeof createClient>;
type ServiceClient = NonNullable<ReturnType<typeof createServiceClient>>;
type LedgerRow = ReturnType<typeof exerciseVerificationLedgerRowSchema.parse>;

class VerificationPersistenceError extends Error {}

class CandidateConflictError extends Error {}

export interface ExerciseVerifyHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  verify?: typeof verifyOpenRouterExercise;
  createSupabaseClient?: (headers: Headers, cookies: Parameters<typeof createClient>[1]) => RequestClient;
  createWriterClient?: () => ServiceClient | null;
  loadExisting?: (client: ServiceClient, teacherId: string, candidateIds: string[]) => Promise<LedgerRow[]>;
  record?: (
    client: ServiceClient,
    teacherId: string,
    candidate: ExerciseCandidate,
    evidence: ExerciseVerificationEvidence,
  ) => Promise<LedgerRow>;
  providerConfig?: { apiKey?: string; model?: string };
}

function jsonResponse(body: ExerciseVerificationError | ExerciseVerificationSuccess, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function errorResponse(code: ExerciseVerificationErrorCode, status: number, message = ERROR_MESSAGES[code]): Response {
  return jsonResponse(exerciseVerificationErrorSchema.parse({ error: { code, message } }), status);
}

async function loadExistingVerifications(
  client: ServiceClient,
  teacherId: string,
  candidateIds: string[],
): Promise<LedgerRow[]> {
  const { data, error } = await client
    .from("exercise_verifications")
    .select(LEDGER_COLUMNS)
    .eq("teacher_id", teacherId)
    .in("candidate_id", candidateIds);

  if (error) {
    throw new VerificationPersistenceError();
  }

  const rows = exerciseVerificationLedgerRowSchema.array().safeParse(data);
  if (!rows.success) {
    throw new VerificationPersistenceError();
  }
  return rows.data;
}

async function recordVerification(
  client: ServiceClient,
  teacherId: string,
  candidate: ExerciseCandidate,
  evidence: ExerciseVerificationEvidence,
): Promise<LedgerRow> {
  const { data, error } = await client
    .from("exercise_verifications")
    .insert({
      teacher_id: teacherId,
      candidate_id: candidate.id,
      candidate_text: candidate.text,
      proposed_canonical_answer: candidate.proposedCanonicalAnswer,
      grade: String(candidate.grade),
      topic: candidate.topic,
      difficulty: candidate.difficulty,
      outcome: evidence.outcome,
      verified_answer: evidence.verifiedAnswer,
      verifier_identity: evidence.verifierIdentity,
      verifier_version: evidence.verifierVersion,
      verified_at: evidence.verifiedAt,
      rationale: evidence.rationale,
    })
    .select(LEDGER_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await loadExistingVerifications(client, teacherId, [candidate.id]);
      if (existing.length === 1) {
        return existing[0];
      }
    }
    throw new VerificationPersistenceError();
  }

  const row = exerciseVerificationLedgerRowSchema.safeParse(data);
  if (!row.success) {
    throw new VerificationPersistenceError();
  }
  return row.data;
}

function snapshotMatches(row: LedgerRow, candidate: ExerciseCandidate): boolean {
  return (
    row.candidate_id === candidate.id &&
    row.candidate_text === candidate.text &&
    row.proposed_canonical_answer === candidate.proposedCanonicalAnswer &&
    row.grade === String(candidate.grade) &&
    row.topic === candidate.topic &&
    row.difficulty === candidate.difficulty
  );
}

function resultFromRow(row: LedgerRow): ExerciseVerificationResult {
  const base = {
    verificationId: row.id,
    candidateId: row.candidate_id,
    rationale: row.rationale,
    verifierIdentity: row.verifier_identity,
    verifierVersion: row.verifier_version,
    verifiedAt: row.verified_at,
  };

  if (row.outcome === "not_unique_answer") {
    return { ...base, outcome: row.outcome, verifiedAnswer: null };
  }
  if (row.verified_answer === null) {
    throw new VerificationPersistenceError();
  }
  return { ...base, outcome: row.outcome, verifiedAnswer: row.verified_answer };
}

export function createExerciseVerifyHandler(dependencies: ExerciseVerifyHandlerDependencies = {}): APIRoute {
  const authorize = dependencies.authorize ?? authorizeTeacher;
  const verify = dependencies.verify ?? verifyOpenRouterExercise;
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const createWriterClient = dependencies.createWriterClient ?? createServiceClient;
  const loadExisting = dependencies.loadExisting ?? loadExistingVerifications;
  const record = dependencies.record ?? recordVerification;
  const providerConfig = dependencies.providerConfig ?? {
    apiKey: OPENROUTER_API_KEY,
    model: OPENROUTER_VERIFIER_MODEL,
  };

  return async (context) => {
    let requestValue: unknown;
    try {
      requestValue = await context.request.json();
    } catch {
      return errorResponse("INVALID_REQUEST", 400);
    }

    const parsedRequest = exerciseVerificationRequestSchema.safeParse(requestValue);
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
    if (authorization.status === "profile-unavailable" || !context.locals.user) {
      return errorResponse("FORBIDDEN", 403, "Nie można potwierdzić uprawnień nauczyciela.");
    }

    const writer = createWriterClient();
    const apiKey = providerConfig.apiKey;
    const model = providerConfig.model;
    if (!apiKey || !model || !writer) {
      return errorResponse("VERIFIER_NOT_CONFIGURED", 503);
    }

    const { candidates } = parsedRequest.data;
    const teacherId = context.locals.user.id;

    try {
      const existingRows = await loadExisting(
        writer,
        teacherId,
        candidates.map(({ id }) => id),
      );
      if (existingRows.some((row) => row.teacher_id !== teacherId)) {
        throw new VerificationPersistenceError();
      }
      const existingByCandidateId = new Map(existingRows.map((row) => [row.candidate_id, row]));

      for (const candidate of candidates) {
        const existing = existingByCandidateId.get(candidate.id);
        if (existing && !snapshotMatches(existing, candidate)) {
          return errorResponse("CANDIDATE_CONFLICT", 409);
        }
      }

      const results = await Promise.all(
        candidates.map(async (candidate): Promise<ExerciseVerificationResult> => {
          const existing = existingByCandidateId.get(candidate.id);
          if (existing) {
            return resultFromRow(existing);
          }

          try {
            const evidence = await verify(candidate, {
              apiKey,
              model,
            });
            const row = await record(writer, teacherId, candidate, evidence);
            if (!snapshotMatches(row, candidate)) {
              throw new CandidateConflictError();
            }
            return resultFromRow(row);
          } catch (error) {
            if (error instanceof OpenRouterExerciseVerifierError) {
              return {
                candidateId: candidate.id,
                outcome: "indeterminate",
                error: {
                  code: error.code,
                  message:
                    error.code === "PROVIDER_TIMEOUT"
                      ? "Weryfikator nie odpowiedział na czas. Spróbuj ponownie."
                      : "Nie udało się zweryfikować zadania. Spróbuj ponownie później.",
                },
              };
            }
            throw error;
          }
        }),
      );

      const response = exerciseVerificationSuccessSchema.parse({ results });
      return jsonResponse(response, 200);
    } catch (error) {
      if (error instanceof CandidateConflictError) {
        return errorResponse("CANDIDATE_CONFLICT", 409);
      }
      return errorResponse("PERSISTENCE_FAILURE", 500);
    }
  };
}

export const POST = createExerciseVerifyHandler();
