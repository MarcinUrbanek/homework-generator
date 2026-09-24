import { describe, expect, it } from "vitest";

import { EXERCISE_DIFFICULTIES, EXERCISE_TOPIC_SLUGS } from "@/types";

import {
  exerciseCandidateSchema,
  exerciseGenerationErrorSchema,
  exerciseGenerationRequestSchema,
  exerciseGenerationSuccessMetadataSchema,
  exerciseGenerationSuccessSchema,
} from "./schemas";

const candidate = {
  id: "candidate-1",
  text: "Oblicz 24 + 18.",
  proposedCanonicalAnswer: "42",
  grade: 4,
  topic: "addition-subtraction",
  difficulty: "easy",
  approvalStatus: "unverified",
} as const;

describe("exercise generation schemas", () => {
  it("accepts every supported topic and difficulty combination", () => {
    for (const topic of EXERCISE_TOPIC_SLUGS) {
      for (const difficulty of EXERCISE_DIFFICULTIES) {
        expect(exerciseGenerationRequestSchema.safeParse({ grade: 4, topic, difficulty }).success).toBe(true);
      }
    }
  });

  it.each([
    { grade: 5, topic: "addition-subtraction", difficulty: "easy" },
    { grade: 4, topic: "fractions", difficulty: "easy" },
    { grade: 4, topic: "addition-subtraction", difficulty: "expert" },
    { grade: 4, topic: "addition-subtraction", difficulty: "easy", extra: true },
  ])("rejects unsupported request metadata", (request) => {
    expect(exerciseGenerationRequestSchema.safeParse(request).success).toBe(false);
  });

  it("accepts a non-empty unverified candidate", () => {
    expect(exerciseCandidateSchema.parse(candidate)).toEqual(candidate);
  });

  it.each([
    { ...candidate, id: "" },
    { ...candidate, text: "  " },
    { ...candidate, proposedCanonicalAnswer: "" },
    { ...candidate, approvalStatus: "approved" },
  ])("rejects a malformed candidate", (value) => {
    expect(exerciseCandidateSchema.safeParse(value).success).toBe(false);
  });

  it("accepts complete and partial success envelopes", () => {
    expect(
      exerciseGenerationSuccessSchema.safeParse({
        requestedCount: 5,
        validCount: 5,
        candidates: [candidate, candidate, candidate, candidate, candidate],
      }).success,
    ).toBe(true);
    expect(
      exerciseGenerationSuccessSchema.safeParse({
        requestedCount: 5,
        validCount: 1,
        partial_batch: true,
        candidates: [candidate],
      }).success,
    ).toBe(true);
  });

  it.each([
    { requestedCount: 4, validCount: 1, partial_batch: true },
    { requestedCount: 5, validCount: 0, partial_batch: true },
    { requestedCount: 5, validCount: 1 },
    { requestedCount: 5, validCount: 5, partial_batch: true },
  ])("rejects malformed success metadata", (metadata) => {
    expect(exerciseGenerationSuccessMetadataSchema.safeParse(metadata).success).toBe(false);
  });

  it("rejects success envelopes whose count does not match the candidates", () => {
    expect(
      exerciseGenerationSuccessSchema.safeParse({
        requestedCount: 5,
        validCount: 2,
        partial_batch: true,
        candidates: [candidate],
      }).success,
    ).toBe(false);
  });

  it("accepts the stable Polish error envelope", () => {
    expect(
      exerciseGenerationErrorSchema.safeParse({
        error: { code: "INVALID_REQUEST", message: "Nieprawidłowe dane żądania." },
      }).success,
    ).toBe(true);
  });

  it.each([
    { error: { code: "UNKNOWN", message: "Nieznany błąd." } },
    { error: { code: "INVALID_REQUEST", message: "" } },
    { code: "INVALID_REQUEST", message: "Nieprawidłowe dane żądania." },
  ])("rejects malformed error envelopes", (error) => {
    expect(exerciseGenerationErrorSchema.safeParse(error).success).toBe(false);
  });
});
