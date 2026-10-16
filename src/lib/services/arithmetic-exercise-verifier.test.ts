import { describe, expect, it } from "vitest";

import { renderArithmeticExercise } from "@/lib/exercises/arithmetic-authority";
import type { ExerciseCandidate } from "@/types";

import { verifyArithmeticExercise } from "./arithmetic-exercise-verifier";

const now = () => new Date("2026-10-16T10:00:00.000Z");
const structure = {
  version: 1,
  expression: { kind: "add", left: { kind: "number", value: 20 }, right: { kind: "number", value: 5 } },
} as const;

function candidate(overrides: Partial<ExerciseCandidate> = {}): ExerciseCandidate {
  const rendered = renderArithmeticExercise({ grade: 4, topic: "addition-subtraction", difficulty: "easy" }, structure);
  return {
    id: "candidate-1",
    grade: 4,
    topic: "addition-subtraction",
    difficulty: "easy",
    approvalStatus: "unverified",
    ...rendered,
    ...overrides,
  };
}

describe("verifyArithmeticExercise", () => {
  it("certifies only the exact rendered statement and computed proposal", () => {
    expect(verifyArithmeticExercise(candidate(), now)).toEqual({
      outcome: "unique_answer",
      verifiedAnswer: "25",
      rationale: "Treść, metadane i odpowiedź odpowiadają niezależnie obliczonej strukturze arytmetycznej.",
      verifierIdentity: "ArithmeticAuthority",
      verifierVersion: "arithmetic-authority-v1",
      verifiedAt: "2026-10-16T10:00:00.000Z",
      arithmeticStructure: structure,
      authorityVersion: 1,
    });
  });

  it("preserves answer_mismatch for an incorrect proposal", () => {
    expect(verifyArithmeticExercise(candidate({ proposedCanonicalAnswer: "24" }), now)).toMatchObject({
      outcome: "answer_mismatch",
      verifiedAnswer: "25",
      authorityVersion: 1,
    });
  });

  it.each([
    ["missing structure", { arithmeticStructure: undefined }],
    ["unknown version", { arithmeticStructure: { version: 2, expression: structure.expression } }],
    ["invalid structure", { arithmeticStructure: { version: 1, expression: { kind: "power", value: 2 } } }],
    ["edited text", { text: "Oblicz 20 + 5." }],
    ["unsupported topic", { topic: "word-problems" as const }],
  ])("settles %s as unsupported evidence", (_label, overrides) => {
    expect(verifyArithmeticExercise(candidate(overrides), now)).toMatchObject({
      outcome: "unsupported_evidence",
      verifiedAnswer: null,
      verifierIdentity: "ArithmeticAuthority",
      verifierVersion: "arithmetic-authority-v1",
    });
  });

  it("does not claim ambiguity was proven for an unsupported candidate", () => {
    expect(verifyArithmeticExercise(candidate({ arithmeticStructure: undefined }), now).outcome).toBe(
      "unsupported_evidence",
    );
  });
});
