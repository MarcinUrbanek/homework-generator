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

export const SAVED_EXERCISE_ERROR_CODES = [
  "INVALID_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
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
export type SavedExerciseErrorCode = (typeof SAVED_EXERCISE_ERROR_CODES)[number];

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

export const CLASS_API_ERROR_CODES = [
  "INVALID_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "DATABASE_UNAVAILABLE",
  "PERSISTENCE_FAILURE",
  "SERVICE_UNAVAILABLE",
] as const;

export type ClassApiErrorCode = (typeof CLASS_API_ERROR_CODES)[number];

export interface CreateClassRequest {
  name: string;
}

export interface ClassSummary {
  id: string;
  name: string;
  classCode: string;
  createdAt: string;
}

export interface ClassJoinPreview {
  name: string;
  teacherDisplayName: string | null;
  alreadyMember: boolean;
}

export interface ClassJoinSuccess {
  redirectTo: "/classes/joined";
  alreadyMember: boolean;
}

export interface JoinedClassSummary {
  id: string;
  name: string;
  teacherDisplayName: string | null;
  joinedAt: string;
}

export interface JoinedClassesSuccess {
  classes: JoinedClassSummary[];
}

export interface DisplayNameUpdateSuccess {
  displayName: string;
}

export interface CreateClassSuccess {
  class: ClassSummary;
}

export interface ListClassesSuccess {
  classes: ClassSummary[];
}

export interface InviteStudentsRequest {
  classId: string;
  emails: string[];
}

export interface InvitationDeliveryResult {
  email: string;
  status: "sent" | "refreshed" | "failed";
}

export interface InviteStudentsSuccess {
  results: InvitationDeliveryResult[];
}

export interface ClassApiError {
  error: {
    code: ClassApiErrorCode;
    message: string;
  };
}

export interface SavedExerciseFilters {
  grade: 4;
  topic: ExerciseTopicSlug;
  difficulty?: ExerciseDifficulty;
}

export interface SavedExerciseSummary extends Omit<SavedExerciseFilters, "difficulty"> {
  difficulty: ExerciseDifficulty;
  id: string;
  text: string;
  canonicalAnswer: string;
  approvedAt: string;
}

export interface SavedExerciseCursor extends SavedExerciseFilters {
  approvedAt: string;
  id: string;
}

export interface SavedExerciseSuccess {
  exercises: SavedExerciseSummary[];
  nextCursor: string | null;
}

export interface SavedExerciseError {
  error: {
    code: SavedExerciseErrorCode;
    message: string;
  };
}

export const HOMEWORK_API_ERROR_CODES = [
  "INVALID_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "CLASS_UNAVAILABLE",
  "EMPTY_ELIGIBLE_ROSTER",
  "INSUFFICIENT_POOL",
  "DATABASE_UNAVAILABLE",
  "PERSISTENCE_FAILURE",
] as const;

export type HomeworkApiErrorCode = (typeof HOMEWORK_API_ERROR_CODES)[number];
export type HomeworkGrade = 4;

export interface HomeworkRosterMember {
  studentId: string;
  email: string;
  joinedAt: string;
}

export interface HomeworkRosterSuccess {
  members: HomeworkRosterMember[];
}

export interface HomeworkAssignmentRequest {
  classId: string;
  studentIds: string[];
  title?: string;
  topic: ExerciseTopicSlug;
  difficulty: ExerciseDifficulty;
  exerciseCount: 1 | 2 | 3 | 4 | 5;
  idempotencyKey: string;
}

export interface HomeworkRecipientAllocation {
  studentId: string;
  exerciseIds: string[];
}

export interface HomeworkAssignmentSuccess {
  assignmentId: string;
  title: string | null;
  createdAt: string;
  assignedCount: number;
  excludedStudentIds: string[];
  excludedCount: number;
  replayed: boolean;
}

export interface HomeworkApiError {
  error: {
    code: HomeworkApiErrorCode;
    message: string;
    requiredExerciseCount?: number;
    availableExerciseCount?: number;
  };
}

export const STUDENT_HOMEWORK_API_ERROR_CODES = [
  "INVALID_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "HOMEWORK_UNAVAILABLE",
  "SUBMISSION_CONFLICT",
  "SCORING_UNAVAILABLE",
  "DATABASE_UNAVAILABLE",
  "PERSISTENCE_FAILURE",
] as const;

export type StudentHomeworkApiErrorCode = (typeof STUDENT_HOMEWORK_API_ERROR_CODES)[number];

export interface StudentHomeworkSummary {
  assignmentId: string;
  className: string;
  title: string | null;
  createdAt: string;
  exerciseCount: number;
  submitted: boolean;
  submittedAt: string | null;
  correctCount: number | null;
  passed: boolean | null;
}

export interface StudentHomeworkListSuccess {
  assignments: StudentHomeworkSummary[];
}

export interface StudentHomeworkDetailAssignment {
  assignmentId: string;
  className: string;
  title: string | null;
  createdAt: string;
  exerciseCount: number;
}

export interface StudentHomeworkExercise {
  position: number;
  prompt: string;
}

export interface StudentHomeworkAnswerResult {
  position: number;
  answer: string | null;
  isCorrect: boolean;
}

export interface StudentHomeworkSubmissionResult {
  submissionId: string;
  submittedAt: string;
  correctCount: number;
  assignedCount: number;
  passed: boolean;
  answers: StudentHomeworkAnswerResult[];
}

export interface StudentHomeworkDetailSuccess {
  assignment: StudentHomeworkDetailAssignment;
  exercises: StudentHomeworkExercise[];
  submission: StudentHomeworkSubmissionResult | null;
}

export interface StudentHomeworkSubmitRequest {
  answers: {
    position: number;
    answer: string | null;
  }[];
}

export interface StudentHomeworkSubmitSuccess extends StudentHomeworkSubmissionResult {
  replayed: boolean;
}

export interface StudentHomeworkApiError {
  error: {
    code: StudentHomeworkApiErrorCode;
    message: string;
  };
}
