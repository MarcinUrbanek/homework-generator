import { describe, expect, it } from "vitest";

import { normalizeExerciseAnswer } from "./answer-normalization";

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
