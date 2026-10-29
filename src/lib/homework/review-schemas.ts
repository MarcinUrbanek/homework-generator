import { z } from "zod";

import {
  HOMEWORK_FEEDBACK_MAX_LENGTH,
  homeworkDifficultySchema,
  homeworkFeedbackRpcSchema,
  homeworkFeedbackSchema,
  homeworkTopicSchema,
} from "@/lib/homework/schemas";
import { HOMEWORK_REVIEW_API_ERROR_CODES } from "@/types";

const uuidSchema = z.uuid();
const timestampSchema = z.iso.datetime({ offset: true });
const nonEmptyStringSchema = z.string().trim().min(1);
const nonEmptyPreservedStringSchema = z.string().refine((value) => value.trim().length > 0);
const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const exerciseCountSchema = z.number().int().min(1).max(5);
const positionSchema = z.number().int().min(1).max(5);
const countSchema = z.number().int().min(0);

// Mirrors the ASCII whitespace set trimmed by save_homework_submission_feedback.
const FEEDBACK_EDGE_WHITESPACE = /^[ \t\n\v\f\r]+|[ \t\n\v\f\r]+$/gu;

export function trimHomeworkFeedback(value: string): string {
  return value.replace(FEEDBACK_EDGE_WHITESPACE, "");
}

export const homeworkReviewIdSchema = uuidSchema;

export const homeworkFeedbackRequestSchema = z
  .object({
    feedback: z.string().refine((value) => trimHomeworkFeedback(value).length <= HOMEWORK_FEEDBACK_MAX_LENGTH, {
      message: `Feedback must be at most ${String(HOMEWORK_FEEDBACK_MAX_LENGTH)} characters`,
    }),
  })
  .strict();

export const homeworkFeedbackSuccessSchema = z.object({ feedback: homeworkFeedbackSchema.nullable() }).strict();

export const homeworkFeedbackSaveRpcSchema = z.object({ feedback: homeworkFeedbackRpcSchema.nullable() }).strict();

export const homeworkReviewApiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.enum(HOMEWORK_REVIEW_API_ERROR_CODES),
        message: nonEmptyStringSchema,
      })
      .strict(),
  })
  .strict();

export const teacherClassHomeworkRpcRowSchema = z
  .object({
    assignment_id: uuidSchema,
    title: nonEmptyStringSchema.nullable(),
    grade: nonEmptyStringSchema,
    topic: homeworkTopicSchema,
    difficulty: homeworkDifficultySchema,
    exercise_count: exerciseCountSchema,
    created_at: timestampSchema,
    recipient_count: countSchema,
    submitted_count: countSchema,
    passed_count: countSchema,
    feedback_count: countSchema,
  })
  .strict()
  .superRefine((row, context) => {
    if (
      row.submitted_count > row.recipient_count ||
      row.passed_count > row.submitted_count ||
      row.feedback_count > row.submitted_count
    ) {
      context.addIssue({ code: "custom", path: ["submitted_count"], message: "Homework counts must be consistent" });
    }
  });

const teacherAssignmentRpcSchema = z
  .object({
    assignment_id: uuidSchema,
    class_id: uuidSchema,
    class_name: nonEmptyStringSchema,
    title: nonEmptyStringSchema.nullable(),
    grade: nonEmptyStringSchema,
    topic: homeworkTopicSchema,
    difficulty: homeworkDifficultySchema,
    exercise_count: exerciseCountSchema,
    created_at: timestampSchema,
  })
  .strict();

const teacherRecipientRpcSchema = z
  .object({
    student_id: uuidSchema,
    student_email: emailSchema,
    is_member: z.boolean(),
    submitted: z.boolean(),
    submitted_at: timestampSchema.nullable(),
    correct_count: countSchema.nullable(),
    passed: z.boolean().nullable(),
    has_feedback: z.boolean(),
  })
  .strict()
  .superRefine((recipient, context) => {
    const hasResult = recipient.submitted_at !== null && recipient.correct_count !== null && recipient.passed !== null;
    const hasAnyResult =
      recipient.submitted_at !== null || recipient.correct_count !== null || recipient.passed !== null;
    if (recipient.submitted ? !hasResult : hasAnyResult) {
      context.addIssue({ code: "custom", path: ["submitted"], message: "Submission fields must be consistent" });
    }
    if (recipient.has_feedback && !recipient.submitted) {
      context.addIssue({ code: "custom", path: ["has_feedback"], message: "Feedback requires a submission" });
    }
  });

export const teacherHomeworkAssignmentRpcSchema = z
  .object({
    assignment: teacherAssignmentRpcSchema,
    recipients: teacherRecipientRpcSchema.array(),
  })
  .strict()
  .superRefine(({ assignment, recipients }, context) => {
    if (new Set(recipients.map(({ student_id: studentId }) => studentId)).size !== recipients.length) {
      context.addIssue({ code: "custom", path: ["recipients"], message: "Recipients must be distinct" });
    }
    if (recipients.some(({ correct_count: correctCount }) => (correctCount ?? 0) > assignment.exercise_count)) {
      context.addIssue({ code: "custom", path: ["recipients"], message: "Scores cannot exceed the exercise count" });
    }
  });

const teacherSubmissionAnswerRpcSchema = z
  .object({
    position: positionSchema,
    prompt: nonEmptyPreservedStringSchema,
    answer: z.string().max(200).nullable(),
    is_correct: z.boolean(),
    expected_answer: nonEmptyPreservedStringSchema,
  })
  .strict();

const teacherSubmissionRpcSchema = z
  .object({
    submission_id: uuidSchema,
    submitted_at: timestampSchema,
    correct_count: countSchema,
    assigned_count: exerciseCountSchema,
    passed: z.boolean(),
    answers: teacherSubmissionAnswerRpcSchema.array(),
  })
  .strict()
  .superRefine((submission, context) => {
    const positions = submission.answers.map(({ position }) => position);
    if (positions.length !== submission.assigned_count || positions.some((position, index) => position !== index + 1)) {
      context.addIssue({ code: "custom", path: ["answers"], message: "Answers must match the assigned order" });
    }
    if (submission.answers.filter(({ is_correct: isCorrect }) => isCorrect).length !== submission.correct_count) {
      context.addIssue({ code: "custom", path: ["correct_count"], message: "Correct count must match answers" });
    }
    if (submission.passed !== 2 * submission.correct_count >= submission.assigned_count) {
      context.addIssue({ code: "custom", path: ["passed"], message: "Pass status must match the score threshold" });
    }
  });

export const teacherHomeworkSubmissionRpcSchema = z
  .object({
    assignment: teacherAssignmentRpcSchema,
    student: z
      .object({
        student_id: uuidSchema,
        student_email: emailSchema,
        is_member: z.boolean(),
      })
      .strict(),
    submission: teacherSubmissionRpcSchema.nullable(),
    feedback: homeworkFeedbackRpcSchema.nullable(),
  })
  .strict()
  .superRefine(({ assignment, submission, feedback }, context) => {
    if (submission && submission.assigned_count !== assignment.exercise_count) {
      context.addIssue({ code: "custom", path: ["submission"], message: "Submission count mismatch" });
    }
    if (feedback && !submission) {
      context.addIssue({ code: "custom", path: ["feedback"], message: "Feedback requires a submission" });
    }
  });
