export const EXERCISE_TOPIC_SLUGS = [
  "addition-subtraction",
  "multiplication-division",
  "order-of-operations",
  "word-problems",
] as const;

export const EXERCISE_DIFFICULTIES = ["easy", "medium", "hard"] as const;

export const EXERCISE_GENERATION_ERROR_CODES = [
  "INVALID_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "PROVIDER_NOT_CONFIGURED",
  "PROVIDER_FAILURE",
  "PROVIDER_TIMEOUT",
] as const;

export type ExerciseTopicSlug = (typeof EXERCISE_TOPIC_SLUGS)[number];
export type ExerciseDifficulty = (typeof EXERCISE_DIFFICULTIES)[number];
export type ExerciseGenerationErrorCode = (typeof EXERCISE_GENERATION_ERROR_CODES)[number];

export interface ExerciseGenerationRequest {
  grade: 4;
  topic: ExerciseTopicSlug;
  difficulty: ExerciseDifficulty;
}

export interface ExerciseCandidate extends ExerciseGenerationRequest {
  id: string;
  text: string;
  proposedCanonicalAnswer: string;
  approvalStatus: "unverified";
}

export interface ExerciseGenerationSuccessMetadata {
  requestedCount: 5;
  validCount: 1 | 2 | 3 | 4 | 5;
  partial_batch?: true;
}

export interface ExerciseGenerationSuccess extends ExerciseGenerationSuccessMetadata {
  candidates: ExerciseCandidate[];
}

export interface ExerciseGenerationError {
  error: {
    code: ExerciseGenerationErrorCode;
    message: string;
  };
}
