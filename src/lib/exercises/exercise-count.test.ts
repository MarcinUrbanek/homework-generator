import { describe, expect, it } from "vitest";

import { exerciseNoun } from "@/lib/exercises/exercise-count";

describe("exerciseNoun", () => {
  it.each([
    [0, "zadań"],
    [1, "zadanie"],
    [2, "zadania"],
    [4, "zadania"],
    [5, "zadań"],
  ])("uses the correct Polish form for %i", (count, expected) => {
    expect(exerciseNoun(count)).toBe(expected);
  });
});
