// @ts-nocheck
import { describe, expect, it } from "vitest";

import { canonicalizeExerciseAnswerForVerification, normalizeExerciseAnswer } from "./answer-normalization";

describe("normalizeExerciseAnswer", () => {
  it("normalizes Unicode, surrounding and repeated whitespace, and Polish case", () => {
    expect(normalizeExerciseAnswer("  ZAŻÓŁĆ\tGĘŚLĄ  JAŹŃ  ")).toBe("zażółć gęślą jaźń");
  });

  it("removes exactly one terminal sentence period", () => {
    expect(normalizeExerciseAnswer("42.")).toBe("42");
    expect(normalizeExerciseAnswer("42..")).toBe("42.");
  });

  it.each([
    ["1,5", "1.5"],
    ["1/2", "0,5"],
    ["12 zł", "12"],
    ["tak!", "tak"],
  ])("keeps meaningful differences between %s and %s", (left, right) => {
    expect(normalizeExerciseAnswer(left)).not.toBe(normalizeExerciseAnswer(right));
  });
});

describe("canonicalizeExerciseAnswerForVerification", () => {
  it.each([
    ["1234", "1 234", "1234"],
    ["1234567", "1 234 567", "1234567"],
    ["1234", "1\u00a0234", "1234"],
    ["1234", "1\u202f234", "1234"],
    ["15", "Ania zebrała 15 jabłek", "15"],
    ["Ania zebrała 15 jabłek", "15", "15"],
    ["00015", "0 015", "15"],
    ["000", "0", "0"],
  ])("equates %s with %s as canonical digits %s", (left, right, canonicalAnswer) => {
    const leftResult = canonicalizeExerciseAnswerForVerification(left);
    const rightResult = canonicalizeExerciseAnswerForVerification(right);

    expect(leftResult).toEqual({
      comparisonKey: `natural-number:${canonicalAnswer}`,
      canonicalAnswer,
    });
    expect(rightResult).toEqual(leftResult);
    expect(canonicalizeExerciseAnswerForVerification(leftResult.canonicalAnswer)).toEqual(leftResult);
  });

  it.each([
    ["12 34", "1234"],
    ["Brak odpowiedzi", "0"],
    ["Ania ma 15 jabłek, a Ola 16.", "15"],
    ["-15", "15"],
    ["1,5", "15"],
    ["1.5", "15"],
    [".5", "5"],
    ["1/2", "0,5"],
    ["dwa", "2"],
    ["2 + 2", "4"],
    ["tak", "nie"],
    ["tak!", "tak"],
  ])("keeps %s distinct from %s", (left, right) => {
    expect(canonicalizeExerciseAnswerForVerification(left).comparisonKey).not.toBe(
      canonicalizeExerciseAnswerForVerification(right).comparisonKey,
    );
  });
});
