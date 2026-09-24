import { describe, expect, it } from "vitest";

import { EXERCISE_DIFFICULTIES, EXERCISE_TOPIC_SLUGS } from "@/types";

import { DIFFICULTY_LABELS, GRADE_4, GRADE_4_EXERCISE_CATALOG } from "./catalog";

describe("Grade 4 exercise catalog", () => {
  it("covers the four supported natural-number topics", () => {
    expect(GRADE_4).toBe(4);
    expect(GRADE_4_EXERCISE_CATALOG.map(({ slug }) => slug)).toEqual(EXERCISE_TOPIC_SLUGS);
    expect(GRADE_4_EXERCISE_CATALOG.every(({ label }) => label.length > 0)).toBe(true);
  });

  it("provides a distinct non-empty criterion for every topic and difficulty", () => {
    const guidance = GRADE_4_EXERCISE_CATALOG.flatMap((topic) =>
      EXERCISE_DIFFICULTIES.map((difficulty) => topic.guidance[difficulty]),
    );

    expect(guidance).toHaveLength(12);
    expect(guidance.every((criterion) => criterion.length > 0)).toBe(true);
    expect(new Set(guidance).size).toBe(12);
  });

  it("exposes Polish labels for every difficulty", () => {
    expect(Object.keys(DIFFICULTY_LABELS)).toEqual(EXERCISE_DIFFICULTIES);
    expect(Object.values(DIFFICULTY_LABELS)).toEqual(["Łatwy", "Średni", "Trudny"]);
  });
});
