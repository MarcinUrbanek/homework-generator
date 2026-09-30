// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";

import type { ExerciseGenerationSuccess, ExerciseVerificationResult } from "@/types";

import {
  applyExerciseVerificationResults,
  clearSessionExerciseBatch,
  createExerciseReviewBatch,
  removeApprovedExerciseCandidates,
  restoreSessionExerciseBatch,
  selectExerciseVerification,
  storeSessionExerciseBatch,
} from "./use-session-exercise-batch";

const verificationId = "11111111-1111-4111-8111-111111111111";
const firstBatch: ExerciseGenerationSuccess = {
  requestedCount: 5,
  validCount: 2,
  partial_batch: true,
  candidates: [
    {
      id: "candidate-1",
      text: "Oblicz 12 + 7.",
      proposedCanonicalAnswer: "19",
      grade: 4,
      topic: "addition-subtraction",
      difficulty: "easy",
      approvalStatus: "unverified",
    },
    {
      id: "candidate-2",
      text: "Oblicz 8 razy 4.",
      proposedCanonicalAnswer: "32",
      grade: 4,
      topic: "multiplication-division",
      difficulty: "medium",
      approvalStatus: "unverified",
    },
  ],
};

const successfulResult: ExerciseVerificationResult = {
  candidateId: "candidate-1",
  verificationId,
  outcome: "unique_answer",
  verifiedAnswer: "19",
  rationale: "Jednoznaczny wynik działania.",
  verifierIdentity: "openrouter",
  verifierVersion: "model-v1",
  verifiedAt: "2026-09-29T12:00:00.000Z",
};
const indeterminateResult: ExerciseVerificationResult = {
  candidateId: "candidate-2",
  outcome: "indeterminate",
  error: { code: "PROVIDER_TIMEOUT", message: "Weryfikacja przekroczyła limit czasu." },
};

beforeEach(() => {
  sessionStorage.clear();
});

describe("session exercise review batch storage", () => {
  it("migrates a valid version-1 generation batch with every candidate unverified", () => {
    sessionStorage.setItem("latest-successful-exercise-batch", JSON.stringify({ version: 1, batch: firstBatch }));

    expect(restoreSessionExerciseBatch(sessionStorage)).toEqual(createExerciseReviewBatch(firstBatch));
    const storedValue: unknown = JSON.parse(sessionStorage.getItem("latest-successful-exercise-batch") ?? "null");
    expect(storedValue).toEqual(expect.objectContaining({ version: 2 }));
  });

  it("restores version-2 evidence and successful selection", () => {
    let reviewBatch = applyExerciseVerificationResults(createExerciseReviewBatch(firstBatch), [
      successfulResult,
      indeterminateResult,
    ]);
    reviewBatch = selectExerciseVerification(reviewBatch, verificationId, true);
    storeSessionExerciseBatch(sessionStorage, reviewBatch);

    expect(restoreSessionExerciseBatch(sessionStorage)).toEqual(reviewBatch);
  });

  it("retains settled results while replacing only a targeted indeterminate result", () => {
    const reviewed = applyExerciseVerificationResults(createExerciseReviewBatch(firstBatch), [
      successfulResult,
      indeterminateResult,
    ]);
    const retryResult: ExerciseVerificationResult = {
      ...successfulResult,
      candidateId: "candidate-2",
      verificationId: "22222222-2222-4222-8222-222222222222",
      verifiedAnswer: "32",
    };

    const retried = applyExerciseVerificationResults(reviewed, [retryResult]);

    expect(retried.candidates[0]).toEqual(reviewed.candidates[0]);
    expect(retried.candidates[1]).toMatchObject({ status: "unique_answer", evidence: retryResult });
  });

  it("selects only successful records and removes exactly server-confirmed candidates", () => {
    let reviewed = applyExerciseVerificationResults(createExerciseReviewBatch(firstBatch), [
      successfulResult,
      indeterminateResult,
    ]);
    expect(selectExerciseVerification(reviewed, "22222222-2222-4222-8222-222222222222", true)).toBe(reviewed);
    reviewed = selectExerciseVerification(reviewed, verificationId, true);

    const remainder = removeApprovedExerciseCandidates(reviewed, [
      { verificationId, exerciseId: "33333333-3333-4333-8333-333333333333", created: false },
    ]);

    expect(remainder?.candidates.map(({ candidate }) => candidate.id)).toEqual(["candidate-2"]);
    expect(remainder?.candidates[0]).toEqual(reviewed.candidates[1]);
    expect(remainder?.selectedVerificationIds).toEqual([]);
  });

  it.each([
    ["malformed JSON", "{"],
    ["an incompatible version", JSON.stringify({ version: 3, batch: firstBatch })],
    [
      "invalid evidence/status",
      JSON.stringify({
        version: 2,
        batch: {
          ...createExerciseReviewBatch(firstBatch),
          validCount: 1,
          candidates: [{ candidate: firstBatch.candidates[0], status: "unique_answer", evidence: indeterminateResult }],
        },
      }),
    ],
    [
      "ineligible selection",
      JSON.stringify({
        version: 2,
        batch: { ...createExerciseReviewBatch(firstBatch), selectedVerificationIds: [verificationId] },
      }),
    ],
  ])("ignores and removes %s", (_, storedValue) => {
    sessionStorage.setItem("latest-successful-exercise-batch", storedValue);
    expect(restoreSessionExerciseBatch(sessionStorage)).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("clears the stored batch", () => {
    storeSessionExerciseBatch(sessionStorage, createExerciseReviewBatch(firstBatch));
    clearSessionExerciseBatch(sessionStorage);
    expect(restoreSessionExerciseBatch(sessionStorage)).toBeNull();
  });
});
