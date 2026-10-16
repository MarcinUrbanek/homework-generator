import { z } from "zod";

import { normalizeStudentHomeworkAnswer } from "@/lib/exercises/answer-normalization";
import {
  EXERCISE_DIFFICULTIES,
  EXERCISE_TOPIC_SLUGS,
  HOMEWORK_API_ERROR_CODES,
  STUDENT_HOMEWORK_API_ERROR_CODES,
  type HomeworkApiErrorCode,
} from "@/types";

const uuidSchema = z.uuid();
const nonEmptyStringSchema = z.string().trim().min(1);
const nonEmptyPreservedStringSchema = z.string().refine((value) => value.trim().length > 0);
const exerciseCountSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const homeworkTopicSchema = z.enum(EXERCISE_TOPIC_SLUGS);
export const homeworkDifficultySchema = z.enum(EXERCISE_DIFFICULTIES);
export const homeworkClassIdSchema = uuidSchema;

export const homeworkAssignmentRequestSchema = z
  .object({
    classId: uuidSchema,
    studentIds: z.array(uuidSchema).min(1),
    title: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((title) => (title === "" ? undefined : title)),
    topic: homeworkTopicSchema,
    difficulty: homeworkDifficultySchema,
    exerciseCount: exerciseCountSchema,
    idempotencyKey: uuidSchema,
  })
  .strict()
  .superRefine(({ studentIds }, context) => {
    if (new Set(studentIds).size !== studentIds.length) {
      context.addIssue({
        code: "custom",
        path: ["studentIds"],
        message: "Selected students must be distinct",
      });
    }
  });

export const homeworkRosterRpcRowSchema = z
  .object({
    student_id: uuidSchema,
    student_email: z.string().trim().toLowerCase().pipe(z.email()),
    joined_at: z.iso.datetime({ offset: true }),
  })
  .strict();

