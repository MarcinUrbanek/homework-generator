import { describe, expect, it } from "vitest";

import { allocateDistinctSets } from "./allocate-distinct-sets";

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function signatures(allocations: { exerciseIds: string[] }[]): string[] {
  return allocations.map(({ exerciseIds }) => [...exerciseIds].sort().join(","));
}

describe("allocateDistinctSets", () => {
  it("allocates exact-size sets without repeating exercises or combinations", () => {
    const result = allocateDistinctSets({
      exerciseIds: ["a", "b", "c", "d"],
      studentIds: ["student-1", "student-2", "student-3", "student-4"],
      exerciseCount: 2,
      random: seededRandom(17),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.allocations).toHaveLength(4);
    expect(result.allocations.every(({ exerciseIds }) => exerciseIds.length === 2)).toBe(true);
    expect(result.allocations.every(({ exerciseIds }) => new Set(exerciseIds).size === 2)).toBe(true);
    expect(new Set(signatures(result.allocations)).size).toBe(4);
  });

  it("reports the minimum required pool size without partial allocations", () => {
    const result = allocateDistinctSets({
      exerciseIds: ["a", "b", "c", "d"],
      studentIds: Array.from({ length: 7 }, (_, index) => `student-${index + 1}`),
      exerciseCount: 2,
    });

    expect(result).toEqual({
      ok: false,
      code: "INSUFFICIENT_POOL",
      requiredExerciseCount: 5,
      availableExerciseCount: 4,
    });
  });

  it("supports one five-of-five recipient and rejects a second distinct set", () => {
    const exerciseIds = ["a", "b", "c", "d", "e"];
    expect(
      allocateDistinctSets({ exerciseIds, studentIds: ["student-1"], exerciseCount: 5, random: () => 0 }),
    ).toMatchObject({ ok: true });
    expect(allocateDistinctSets({ exerciseIds, studentIds: ["student-1", "student-2"], exerciseCount: 5 })).toEqual({
      ok: false,
      code: "INSUFFICIENT_POOL",
      requiredExerciseCount: 6,
      availableExerciseCount: 5,
    });
  });

  it("prefers unused exercises and minimizes pairwise overlap when capacity permits", () => {
    const result = allocateDistinctSets({
      exerciseIds: ["a", "b", "c", "d"],
      studentIds: ["student-1", "student-2"],
      exerciseCount: 2,
      random: () => 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.allocations[0].exerciseIds.filter((id) => result.allocations[1].exerciseIds.includes(id))).toEqual(
      [],
    );
  });

  it("balances reuse across every pair from a four-exercise pool", () => {
    const result = allocateDistinctSets({
      exerciseIds: ["a", "b", "c", "d"],
      studentIds: Array.from({ length: 6 }, (_, index) => `student-${index + 1}`),
      exerciseCount: 2,
      random: seededRandom(29),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Set(signatures(result.allocations)).size).toBe(6);
    const usage = Object.fromEntries(["a", "b", "c", "d"].map((id) => [id, 0]));
    for (const allocation of result.allocations) {
      for (const id of allocation.exerciseIds) usage[id] += 1;
    }
    expect(Object.values(usage)).toEqual([3, 3, 3, 3]);
  });

  it("produces the same allocations for the same random sequence", () => {
    const input = {
      exerciseIds: ["a", "b", "c", "d", "e"],
      studentIds: ["student-1", "student-2", "student-3"],
      exerciseCount: 2,
    };

    expect(allocateDistinctSets({ ...input, random: seededRandom(41) })).toEqual(
      allocateDistinctSets({ ...input, random: seededRandom(41) }),
    );
  });

  it.each([
    { exerciseIds: ["a", "a"], studentIds: ["student-1"], exerciseCount: 1 },
    { exerciseIds: ["a"], studentIds: ["student-1", "student-1"], exerciseCount: 1 },
    { exerciseIds: ["a"], studentIds: [], exerciseCount: 1 },
    { exerciseIds: ["a"], studentIds: ["student-1"], exerciseCount: 0 },
  ])("rejects malformed allocation inputs", (input) => {
    expect(allocateDistinctSets(input)).toEqual({ ok: false, code: "INVALID_INPUT" });
  });
});
