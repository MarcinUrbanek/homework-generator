// @ts-nocheck
import type { APIContext, APIRoute } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpenRouterExerciseVerifierError } from "@/lib/services/openrouter-exercise-verifier";
import type { TeacherAuthorizationResult } from "@/lib/services/teacher-authorization";
import type {
  ExerciseCandidate,
  ExerciseVerificationError,
  ExerciseVerificationEvidence,
  ExerciseVerificationSuccess,
} from "@/types";

import { createExerciseVerifyHandler } from "./verify";

vi.mock("astro:env/server", () => ({
  OPENROUTER_API_KEY: undefined,
  OPENROUTER_VERIFIER_MODEL: undefined,
}));

const teacherId = "00000000-0000-4000-8000-000000000001";
const verificationId = "00000000-0000-4000-8000-000000000101";

const candidate: ExerciseCandidate = {
  id: "candidate-1",
  text: "Oblicz 20 + 5.",
  proposedCanonicalAnswer: "25",
  grade: 4,
  topic: "addition-subtraction",
  difficulty: "easy",
  approvalStatus: "unverified",
};

const evidence: ExerciseVerificationEvidence = {
  outcome: "unique_answer",
  verifiedAnswer: "25",
  rationale: "Suma liczb wynosi 25.",
  verifierIdentity: "OpenRouter/grade-4-independent-answer-set-v1",
  verifierVersion: "test/verifier",
  verifiedAt: "2026-09-29T12:00:00.000Z",
};

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
  };
}

function contextFor(body: string): APIContext {
  return {
    request: new Request("http://localhost/api/exercises/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
    locals: { user: { id: teacherId } },
    cookies: {},
  } as APIContext;
}

async function responseBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function handlerFor(
  options: {
    authorization?: TeacherAuthorizationResult;
    configured?: boolean;
    writerAvailable?: boolean;
    existing?: ReturnType<typeof ledgerRow>[];
    verifyImplementation?: (item: ExerciseCandidate) => Promise<ExerciseVerificationEvidence>;
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
    options.verifyImplementation ??
      ((_item: ExerciseCandidate): Promise<ExerciseVerificationEvidence> => Promise.resolve(evidence)),
  );
  const loadExisting = vi.fn().mockResolvedValue(options.existing ?? []);
  const record = vi.fn(
    options.recordImplementation ??
      ((_client, _requestedTeacherId, item, result) => Promise.resolve(ledgerRow(item, result))),
  );
  const handler = createExerciseVerifyHandler({
    authorize,
    verify,
    createSupabaseClient: vi.fn(() => null),
    createWriterClient: vi.fn(() => (options.writerAvailable === false ? null : ({} as never))),
    loadExisting,
    record,
    providerConfig: options.configured === false ? {} : { apiKey: "test-secret", model: "test/verifier" },
  });

  return { handler, authorize, verify, loadExisting, record };
}

async function invoke(handler: APIRoute, value: unknown = { candidates: [candidate] }): Promise<Response> {
  const body = typeof value === "string" ? value : JSON.stringify(value);
  return handler(contextFor(body));
}

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(await responseBody<ExerciseVerificationError>(response)).toEqual({
      error: { code: "INVALID_REQUEST", message: "Nieprawidłowe dane żądania weryfikacji." },
    });
    expect(authorize).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it.each([
    { authorization: { status: "unauthenticated" } as const, status: 401, code: "UNAUTHENTICATED" },
    { authorization: { status: "non-teacher" } as const, status: 403, code: "FORBIDDEN" },
    { authorization: { status: "profile-unavailable" } as const, status: 403, code: "FORBIDDEN" },
  ])("maps $authorization.status authorization", async ({ authorization, status, code }) => {
    const { handler, verify } = handlerFor({ authorization });

    const response = await invoke(handler);

    expect(response.status).toBe(status);
    expect((await responseBody<ExerciseVerificationError>(response)).error.code).toBe(code);
    expect(verify).not.toHaveBeenCalled();
  });

  it.each([
    { configured: false, writerAvailable: true },
    { configured: true, writerAvailable: false },
  ])("returns 503 when verifier or trusted writer configuration is missing", async (options) => {
    const { handler, verify } = handlerFor(options);

    const response = await invoke(handler);

    expect(response.status).toBe(503);
    expect((await responseBody<ExerciseVerificationError>(response)).error.code).toBe("VERIFIER_NOT_CONFIGURED");
    expect(verify).not.toHaveBeenCalled();
  });

  it("reuses an ordered settled result when the complete snapshot matches", async () => {
    const { handler, verify, record } = handlerFor({ existing: [ledgerRow()] });

    const response = await invoke(handler);

    expect(response.status).toBe(200);
    expect(await responseBody<ExerciseVerificationSuccess>(response)).toEqual({
      results: [{ verificationId, candidateId: candidate.id, ...evidence }],
    });
    expect(verify).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it("returns 409 without verification when a candidate ID has conflicting content", async () => {
    const conflicting = ledgerRow({ ...candidate, text: "Inna treść." });
    const { handler, verify, record } = handlerFor({ existing: [conflicting] });

    const response = await invoke(handler);

    expect(response.status).toBe(409);
    expect((await responseBody<ExerciseVerificationError>(response)).error.code).toBe("CANDIDATE_CONFLICT");
    expect(verify).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it("keeps input order, records settled evidence, and retains a technical failure", async () => {
    const secondCandidate = { ...candidate, id: "candidate-2", text: "Oblicz 8 razy 7." };
    const secondVerificationId = "00000000-0000-4000-8000-000000000102";
    const verifyImplementation = (item: ExerciseCandidate): Promise<ExerciseVerificationEvidence> => {
      if (item.id === secondCandidate.id) {
        return Promise.reject(new OpenRouterExerciseVerifierError("PROVIDER_TIMEOUT"));
      }
      return Promise.resolve(evidence);
    };
    const recordImplementation = (
      _client: unknown,
      _requestedTeacherId: string,
      item: ExerciseCandidate,
      result: ExerciseVerificationEvidence,
    ) => Promise.resolve({ ...ledgerRow(item, result), id: secondVerificationId });
    const { handler, verify, record } = handlerFor({ verifyImplementation, recordImplementation });

    const response = await invoke(handler, { candidates: [candidate, secondCandidate] });
    const body = await responseBody<ExerciseVerificationSuccess>(response);

    expect(response.status).toBe(200);
    expect(body.results.map(({ candidateId }) => candidateId)).toEqual([candidate.id, secondCandidate.id]);
    expect(body.results[0]).toMatchObject({ outcome: "unique_answer", verificationId: secondVerificationId });
    expect(body.results[1]).toEqual({
      candidateId: secondCandidate.id,
      outcome: "indeterminate",
      error: {
        code: "PROVIDER_TIMEOUT",
        message: "Weryfikator nie odpowiedział na czas. Spróbuj ponownie.",
      },
    });
    expect(verify).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(expect.anything(), teacherId, candidate, evidence);
  });

  it("reports an unrecorded candidate as indeterminate when trusted persistence fails", async () => {
    const recordImplementation = (): Promise<ReturnType<typeof ledgerRow>> => {
      return Promise.reject(new Error("database details"));
    };
    const { handler } = handlerFor({ recordImplementation });

    const response = await invoke(handler);

    expect(response.status).toBe(200);
    const body = await responseBody<{ results: { outcome: string; error?: { code: string; message: string } }[] }>(
      response,
    );
    expect(body.results.length).toBeGreaterThan(0);
    for (const result of body.results) {
      expect(result.outcome).toBe("indeterminate");
      expect(result.error?.message).not.toContain("database details");
    }
  });
});
