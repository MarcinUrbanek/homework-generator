import type { APIContext, APIRoute } from "astro";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderArithmeticExercise } from "@/lib/exercises/arithmetic-authority";
import { verifyOpenRouterExercise } from "@/lib/services/openrouter-exercise-verifier";
import type { TeacherAuthorizationResult } from "@/lib/services/teacher-authorization";
import { verifyArithmeticExercise } from "@/lib/services/arithmetic-exercise-verifier";
import type {
  ExerciseCandidate,
  ExerciseVerificationError,
  ExerciseVerificationEvidence,
  ExerciseVerificationSuccess,
} from "@/types";
import authorityFixtures from "@/lib/exercises/__fixtures__/arithmetic-authority-v1.json";

import { createExerciseVerifyHandler } from "./verify";

vi.mock("@/lib/services/openrouter-exercise-verifier", () => ({
  verifyOpenRouterExercise: vi.fn(),
}));

vi.mock("astro:env/server", () => ({
  SUPABASE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_URL: undefined,
}));

const teacherId = "00000000-0000-4000-8000-000000000001";
const studentId = "student-without-teacher-role";
const verificationId = "00000000-0000-4000-8000-000000000101";
const structure = {
  version: 1,
  expression: { kind: "add", left: { kind: "number", value: 20 }, right: { kind: "number", value: 5 } },
} as const;
const rendered = renderArithmeticExercise({ grade: 4, topic: "addition-subtraction", difficulty: "easy" }, structure);

const candidate: ExerciseCandidate = {
  id: "candidate-1",
  text: rendered.text,
  proposedCanonicalAnswer: rendered.proposedCanonicalAnswer,
  grade: 4,
  topic: "addition-subtraction",
  difficulty: "easy",
  approvalStatus: "unverified",
  arithmeticStructure: structure,
};
const legacyCandidate: ExerciseCandidate = {
  ...candidate,
  id: "legacy-candidate",
  arithmeticStructure: undefined,
};
const now = () => new Date("2026-09-29T12:00:00.000Z");
const evidence: ExerciseVerificationEvidence = verifyArithmeticExercise(candidate, now);

function ledgerRow(item: ExerciseCandidate = candidate, result: ExerciseVerificationEvidence = evidence) {
  return {
    id: verificationId,
    teacher_id: teacherId,
    candidate_id: item.id,
    candidate_text: item.text,
    proposed_canonical_answer: item.proposedCanonicalAnswer,
    grade: "4" as const,
    topic: item.topic,
    difficulty: item.difficulty,
    outcome: result.outcome,
    verified_answer: result.verifiedAnswer,
    verifier_identity: result.verifierIdentity,
    verifier_version: result.verifierVersion,
    verified_at: result.verifiedAt,
    rationale: result.rationale,
    arithmetic_structure: item.arithmeticStructure ?? null,
    authority_version: result.authorityVersion,
  };
}

