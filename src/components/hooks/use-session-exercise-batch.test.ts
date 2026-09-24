// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";

import type { ExerciseGenerationSuccess } from "@/types";

import {
  clearSessionExerciseBatch,
  restoreSessionExerciseBatch,
  storeSessionExerciseBatch,
} from "./use-session-exercise-batch";

const firstBatch: ExerciseGenerationSuccess = {
  requestedCount: 5,
  validCount: 1,
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
  ],
};

beforeEach(() => {
  sessionStorage.clear();
});

describe("session exercise batch storage", () => {
  it("restores a valid latest-successful batch", () => {
    storeSessionExerciseBatch(sessionStorage, firstBatch);

    expect(restoreSessionExerciseBatch(sessionStorage)).toEqual(firstBatch);
  });

  it("replaces the previous successful batch", () => {
    const nextBatch: ExerciseGenerationSuccess = {
      ...firstBatch,
      candidates: [{ ...firstBatch.candidates[0], id: "candidate-2", text: "Oblicz 8 razy 4." }],
    };

    storeSessionExerciseBatch(sessionStorage, firstBatch);
    storeSessionExerciseBatch(sessionStorage, nextBatch);

    expect(restoreSessionExerciseBatch(sessionStorage)).toEqual(nextBatch);
  });

  it("clears the stored batch", () => {
    storeSessionExerciseBatch(sessionStorage, firstBatch);

    clearSessionExerciseBatch(sessionStorage);

    expect(restoreSessionExerciseBatch(sessionStorage)).toBeNull();
  });

  it.each([
    ["malformed JSON", "{"],
    ["an incompatible version", JSON.stringify({ version: 2, batch: firstBatch })],
    ["an invalid batch", JSON.stringify({ version: 1, batch: { requestedCount: 5 } })],
  ])("ignores and removes %s", (_, storedValue) => {
    sessionStorage.setItem("latest-successful-exercise-batch", storedValue);

    expect(restoreSessionExerciseBatch(sessionStorage)).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});