export const homeworkRosterMemberSchema = z
  .object({
    studentId: uuidSchema,
    email: z.string().trim().toLowerCase().pipe(z.email()),
    joinedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const homeworkRosterSuccessSchema = z
  .object({ members: homeworkRosterMemberSchema.array() })
  .strict()
  .superRefine(({ members }, context) => {
    if (new Set(members.map(({ studentId }) => studentId)).size !== members.length) {
      context.addIssue({ code: "custom", path: ["members"], message: "Roster student IDs must be distinct" });
    }
  });

export const homeworkAssignmentRpcRowSchema = z
  .object({
    assignment_id: uuidSchema,
    assignment_title: nonEmptyStringSchema.nullable(),
    assigned_student_ids: uuidSchema.array().min(1),
    excluded_student_ids: uuidSchema.array(),
    created_at: z.iso.datetime({ offset: true }),
    replayed: z.boolean(),
  })
  .strict()
  .superRefine(({ assigned_student_ids: assignedStudentIds, excluded_student_ids: excludedStudentIds }, context) => {
    if (new Set(assignedStudentIds).size !== assignedStudentIds.length) {
      context.addIssue({ code: "custom", path: ["assigned_student_ids"], message: "Assigned IDs must be distinct" });
    }
    if (new Set(excludedStudentIds).size !== excludedStudentIds.length) {
      context.addIssue({ code: "custom", path: ["excluded_student_ids"], message: "Excluded IDs must be distinct" });
    }
    if (assignedStudentIds.some((studentId) => excludedStudentIds.includes(studentId))) {
      context.addIssue({
        code: "custom",
        path: ["excluded_student_ids"],
        message: "Assigned and excluded IDs must differ",
      });
    }
  });

export const homeworkAssignmentSuccessSchema = z
  .object({
    assignmentId: uuidSchema,
    title: nonEmptyStringSchema.nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    assignedCount: z.number().int().min(1),
    excludedStudentIds: uuidSchema.array(),
    excludedCount: z.number().int().min(0),
    replayed: z.boolean(),
  })
  .strict()
  .superRefine(({ excludedStudentIds, excludedCount }, context) => {
    if (excludedStudentIds.length !== excludedCount || new Set(excludedStudentIds).size !== excludedCount) {
      context.addIssue({ code: "custom", path: ["excludedCount"], message: "Excluded count must match excluded IDs" });
    }
  });

export const homeworkApiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.enum(HOMEWORK_API_ERROR_CODES),
        message: nonEmptyStringSchema,
        requiredExerciseCount: z.number().int().min(1).optional(),
        availableExerciseCount: z.number().int().min(0).optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine(({ error }, context) => {
    const hasCapacityDetails = error.requiredExerciseCount !== undefined && error.availableExerciseCount !== undefined;
    if ((error.code === "INSUFFICIENT_POOL") !== hasCapacityDetails) {
      context.addIssue({ code: "custom", path: ["error"], message: "Capacity details must match error code" });
    }
  });

export const homeworkApiErrorCodeSchema = z.enum(HOMEWORK_API_ERROR_CODES);

export function isHomeworkApiErrorCode(value: string): value is HomeworkApiErrorCode {
  return homeworkApiErrorCodeSchema.safeParse(value).success;
}

const studentHomeworkExerciseCountSchema = z.number().int().min(1).max(5);
const studentHomeworkAnswerPositionSchema = z.number().int().min(1).max(5);
const studentHomeworkRawAnswerSchema = z
  .string()
  .max(200)
  .nullable()
  .superRefine((answer, context) => {
    if (answer !== null && normalizeStudentHomeworkAnswer(answer) === undefined) {
      context.addIssue({ code: "custom", message: "Answers must be natural numbers or blank" });
    }
  });

function validateOrderedPositions(positions: number[], expectedCount: number, context: z.RefinementCtx, path: string) {
  if (positions.length !== expectedCount || positions.some((position, index) => position !== index + 1)) {
    context.addIssue({
      code: "custom",
      path: [path],
      message: "Positions must match the assigned exercise order",
    });
  }
}

function validateHomeworkSubmissionSummary(
  {
    submitted,
    submittedAt,
    correctCount,
    passed,
    exerciseCount,
  }: {
    submitted: boolean;
    submittedAt: string | null;
    correctCount: number | null;
    passed: boolean | null;
    exerciseCount: number;
  },
  context: z.RefinementCtx,
) {
  const hasCompleteResult = submittedAt !== null && correctCount !== null && passed !== null;
  if (
    submitted !== hasCompleteResult ||
    (!submitted && (submittedAt !== null || correctCount !== null || passed !== null))
  ) {
    context.addIssue({ code: "custom", path: ["submitted"], message: "Submission summary fields must be consistent" });
  }
  if (
    submitted &&
    (correctCount === null || correctCount > exerciseCount || passed !== 2 * correctCount >= exerciseCount)
  ) {
    context.addIssue({ code: "custom", path: ["correctCount"], message: "Submission score fields must be consistent" });
  }
}

const studentHomeworkSubmissionAnswerRpcSchema = z
  .object({
    position: studentHomeworkAnswerPositionSchema,
    answer: studentHomeworkRawAnswerSchema,
    normalized_answer: z
      .string()
      .regex(/^(0|[1-9][0-9]*)$/u)
      .nullable(),
    is_correct: z.boolean(),
  })
  .strict()
  .superRefine(({ answer, normalized_answer, is_correct }, context) => {
    if (normalizeStudentHomeworkAnswer(answer) !== normalized_answer) {
      context.addIssue({
        code: "custom",
        path: ["normalized_answer"],
        message: "Normalized answer does not match raw answer",
      });
    }
    if (normalized_answer === null && is_correct) {
      context.addIssue({
        code: "custom",
        path: ["is_correct"],
        message: "Blank answers cannot be correct",
      });
    }
  });

const studentHomeworkSubmissionResultRpcBaseSchema = z
  .object({
    submission_id: z.uuid(),
    submitted_at: z.iso.datetime({ offset: true }),
    correct_count: z.number().int().min(0),
    assigned_count: studentHomeworkExerciseCountSchema,
    passed: z.boolean(),
    answers: studentHomeworkSubmissionAnswerRpcSchema.array(),
  })
  .strict();

function validateRpcSubmissionResult(
  {
    answers,
    correct_count: correctCount,
    assigned_count: assignedCount,
    passed,
  }: z.infer<typeof studentHomeworkSubmissionResultRpcBaseSchema>,
  context: z.RefinementCtx,
) {
  validateOrderedPositions(
    answers.map(({ position }) => position),
    assignedCount,
    context,
    "answers",
  );
  const actualCorrectCount = answers.filter(({ is_correct: isCorrect }) => isCorrect).length;
  if (correctCount !== actualCorrectCount || correctCount > assignedCount) {
    context.addIssue({ code: "custom", path: ["correct_count"], message: "Correct count must match answer results" });
  }
  if (passed !== 2 * correctCount >= assignedCount) {
    context.addIssue({ code: "custom", path: ["passed"], message: "Pass status must match the score threshold" });
  }
}

const studentHomeworkSubmissionResultRpcSchema =
  studentHomeworkSubmissionResultRpcBaseSchema.superRefine(validateRpcSubmissionResult);

export const studentHomeworkSubmitRequestSchema = z
  .object({
    answers: z
      .object({
        position: studentHomeworkAnswerPositionSchema,
        answer: studentHomeworkRawAnswerSchema,
      })
      .strict()
      .array()
      .min(1)
      .max(5),
  })
  .strict()
  .superRefine(({ answers }, context) => {
    const positions = answers.map(({ position }) => position);
    if (new Set(positions).size !== answers.length) {
      context.addIssue({ code: "custom", path: ["answers"], message: "Answer positions must be unique" });
    }
    validateOrderedPositions(
      [...positions].sort((left, right) => left - right),
      answers.length,
      context,
      "answers",
    );
  });

export const studentHomeworkAssignmentIdSchema = uuidSchema;

export const studentHomeworkSummaryRpcRowSchema = z
  .object({
    assignment_id: uuidSchema,
    class_name: nonEmptyStringSchema,
    assignment_title: nonEmptyStringSchema.nullable(),
    created_at: z.iso.datetime({ offset: true }),
    exercise_count: studentHomeworkExerciseCountSchema,
    submitted: z.boolean(),
    submitted_at: z.iso.datetime({ offset: true }).nullable(),
    correct_count: z.number().int().min(0).nullable(),
    passed: z.boolean().nullable(),
  })
  .strict()
  .superRefine(
    (
      { submitted, submitted_at: submittedAt, correct_count: correctCount, passed, exercise_count: exerciseCount },
      context,
    ) => {
      validateHomeworkSubmissionSummary({ submitted, submittedAt, correctCount, passed, exerciseCount }, context);
    },
  );

export const studentHomeworkSummarySchema = z
  .object({
    assignmentId: uuidSchema,
    className: nonEmptyStringSchema,
    title: nonEmptyStringSchema.nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    exerciseCount: studentHomeworkExerciseCountSchema,
    submitted: z.boolean(),
    submittedAt: z.iso.datetime({ offset: true }).nullable(),
    correctCount: z.number().int().min(0).nullable(),
    passed: z.boolean().nullable(),
  })
  .strict()
  .superRefine(({ submitted, submittedAt, correctCount, passed, exerciseCount }, context) => {
    validateHomeworkSubmissionSummary({ submitted, submittedAt, correctCount, passed, exerciseCount }, context);
  });

export const studentHomeworkListSuccessSchema = z
  .object({ assignments: studentHomeworkSummarySchema.array() })
  .strict();

const studentHomeworkAssignmentRpcSchema = z
  .object({
    assignment_id: uuidSchema,
    class_name: nonEmptyStringSchema,
    title: nonEmptyStringSchema.nullable(),
    created_at: z.iso.datetime({ offset: true }),
    exercise_count: studentHomeworkExerciseCountSchema,
  })
  .strict();

const studentHomeworkPromptDetailRpcSchema = z
  .object({
    kind: z.literal("prompts"),
    assignment: studentHomeworkAssignmentRpcSchema,
    exercises: z
      .object({
        position: studentHomeworkAnswerPositionSchema,
        prompt: nonEmptyPreservedStringSchema,
      })
      .strict()
      .array(),
    submission: studentHomeworkSubmissionResultRpcSchema.nullable(),
  })
  .strict()
  .superRefine(({ assignment, exercises, submission }, context) => {
    validateOrderedPositions(
      exercises.map(({ position }) => position),
      assignment.exercise_count,
      context,
      "exercises",
    );
    if (submission && submission.assigned_count !== assignment.exercise_count) {
      context.addIssue({
        code: "custom",
        path: ["submission", "assigned_count"],
        message: "Submission count mismatch",
      });
    }
  });

const studentHomeworkResultOnlyAnswerRpcSchema = z
  .object({
    position: studentHomeworkAnswerPositionSchema,
    answer: studentHomeworkRawAnswerSchema,
    is_correct: z.boolean(),
  })
  .strict()
  .superRefine(({ answer, is_correct: isCorrect }, context) => {
    if (normalizeStudentHomeworkAnswer(answer) === null && isCorrect) {
      context.addIssue({
        code: "custom",
        path: ["is_correct"],
        message: "Blank answers cannot be correct",
      });
    }
  });

const studentHomeworkResultOnlySubmissionRpcSchema = z
  .object({
    submission_id: z.uuid(),
    submitted_at: z.iso.datetime({ offset: true }),
    correct_count: z.number().int().min(0),
    assigned_count: studentHomeworkExerciseCountSchema,
    passed: z.boolean(),
    answers: studentHomeworkResultOnlyAnswerRpcSchema.array(),
  })
  .strict()
  .superRefine(({ answers, correct_count: correctCount, assigned_count: assignedCount, passed }, context) => {
    validateOrderedPositions(
      answers.map(({ position }) => position),
      assignedCount,
      context,
      "answers",
    );
    if (answers.filter(({ is_correct: isCorrect }) => isCorrect).length !== correctCount) {
      context.addIssue({ code: "custom", path: ["correct_count"], message: "Correct count must match answer results" });
    }
    if (correctCount > assignedCount || passed !== 2 * correctCount >= assignedCount) {
      context.addIssue({ code: "custom", path: ["passed"], message: "Pass status must match the score threshold" });
    }
  });

const studentHomeworkResultOnlyDetailRpcSchema = z
  .object({
    kind: z.literal("result-only"),
    assignment: studentHomeworkAssignmentRpcSchema,
    result: studentHomeworkResultOnlySubmissionRpcSchema,
  })
  .strict()
  .superRefine(({ assignment, result }, context) => {
    if (result.assigned_count !== assignment.exercise_count) {
      context.addIssue({
        code: "custom",
        path: ["result", "assigned_count"],
        message: "Submission count mismatch",
      });
    }
  });

export const studentHomeworkDetailRpcSchema = z.discriminatedUnion("kind", [
  studentHomeworkPromptDetailRpcSchema,
  studentHomeworkResultOnlyDetailRpcSchema,
]);

const studentHomeworkScoredSubmitRpcResultSchema = studentHomeworkSubmissionResultRpcBaseSchema
  .extend({ kind: z.literal("scored"), replayed: z.boolean() })
  .strict()
  .superRefine(validateRpcSubmissionResult);

const studentHomeworkResultOnlySubmitRpcResultSchema = z
  .object({
    kind: z.literal("result-only"),
    submission_id: z.uuid(),
    submitted_at: z.iso.datetime({ offset: true }),
    correct_count: z.number().int().min(0),
    assigned_count: studentHomeworkExerciseCountSchema,
    passed: z.boolean(),
    answers: studentHomeworkResultOnlyAnswerRpcSchema.array(),
    replayed: z.literal(true),
  })
  .strict()
  .superRefine(({ answers, correct_count: correctCount, assigned_count: assignedCount, passed }, context) => {
    validateOrderedPositions(
      answers.map(({ position }) => position),
      assignedCount,
      context,
      "answers",
    );
    if (answers.filter(({ is_correct: isCorrect }) => isCorrect).length !== correctCount) {
      context.addIssue({ code: "custom", path: ["correct_count"], message: "Correct count must match answer results" });
    }
    if (correctCount > assignedCount || passed !== 2 * correctCount >= assignedCount) {
      context.addIssue({ code: "custom", path: ["passed"], message: "Pass status must match the score threshold" });
    }
  });

export const studentHomeworkSubmitRpcResultSchema = z.discriminatedUnion("kind", [
  studentHomeworkScoredSubmitRpcResultSchema,
  studentHomeworkResultOnlySubmitRpcResultSchema,
]);

const studentHomeworkSubmissionResultBaseSchema = z
  .object({
    submissionId: uuidSchema,
    submittedAt: z.iso.datetime({ offset: true }),
    correctCount: z.number().int().min(0),
    assignedCount: studentHomeworkExerciseCountSchema,
    passed: z.boolean(),
    answers: z
      .object({
        position: studentHomeworkAnswerPositionSchema,
        answer: studentHomeworkRawAnswerSchema,
        isCorrect: z.boolean(),
      })
      .strict()
      .array(),
  })
  .strict();

function validatePublicSubmissionResult(
  { answers, correctCount, assignedCount, passed }: z.infer<typeof studentHomeworkSubmissionResultBaseSchema>,
  context: z.RefinementCtx,
) {
  validateOrderedPositions(
    answers.map(({ position }) => position),
    assignedCount,
    context,
    "answers",
  );
  if (answers.filter(({ isCorrect }) => isCorrect).length !== correctCount || correctCount > assignedCount) {
    context.addIssue({ code: "custom", path: ["correctCount"], message: "Correct count must match answer results" });
  }
  if (passed !== 2 * correctCount >= assignedCount) {
    context.addIssue({ code: "custom", path: ["passed"], message: "Pass status must match the score threshold" });
  }
}

export const studentHomeworkSubmissionResultSchema =
  studentHomeworkSubmissionResultBaseSchema.superRefine(validatePublicSubmissionResult);

const studentHomeworkPromptDetailSuccessSchema = z
  .object({
    kind: z.literal("prompts"),
    assignment: z
      .object({
        assignmentId: uuidSchema,
        className: nonEmptyStringSchema,
        title: nonEmptyStringSchema.nullable(),
        createdAt: z.iso.datetime({ offset: true }),
        exerciseCount: studentHomeworkExerciseCountSchema,
      })
      .strict(),
    exercises: z
      .object({
        position: studentHomeworkAnswerPositionSchema,
        prompt: nonEmptyPreservedStringSchema,
      })
      .strict()
      .array(),
    submission: studentHomeworkSubmissionResultSchema.nullable(),
  })
  .strict()
  .superRefine(({ assignment, exercises, submission }, context) => {
    validateOrderedPositions(
      exercises.map(({ position }) => position),
      assignment.exerciseCount,
      context,
      "exercises",
    );
    if (submission && submission.assignedCount !== assignment.exerciseCount) {
      context.addIssue({ code: "custom", path: ["submission", "assignedCount"], message: "Submission count mismatch" });
    }
  });

const studentHomeworkResultOnlyDetailSuccessSchema = z
  .object({
    kind: z.literal("result-only"),
    assignment: z
      .object({
        assignmentId: uuidSchema,
        className: nonEmptyStringSchema,
        title: nonEmptyStringSchema.nullable(),
        createdAt: z.iso.datetime({ offset: true }),
        exerciseCount: studentHomeworkExerciseCountSchema,
      })
      .strict(),
    result: studentHomeworkSubmissionResultSchema,
  })
  .strict()
  .superRefine(({ assignment, result }, context) => {
    if (result.assignedCount !== assignment.exerciseCount) {
      context.addIssue({
        code: "custom",
        path: ["result", "assignedCount"],
        message: "Submission count mismatch",
      });
    }
  });

export const studentHomeworkDetailSuccessSchema = z.discriminatedUnion("kind", [
  studentHomeworkPromptDetailSuccessSchema,
  studentHomeworkResultOnlyDetailSuccessSchema,
]);

const studentHomeworkScoredSubmitSuccessSchema = studentHomeworkSubmissionResultBaseSchema
  .extend({ kind: z.literal("scored"), replayed: z.boolean() })
  .strict()
  .superRefine(validatePublicSubmissionResult);

const studentHomeworkResultOnlySubmitSuccessSchema = studentHomeworkSubmissionResultBaseSchema
  .extend({ kind: z.literal("result-only"), replayed: z.literal(true) })
  .strict()
  .superRefine(validatePublicSubmissionResult);

export const studentHomeworkSubmitSuccessSchema = z.discriminatedUnion("kind", [
  studentHomeworkScoredSubmitSuccessSchema,
  studentHomeworkResultOnlySubmitSuccessSchema,
]);

export const studentHomeworkApiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.enum(STUDENT_HOMEWORK_API_ERROR_CODES),
        message: nonEmptyStringSchema,
      })
      .strict(),
  })
  .strict();