function contextFor(body: string, userId = teacherId): APIContext {
  return {
    request: new Request("http://localhost/api/exercises/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
    locals: { user: { id: userId } },
    cookies: {},
  } as APIContext;
}

async function responseBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function handlerFor(
  options: {
    authorization?: TeacherAuthorizationResult;
    writerAvailable?: boolean;
    writerThrows?: boolean;
    existing?: ReturnType<typeof ledgerRow>[];
    verifyImplementation?: (
      item: ExerciseCandidate,
    ) => ExerciseVerificationEvidence | Promise<ExerciseVerificationEvidence>;
    recordImplementation?: (
      client: unknown,
      requestedTeacherId: string,
      item: ExerciseCandidate,
      result: ExerciseVerificationEvidence,
    ) => Promise<ReturnType<typeof ledgerRow>>;
  } = {},
) {
  const authorize = vi.fn().mockResolvedValue(options.authorization ?? { status: "authorized-teacher" });
  const verify = vi.fn(
    options.verifyImplementation ?? ((item: ExerciseCandidate) => verifyArithmeticExercise(item, now)),
  );
  const loadExisting = vi.fn().mockResolvedValue(options.existing ?? []);
  const createWriterClient = vi.fn(() => {
    if (options.writerThrows) throw new Error("sensitive writer configuration detail");
    return options.writerAvailable === false ? null : ({} as never);
  });
  const record = vi.fn(
    options.recordImplementation ??
      ((_client, _requestedTeacherId, item, result) => Promise.resolve(ledgerRow(item, result))),
  );
  const handler = createExerciseVerifyHandler({
    authorize,
    verify,
    createSupabaseClient: vi.fn(() => null),
    createWriterClient,
    loadExisting,
    record,
  });

  return { handler, authorize, verify, loadExisting, record, createWriterClient };
}

async function invoke(
  handler: APIRoute,
  value: unknown = { candidates: [candidate] },
  userId = teacherId,
): Promise<Response> {
  const body = typeof value === "string" ? value : JSON.stringify(value);
  return handler(contextFor(body, userId));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/exercises/verify", () => {
  it.each([
    { label: "invalid JSON", body: "{" },
    { label: "empty batch", body: { candidates: [] } },
    { label: "duplicate candidate IDs", body: { candidates: [candidate, candidate] } },
  ])("returns 400 for $label before authorization", async ({ body }) => {
    const { handler, authorize, verify } = handlerFor();
    const response = await invoke(handler, body);

    expect(response.status).toBe(400);
    expect((await responseBody<ExerciseVerificationError>(response)).error.code).toBe("INVALID_REQUEST");
    expect(authorize).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it.each([
    { authorization: { status: "unauthenticated" } as const, status: 401, code: "UNAUTHENTICATED" },
    { authorization: { status: "profile-unavailable" } as const, status: 403, code: "FORBIDDEN" },
  ])("maps $authorization.status authorization", async ({ authorization, status, code }) => {
    const { handler, verify } = handlerFor({ authorization });
    const response = await invoke(handler);

    expect(response.status).toBe(status);
    expect((await responseBody<ExerciseVerificationError>(response)).error.code).toBe(code);
    expect(verify).not.toHaveBeenCalled();
  });

  it("denies a student before ledger reads, verification, and writes", async () => {
    const { handler, verify, loadExisting, record, createWriterClient } = handlerFor({
      authorization: { status: "non-teacher" },
    });
    const response = await invoke(handler, { candidates: [candidate] }, studentId);

    expect(response.status).toBe(403);
    expect(createWriterClient).not.toHaveBeenCalled();
    expect(loadExisting).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(JSON.stringify(await responseBody(response))).not.toContain(candidate.text);
  });

  it("does not require verifier-provider configuration and never calls a model verifier", async () => {
    const { handler, verify, record } = handlerFor();
    const response = await invoke(handler);

    expect(response.status).toBe(200);
    expect(verify).toHaveBeenCalledWith(candidate);
    expect(verifyOpenRouterExercise).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledTimes(1);
    expect((await responseBody<ExerciseVerificationSuccess>(response)).results[0]).toMatchObject({
      outcome: "unique_answer",
      verifiedAnswer: "25",
      authorityVersion: 1,
      arithmeticStructure: structure,
    });
  });

  it("persists a mismatch when generator and model verifier agree on an incorrect answer", async () => {
    const fixture = authorityFixtures.rejectedCases.find(({ id }) => id === "incorrect-answer-with-model-agreement");
    if (!fixture) throw new Error("The independent false-agreement fixture is required.");

    const falseCandidate: ExerciseCandidate = {
      id: "false-model-agreement",
      grade: 4,
      topic: fixture.metadata.topic as ExerciseCandidate["topic"],
      difficulty: fixture.metadata.difficulty as ExerciseCandidate["difficulty"],
      approvalStatus: "unverified",
      text: fixture.statement,
      proposedCanonicalAnswer: fixture.literalAnswer,
      arithmeticStructure: fixture.structure,
    };
    const { handler, record } = handlerFor();
    const response = await invoke(handler, { candidates: [falseCandidate] });
    const result = (await responseBody<ExerciseVerificationSuccess>(response)).results[0];

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      outcome: "answer_mismatch",
      verifiedAnswer: fixture.expectedAnswer,
      authorityVersion: 1,
      arithmeticStructure: fixture.structure,
    });
    expect(record).toHaveBeenCalledWith(
      expect.anything(),
      teacherId,
      falseCandidate,
      expect.objectContaining({ outcome: "answer_mismatch", verifiedAnswer: fixture.expectedAnswer }),
    );
    expect(verifyOpenRouterExercise).not.toHaveBeenCalled();
  });

  it("returns a typed persistence configuration failure without calling verification", async () => {
    const { handler, verify } = handlerFor({ writerAvailable: false });
    const response = await invoke(handler);

    expect(response.status).toBe(503);
    expect((await responseBody<ExerciseVerificationError>(response)).error.code).toBe("PERSISTENCE_UNAVAILABLE");
    expect(verify).not.toHaveBeenCalled();
  });

  it("sanitizes writer-client initialization failures", async () => {
    const { handler, verify } = handlerFor({ writerThrows: true });
    const response = await invoke(handler);
    const body = await responseBody<ExerciseVerificationError>(response);

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("PERSISTENCE_UNAVAILABLE");
    expect(JSON.stringify(body)).not.toContain("sensitive");
    expect(verify).not.toHaveBeenCalled();
  });

  it("settles missing and unknown structures as unsupported evidence", async () => {
    const unknownCandidate: ExerciseCandidate = {
      ...candidate,
      id: "unknown",
      arithmeticStructure: { version: 999, expression: structure.expression },
    };
    const { handler } = handlerFor();
    const response = await invoke(handler, { candidates: [legacyCandidate, unknownCandidate] });
    const body = await responseBody<ExerciseVerificationSuccess>(response);

    expect(response.status).toBe(200);
    expect(body.results.map(({ outcome }) => outcome)).toEqual(["unsupported_evidence", "unsupported_evidence"]);
    expect(body.results.every((result) => result.outcome !== "indeterminate")).toBe(true);
  });

  it("reuses an ordered result only when the full structured snapshot matches", async () => {
    const { handler, verify, record } = handlerFor({ existing: [ledgerRow()] });
    const response = await invoke(handler);

    expect(response.status).toBe(200);
    expect((await responseBody<ExerciseVerificationSuccess>(response)).results[0]).toMatchObject({
      verificationId,
      candidateId: candidate.id,
      ...evidence,
    });
    expect(verify).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it("denies stale evidence when the structure or authority version differs", async () => {
    const alteredStructure = {
      ...candidate,
      arithmeticStructure: {
        version: 1,
        expression: { kind: "add", left: { kind: "number", value: 19 }, right: { kind: "number", value: 6 } },
      },
    };
    const { handler, verify, record } = handlerFor({ existing: [ledgerRow()] });

    const response = await invoke(handler, { candidates: [alteredStructure] });

    expect(response.status).toBe(409);
    expect((await responseBody<ExerciseVerificationError>(response)).error.code).toBe("CANDIDATE_CONFLICT");
    expect(verify).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it("treats an authority-version conflict as a candidate conflict", async () => {
    const fixture = authorityFixtures.rejectedCases.find(({ id }) => id === "mismatched-proof-metadata") as
      { proofMetadata?: { authorityVersion: number } } | undefined;
    if (!fixture?.proofMetadata) throw new Error("The independent mismatched-proof fixture is required.");
    const { handler, verify } = handlerFor({
      existing: [{ ...ledgerRow(), authority_version: fixture.proofMetadata.authorityVersion }],
    });

    const response = await invoke(handler);

    expect(response.status).toBe(409);
    expect((await responseBody<ExerciseVerificationError>(response)).error.code).toBe("CANDIDATE_CONFLICT");
    expect(verify).not.toHaveBeenCalled();
  });

  it("never exposes a legacy model-only unique_answer as current success", async () => {
    const fixture = authorityFixtures.rejectedCases.find(({ id }) => id === "old-model-only-success") as
      | {
          statement: string;
          literalAnswer: string;
          legacyEvidence?: {
            outcome: "unique_answer";
            verifiedAnswer: string;
            verifierIdentity: string;
            verifierVersion: string;
            verifiedAt: string;
            rationale: string;
          };
        }
      | undefined;
    if (!fixture?.legacyEvidence) throw new Error("The independent legacy model-only fixture is required.");

    const legacyFixtureCandidate: ExerciseCandidate = {
      ...legacyCandidate,
      text: fixture.statement,
      proposedCanonicalAnswer: fixture.literalAnswer,
    };
    const legacyEvidence: ExerciseVerificationEvidence = {
      ...fixture.legacyEvidence,
      arithmeticStructure: null,
      authorityVersion: null,
    };
    const legacyRow = {
      ...ledgerRow(legacyFixtureCandidate, legacyEvidence),
      arithmetic_structure: null,
      authority_version: null,
    };
    const { handler, verify, record } = handlerFor({ existing: [legacyRow] });
    const response = await invoke(handler, { candidates: [legacyFixtureCandidate] });
    const result = (await responseBody<ExerciseVerificationSuccess>(response)).results[0];

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ outcome: "unsupported_evidence", verifiedAnswer: null });
    expect(verify).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it("returns a candidate conflict when a concurrent insert wins with a different snapshot", async () => {
    const conflictingRow = { ...ledgerRow(), candidate_text: "Other text." };
    const recordImplementation = () => Promise.resolve(conflictingRow);
    const { handler } = handlerFor({ recordImplementation });

    const response = await invoke(handler);

    expect(response.status).toBe(409);
    expect((await responseBody<ExerciseVerificationError>(response)).error.code).toBe("CANDIDATE_CONFLICT");
  });

  it("returns an explicit sanitized persistence failure instead of an indeterminate provider result", async () => {
    const recordImplementation = (): Promise<ReturnType<typeof ledgerRow>> =>
      Promise.reject(new Error("sensitive database details"));
    const { handler } = handlerFor({ recordImplementation });

    const response = await invoke(handler);
    const body = await responseBody<ExerciseVerificationError>(response);

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("PERSISTENCE_FAILURE");
    expect(JSON.stringify(body)).not.toContain("sensitive");
  });

  it("returns an explicit sanitized verification failure for unexpected evaluator errors", async () => {
    const { handler } = handlerFor({
      verifyImplementation: () => Promise.reject(new Error("internal evaluator detail")),
    });
    const response = await invoke(handler);
    const body = await responseBody<ExerciseVerificationError>(response);

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("VERIFICATION_FAILURE");
    expect(JSON.stringify(body)).not.toContain("internal evaluator detail");
  });

  it("logs a ledger write failure with the original error as cause before mapping to PERSISTENCE_FAILURE", async () => {
    const databaseError = Object.assign(new Error("connection reset"), { code: "08006" });
    const { handler } = handlerFor({ recordImplementation: () => Promise.reject(databaseError) });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await invoke(handler);

    expect(response.status).toBe(500);
    expect(await responseBody<ExerciseVerificationError>(response)).toEqual({
      error: {
        code: "PERSISTENCE_FAILURE",
        message: "Nie udało się zapisać wyniku weryfikacji. Spróbuj ponownie później.",
      },
    });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toEqual({
      event: "exercise_verification_persistence_failed",
      route: "/api/exercises/verify",
      userId: teacherId,
      candidateCount: 1,
    });
    expect((log.mock.calls[0][1] as Error).cause).toBe(databaseError);
  });

  it("logs a ledger load failure with the original error before mapping to PERSISTENCE_FAILURE", async () => {
    const loadError = new Error("relation does not exist");
    const { handler, loadExisting } = handlerFor();
    loadExisting.mockRejectedValue(loadError);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await invoke(handler);

    expect(response.status).toBe(500);
    expect((await responseBody<ExerciseVerificationError>(response)).error.code).toBe("PERSISTENCE_FAILURE");
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatchObject({ event: "exercise_verification_unexpected_error", userId: teacherId });
    expect(log.mock.calls[0][1]).toBe(loadError);
  });

  it("logs an evaluator failure with the original error as cause before mapping to VERIFICATION_FAILURE", async () => {
    const evaluatorError = new RangeError("evaluator overflow");
    const { handler } = handlerFor({ verifyImplementation: () => Promise.reject(evaluatorError) });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await invoke(handler);

    expect(response.status).toBe(500);
    expect(await responseBody<ExerciseVerificationError>(response)).toEqual({
      error: {
        code: "VERIFICATION_FAILURE",
        message: "Nie udało się obliczyć wyniku weryfikacji. Spróbuj ponownie później.",
      },
    });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatchObject({ event: "exercise_verification_failed", userId: teacherId });
    expect((log.mock.calls[0][1] as Error).cause).toBe(evaluatorError);
  });

  it("logs a writer configuration failure before mapping to PERSISTENCE_UNAVAILABLE", async () => {
    const { handler, createWriterClient } = handlerFor({ writerThrows: true });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await invoke(handler);

    expect(response.status).toBe(503);
    expect((await responseBody<ExerciseVerificationError>(response)).error.code).toBe("PERSISTENCE_UNAVAILABLE");
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatchObject({ event: "exercise_verification_writer_unavailable" });
    expect((log.mock.calls[0][1] as Error).message).toBe("sensitive writer configuration detail");
    expect(createWriterClient).toHaveBeenCalledTimes(1);
  });
});
