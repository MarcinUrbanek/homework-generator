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

export const EXERCISE_VERIFICATION_OUTCOMES = ["unique_answer", "answer_mismatch", "not_unique_answer"] as const;

export const EXERCISE_VERIFICATION_PROVIDER_ERROR_CODES = ["PROVIDER_FAILURE", "PROVIDER_TIMEOUT"] as const;

export const EXERCISE_VERIFICATION_ERROR_CODES = [
  "INVALID_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "VERIFIER_NOT_CONFIGURED",
  "CANDIDATE_CONFLICT",
  "PERSISTENCE_FAILURE",
] as const;

export const EXERCISE_APPROVAL_ERROR_CODES = [
  "INVALID_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "INVALID_SELECTION",
  "DATABASE_UNAVAILABLE",
  "PERSISTENCE_FAILURE",
] as const;

export type ExerciseTopicSlug = (typeof EXERCISE_TOPIC_SLUGS)[number];
export type ExerciseDifficulty = (typeof EXERCISE_DIFFICULTIES)[number];
export type ExerciseGenerationErrorCode = (typeof EXERCISE_GENERATION_ERROR_CODES)[number];
export type ExerciseVerificationOutcome = (typeof EXERCISE_VERIFICATION_OUTCOMES)[number];
export type ExerciseVerificationProviderErrorCode = (typeof EXERCISE_VERIFICATION_PROVIDER_ERROR_CODES)[number];
export type ExerciseVerificationErrorCode = (typeof EXERCISE_VERIFICATION_ERROR_CODES)[number];
export type ExerciseApprovalErrorCode = (typeof EXERCISE_APPROVAL_ERROR_CODES)[number];

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

export interface ExerciseVerificationRequest {
  candidates: ExerciseCandidate[];
}

interface ExerciseVerificationEvidenceBase {
  rationale: string;
  verifierIdentity: string;
  verifierVersion: string;
  verifiedAt: string;
}

export type ExerciseVerificationEvidence =
  | (ExerciseVerificationEvidenceBase & {
      outcome: "unique_answer" | "answer_mismatch";
      verifiedAnswer: string;
    })
  | (ExerciseVerificationEvidenceBase & {
      outcome: "not_unique_answer";
      verifiedAnswer: null;
    });

export type PersistedExerciseVerification = ExerciseVerificationEvidence & {
  verificationId: string;
  candidateId: string;
};

export interface IndeterminateExerciseVerification {
  candidateId: string;
  outcome: "indeterminate";
  error: {
    code: ExerciseVerificationProviderErrorCode;
    message: string;
  };
}

export type ExerciseVerificationResult = PersistedExerciseVerification | IndeterminateExerciseVerification;

export interface ExerciseVerificationSuccess {
  results: ExerciseVerificationResult[];
}

export interface ExerciseVerificationError {
  error: {
    code: ExerciseVerificationErrorCode;
    message: string;
  };
}

export interface ExerciseApprovalRequest {
  verificationIds: string[];
}

export interface ExerciseApprovalMapping {
  verificationId: string;
  exerciseId: string;
  created: boolean;
}

export interface ExerciseApprovalSuccess {
  mappings: ExerciseApprovalMapping[];
}

export interface ExerciseApprovalError {
  error: {
    code: ExerciseApprovalErrorCode;
    message: string;
  };
}
