import type { APIRoute } from "astro";

import {
  exerciseVerificationLedgerRowSchema,
  exerciseVerificationErrorSchema,
  exerciseVerificationRequestSchema,
  exerciseVerificationSuccessSchema,
} from "@/lib/exercises/schemas";
import { ArithmeticAuthorityError, renderArithmeticExercise } from "@/lib/exercises/arithmetic-authority";
import { verifyArithmeticExercise } from "@/lib/services/arithmetic-exercise-verifier";
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
  "arithmetic_structure",
  "authority_version",
].join(",");

const ERROR_MESSAGES: Record<ExerciseVerificationErrorCode, string> = {
  INVALID_REQUEST: "Nieprawidłowe dane żądania weryfikacji.",
  UNAUTHENTICATED: "Zaloguj się, aby zweryfikować zadania.",
  FORBIDDEN: "Weryfikacja zadań jest dostępna tylko dla nauczycieli.",
  VERIFIER_NOT_CONFIGURED: "Weryfikacja zadań nie jest skonfigurowana.",
  PERSISTENCE_UNAVAILABLE: "Nie można skonfigurować zapisu wyników weryfikacji.",
  CANDIDATE_CONFLICT: "Identyfikator kandydata został już użyty dla innej treści.",
  PERSISTENCE_FAILURE: "Nie udało się zapisać wyniku weryfikacji. Spróbuj ponownie później.",
  VERIFICATION_FAILURE: "Nie udało się obliczyć wyniku weryfikacji. Spróbuj ponownie później.",
};

type RequestClient = ReturnType<typeof createClient>;
type ServiceClient = NonNullable<ReturnType<typeof createServiceClient>>;
type LedgerRow = ReturnType<typeof exerciseVerificationLedgerRowSchema.parse>;

class VerificationPersistenceError extends Error {}

class CandidateConflictError extends Error {}

class VerificationExecutionError extends Error {}

export interface ExerciseVerifyHandlerDependencies {
  authorize?: typeof authorizeTeacher;
  verify?: (
    candidate: ExerciseCandidate,
  ) => ReturnType<typeof verifyArithmeticExercise> | Promise<ReturnType<typeof verifyArithmeticExercise>>;
  createSupabaseClient?: (headers: Headers, cookies: Parameters<typeof createClient>[1]) => RequestClient;
  createWriterClient?: () => ServiceClient | null;
  loadExisting?: (client: ServiceClient, teacherId: string, candidateIds: string[]) => Promise<LedgerRow[]>;
  record?: (
    client: ServiceClient,
    teacherId: string,
    candidate: ExerciseCandidate,
    evidence: ExerciseVerificationEvidence,
  ) => Promise<LedgerRow>;
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
      arithmetic_structure: candidate.arithmeticStructure ?? null,
      authority_version: evidence.authorityVersion,
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
  const structure = candidate.arithmeticStructure ?? null;
  const authorityVersion =
    typeof structure === "object" && structure !== null && "version" in structure && structure.version === 1 ? 1 : null;
  return (
    row.candidate_id === candidate.id &&
    row.candidate_text === candidate.text &&
    row.proposed_canonical_answer === candidate.proposedCanonicalAnswer &&
    row.grade === String(candidate.grade) &&
    row.topic === candidate.topic &&
    row.difficulty === candidate.difficulty &&
    stableJson(row.arithmetic_structure) === stableJson(structure) &&
    row.authority_version === authorityVersion
  );
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function currentAuthoritySnapshot(row: LedgerRow) {
  if (row.authority_version !== 1 || row.arithmetic_structure === null) {
    return null;
  }

  try {
    const rendered = renderArithmeticExercise(
      {
        grade: 4,
        topic: row.topic,
        difficulty: row.difficulty,
      },
      row.arithmetic_structure,
    );
    if (rendered.text !== row.candidate_text || rendered.proposedCanonicalAnswer !== row.verified_answer) {
      return null;
    }
    if (
      (row.outcome === "unique_answer" && rendered.proposedCanonicalAnswer !== row.proposed_canonical_answer) ||
      (row.outcome === "answer_mismatch" && rendered.proposedCanonicalAnswer === row.proposed_canonical_answer) ||
      (row.outcome !== "unique_answer" && row.outcome !== "answer_mismatch")
    ) {
      return null;
    }
    return rendered;
  } catch (error) {
    if (error instanceof ArithmeticAuthorityError) {
      return null;
    }
    throw new VerificationPersistenceError();
  }
}

function resultFromRow(row: LedgerRow): ExerciseVerificationResult {
  const authoritySnapshot = currentAuthoritySnapshot(row);
  const base = {
    verificationId: row.id,
    candidateId: row.candidate_id,
    rationale: row.rationale,
    verifierIdentity: row.verifier_identity,
    verifierVersion: row.verifier_version,
    verifiedAt: row.verified_at,
    arithmeticStructure: authoritySnapshot?.arithmeticStructure ?? null,
    authorityVersion: authoritySnapshot ? 1 : null,
  };

  if (row.outcome === "unsupported_evidence") {
    return { ...base, outcome: row.outcome, verifiedAnswer: null };
  }
  if (!authoritySnapshot) {
    return {
      ...base,
      outcome: "unsupported_evidence",
      verifiedAnswer: null,
      rationale: "Starszy wynik nie zawiera aktualnego, strukturalnego dowodu arytmetycznego.",
      arithmeticStructure: null,
      authorityVersion: null,
    };
  }
  if (row.outcome !== "unique_answer" && row.outcome !== "answer_mismatch") {
    throw new VerificationPersistenceError();
  }
  if (row.verified_answer === null) {
    throw new VerificationPersistenceError();
  }
  return { ...base, outcome: row.outcome, verifiedAnswer: row.verified_answer };
}

export function createExerciseVerifyHandler(dependencies: ExerciseVerifyHandlerDependencies = {}): APIRoute {
  const authorize = dependencies.authorize ?? authorizeTeacher;
  const verify = dependencies.verify ?? verifyArithmeticExercise;
  const createSupabaseClient = dependencies.createSupabaseClient ?? createClient;
  const createWriterClient = dependencies.createWriterClient ?? createServiceClient;
  const loadExisting = dependencies.loadExisting ?? loadExistingVerifications;
  const record = dependencies.record ?? recordVerification;

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

    let writer: ServiceClient | null;
    try {
      writer = createWriterClient();
    } catch {
      return errorResponse("PERSISTENCE_UNAVAILABLE", 503);
    }
    if (!writer) {
      return errorResponse("PERSISTENCE_UNAVAILABLE", 503);
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

          let evidence: ExerciseVerificationEvidence;
          try {
            evidence = await verify(candidate);
          } catch {
            throw new VerificationExecutionError();
          }

          let row: LedgerRow;
          try {
            row = await record(writer, teacherId, candidate, evidence);
          } catch {
            throw new VerificationPersistenceError();
          }
          if (!snapshotMatches(row, candidate)) {
            throw new CandidateConflictError();
          }
          return resultFromRow(row);
        }),
      );

      const response = exerciseVerificationSuccessSchema.parse({ results });
      return jsonResponse(response, 200);
    } catch (error) {
      if (error instanceof CandidateConflictError) {
        return errorResponse("CANDIDATE_CONFLICT", 409);
      }
      if (error instanceof VerificationExecutionError) {
        return errorResponse("VERIFICATION_FAILURE", 500);
      }
      return errorResponse("PERSISTENCE_FAILURE", 500);
    }
  };
}

export const POST = createExerciseVerifyHandler();
