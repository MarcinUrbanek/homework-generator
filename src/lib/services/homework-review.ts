import { z } from "zod";

import {
  homeworkFeedbackRequestSchema,
  homeworkFeedbackSaveRpcSchema,
  homeworkReviewIdSchema,
  teacherClassHomeworkRpcRowSchema,
  teacherHomeworkAssignmentRpcSchema,
  teacherHomeworkSubmissionRpcSchema,
} from "@/lib/homework/review-schemas";
import { createClient } from "@/lib/supabase";
import type {
  HomeworkFeedback,
  HomeworkFeedbackSuccess,
  TeacherClassHomeworkSummary,
  TeacherHomeworkAssignment,
  TeacherHomeworkAssignmentDetail,
  TeacherHomeworkSubmissionReview,
} from "@/types";

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

const supabaseResponseSchema = z
  .object({
    success: z.boolean().optional(),
    data: z.unknown(),
    error: z.unknown().nullable(),
    count: z.number().nullable().optional(),
    status: z.number().optional(),
    statusText: z.string().optional(),
  })
  .strict();

export type HomeworkReviewServiceErrorCode =
  "INVALID_REQUEST" | "HOMEWORK_UNAVAILABLE" | "FEEDBACK_NOT_ALLOWED" | "DATABASE_UNAVAILABLE" | "PERSISTENCE_FAILURE";

export class HomeworkReviewServiceError extends Error {
  constructor(readonly code: HomeworkReviewServiceErrorCode) {
    super(code);
  }
}

function databaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function serviceErrorFor(error: unknown): HomeworkReviewServiceError {
  const code = databaseErrorCode(error);
  if (code === "22023") return new HomeworkReviewServiceError("INVALID_REQUEST");
  // 42501 only reaches sessions without execute rights; treat it like any other inaccessible homework.
  if (code === "P0002" || code === "42501") return new HomeworkReviewServiceError("HOMEWORK_UNAVAILABLE");
  if (code === "P0003") return new HomeworkReviewServiceError("FEEDBACK_NOT_ALLOWED");
  if (code?.startsWith("08") || ["PGRST000", "PGRST001", "PGRST002"].includes(code ?? "")) {
    return new HomeworkReviewServiceError("DATABASE_UNAVAILABLE");
  }
  if (error instanceof TypeError) return new HomeworkReviewServiceError("DATABASE_UNAVAILABLE");
  return new HomeworkReviewServiceError("PERSISTENCE_FAILURE");
}

async function callRpc(client: RequestClient, name: string, args: Record<string, unknown>): Promise<unknown> {
  let response: unknown;
  try {
    response = await client.rpc(name, args);
  } catch (error) {
    throw serviceErrorFor(error);
  }

  const parsed = supabaseResponseSchema.safeParse(response);
  if (!parsed.success) throw new HomeworkReviewServiceError("PERSISTENCE_FAILURE");
  if (parsed.data.error !== null) throw serviceErrorFor(parsed.data.error);
  return parsed.data.data;
}

function parseId(value: string): string {
  const parsed = homeworkReviewIdSchema.safeParse(value);
  if (!parsed.success) throw new HomeworkReviewServiceError("INVALID_REQUEST");
  return parsed.data;
}

function mapFeedback(feedback: { body: string; updated_at: string } | null): HomeworkFeedback | null {
  return feedback ? { body: feedback.body, updatedAt: feedback.updated_at } : null;
}

function mapAssignment(
  assignment: z.infer<typeof teacherHomeworkAssignmentRpcSchema>["assignment"],
): TeacherHomeworkAssignment {
  return {
    assignmentId: assignment.assignment_id,
    classId: assignment.class_id,
    className: assignment.class_name,
    title: assignment.title,
    grade: assignment.grade,
    topic: assignment.topic,
    difficulty: assignment.difficulty,
    exerciseCount: assignment.exercise_count,
    createdAt: assignment.created_at,
  };
}

