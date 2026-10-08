import type { HomeworkRecipientAllocation } from "@/types";

export interface AllocateDistinctSetsInput {
  exerciseIds: readonly string[];
  studentIds: readonly string[];
  exerciseCount: number;
  random?: () => number;
}

export type AllocateDistinctSetsResult =
  | { ok: true; allocations: HomeworkRecipientAllocation[] }
  | {
      ok: false;
      code: "INVALID_INPUT" | "INSUFFICIENT_POOL";
      requiredExerciseCount?: number;
      availableExerciseCount?: number;
    };

const RANDOM_CANDIDATE_COUNT = 32;

function combinationCount(poolSize: number, setSize: number): bigint {
  if (poolSize < setSize) return 0n;

  const reducedSetSize = Math.min(setSize, poolSize - setSize);
  let result = 1n;
  for (let index = 1; index <= reducedSetSize; index += 1) {
    result = (result * BigInt(poolSize - reducedSetSize + index)) / BigInt(index);
  }
  return result;
}

function minimumPoolSize(recipientCount: number, exerciseCount: number): number {
  let poolSize = exerciseCount;
  while (combinationCount(poolSize, exerciseCount) < BigInt(recipientCount)) {
    poolSize += 1;
  }
  return poolSize;
}

function setSignature(exerciseIds: readonly string[]): string {
  return [...exerciseIds].sort().join("\u0000");
}

function* combinations(exerciseIds: readonly string[], exerciseCount: number): Generator<string[]> {
  const positions = Array.from({ length: exerciseCount }, (_, index) => index);

  for (;;) {
    yield positions.map((position) => exerciseIds[position]);

    let index = exerciseCount - 1;
    while (index >= 0 && positions[index] === exerciseIds.length - exerciseCount + index) {
      index -= 1;
    }
    if (index < 0) return;

    positions[index] += 1;
    for (let next = index + 1; next < exerciseCount; next += 1) {
      positions[next] = positions[next - 1] + 1;
    }
  }
}

function randomCandidate(exerciseIds: readonly string[], exerciseCount: number, random: () => number): string[] {
  const pool = [...exerciseIds];
  for (let index = 0; index < exerciseCount; index += 1) {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new RangeError("Random source must return a number in [0, 1)");
    }
    const selectedIndex = index + Math.floor(sample * (pool.length - index));
    [pool[index], pool[selectedIndex]] = [pool[selectedIndex], pool[index]];
  }
  return pool.slice(0, exerciseCount);
}

function scoreCandidate(
  candidate: readonly string[],
  exerciseUse: ReadonlyMap<string, number>,
  assignedSets: readonly (readonly string[])[],
): { usageProfile: number[]; overlap: number } {
  const usageProfile = candidate
    .map((exerciseId) => (exerciseUse.get(exerciseId) ?? 0) + 1)
    .sort((left, right) => left - right);
  const candidateIds = new Set(candidate);
  const overlap = assignedSets.reduce(
    (total, assignedSet) => total + assignedSet.filter((exerciseId) => candidateIds.has(exerciseId)).length,
    0,
  );
  return { usageProfile, overlap };
}

function compareScores(left: ReturnType<typeof scoreCandidate>, right: ReturnType<typeof scoreCandidate>): number {
  for (let index = 0; index < left.usageProfile.length; index += 1) {
    const difference = left.usageProfile[index] - right.usageProfile[index];
    if (difference !== 0) return difference;
  }
  return left.overlap - right.overlap;
}

export function allocateDistinctSets(input: AllocateDistinctSetsInput): AllocateDistinctSetsResult {
  const { exerciseIds, studentIds, exerciseCount, random = Math.random } = input;
  if (
    !Number.isInteger(exerciseCount) ||
    exerciseCount < 1 ||
    exerciseCount > 5 ||
    studentIds.length === 0 ||
    exerciseIds.some((id) => typeof id !== "string" || id.trim() === "") ||
    studentIds.some((id) => typeof id !== "string" || id.trim() === "") ||
    new Set(exerciseIds).size !== exerciseIds.length ||
    new Set(studentIds).size !== studentIds.length ||
    typeof random !== "function"
  ) {
    return { ok: false, code: "INVALID_INPUT" };
  }

  const requiredExerciseCount = minimumPoolSize(studentIds.length, exerciseCount);
  if (combinationCount(exerciseIds.length, exerciseCount) < BigInt(studentIds.length)) {
    return {
      ok: false,
      code: "INSUFFICIENT_POOL",
      requiredExerciseCount,
      availableExerciseCount: exerciseIds.length,
    };
  }

  try {
    const exerciseUse = new Map(exerciseIds.map((exerciseId) => [exerciseId, 0]));
    const assignedSets: string[][] = [];
    const usedSignatures = new Set<string>();
    const fallback = combinations(exerciseIds, exerciseCount);
    let nextFallback = fallback.next();
    let fallbackCandidates: string[][] = [];
    const allocations: HomeworkRecipientAllocation[] = [];

    for (const studentId of studentIds) {
      const candidates = new Map<string, string[]>();
      for (let attempt = 0; attempt < RANDOM_CANDIDATE_COUNT; attempt += 1) {
        const candidate = randomCandidate(exerciseIds, exerciseCount, random);
        const signature = setSignature(candidate);
        if (!usedSignatures.has(signature)) candidates.set(signature, candidate);
      }

      fallbackCandidates = fallbackCandidates.filter((candidate) => !usedSignatures.has(setSignature(candidate)));
      while (fallbackCandidates.length < RANDOM_CANDIDATE_COUNT && nextFallback.done === false) {
        const candidate = nextFallback.value;
        nextFallback = fallback.next();
        if (!usedSignatures.has(setSignature(candidate))) fallbackCandidates.push(candidate);
      }
      for (const candidate of fallbackCandidates) candidates.set(setSignature(candidate), candidate);

      let bestSet: string[] | undefined;
      let bestScore: ReturnType<typeof scoreCandidate> | undefined;
      for (const candidate of candidates.values()) {
        const score = scoreCandidate(candidate, exerciseUse, assignedSets);
        if (!bestScore || compareScores(score, bestScore) < 0) {
          bestSet = candidate;
          bestScore = score;
        }
      }
      if (!bestSet) return { ok: false, code: "INVALID_INPUT" };

      const signature = setSignature(bestSet);
      usedSignatures.add(signature);
      fallbackCandidates = fallbackCandidates.filter((candidate) => setSignature(candidate) !== signature);
      assignedSets.push(bestSet);
      for (const exerciseId of bestSet) {
        exerciseUse.set(exerciseId, (exerciseUse.get(exerciseId) ?? 0) + 1);
      }
      allocations.push({ studentId, exerciseIds: [...bestSet] });
    }

    return { ok: true, allocations };
  } catch {
    return { ok: false, code: "INVALID_INPUT" };
  }
}