export async function listTeacherClassHomework(
  client: RequestClient,
  classId: string,
): Promise<TeacherClassHomeworkSummary[]> {
  const data = await callRpc(client, "list_teacher_class_homework", { p_class_id: parseId(classId) });
  const rows = teacherClassHomeworkRpcRowSchema.array().safeParse(data);
  if (!rows.success) throw new HomeworkReviewServiceError("PERSISTENCE_FAILURE");

  return rows.data.map((row) => ({
    assignmentId: row.assignment_id,
    title: row.title,
    grade: row.grade,
    topic: row.topic,
    difficulty: row.difficulty,
    exerciseCount: row.exercise_count,
    createdAt: row.created_at,
    recipientCount: row.recipient_count,
    submittedCount: row.submitted_count,
    passedCount: row.passed_count,
    feedbackCount: row.feedback_count,
  }));
}

export async function getTeacherHomeworkAssignment(
  client: RequestClient,
  assignmentId: string,
): Promise<TeacherHomeworkAssignmentDetail> {
  const data = await callRpc(client, "get_teacher_homework_assignment", { p_assignment_id: parseId(assignmentId) });
  const detail = teacherHomeworkAssignmentRpcSchema.safeParse(data);
  if (!detail.success) throw new HomeworkReviewServiceError("PERSISTENCE_FAILURE");

  return {
    assignment: mapAssignment(detail.data.assignment),
    recipients: detail.data.recipients.map((recipient) => ({
      studentId: recipient.student_id,
      email: recipient.student_email,
      isMember: recipient.is_member,
      submitted: recipient.submitted,
      submittedAt: recipient.submitted_at,
      correctCount: recipient.correct_count,
      passed: recipient.passed,
      hasFeedback: recipient.has_feedback,
    })),
  };
}

export async function getTeacherHomeworkSubmission(
  client: RequestClient,
  assignmentId: string,
  studentId: string,
): Promise<TeacherHomeworkSubmissionReview> {
  const data = await callRpc(client, "get_teacher_homework_submission", {
    p_assignment_id: parseId(assignmentId),
    p_student_id: parseId(studentId),
  });
  const review = teacherHomeworkSubmissionRpcSchema.safeParse(data);
  if (!review.success) throw new HomeworkReviewServiceError("PERSISTENCE_FAILURE");

  const { submission } = review.data;
  return {
    assignment: mapAssignment(review.data.assignment),
    student: {
      studentId: review.data.student.student_id,
      email: review.data.student.student_email,
      isMember: review.data.student.is_member,
    },
    submission: submission
      ? {
          submissionId: submission.submission_id,
          submittedAt: submission.submitted_at,
          correctCount: submission.correct_count,
          assignedCount: submission.assigned_count,
          passed: submission.passed,
          answers: submission.answers.map((answer) => ({
            position: answer.position,
            prompt: answer.prompt,
            answer: answer.answer,
            isCorrect: answer.is_correct,
            expectedAnswer: answer.expected_answer,
          })),
        }
      : null,
    feedback: mapFeedback(review.data.feedback),
  };
}

export async function saveHomeworkSubmissionFeedback(
  client: RequestClient,
  assignmentId: string,
  studentId: string,
  body: string,
): Promise<HomeworkFeedbackSuccess> {
  const parsedAssignmentId = parseId(assignmentId);
  const parsedStudentId = parseId(studentId);
  const request = homeworkFeedbackRequestSchema.safeParse({ feedback: body });
  if (!request.success) throw new HomeworkReviewServiceError("INVALID_REQUEST");

  const data = await callRpc(client, "save_homework_submission_feedback", {
    p_assignment_id: parsedAssignmentId,
    p_student_id: parsedStudentId,
    p_body: request.data.feedback,
  });
  const saved = homeworkFeedbackSaveRpcSchema.safeParse(data);
  if (!saved.success) throw new HomeworkReviewServiceError("PERSISTENCE_FAILURE");
  return { feedback: mapFeedback(saved.data.feedback) };
}
