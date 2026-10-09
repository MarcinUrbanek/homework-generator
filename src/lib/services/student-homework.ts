import { z } from "zod";
import type { User } from "@supabase/supabase-js";

import {
  studentHomeworkAssignmentIdSchema,
  studentHomeworkDetailRpcSchema,
  studentHomeworkDetailSuccessSchema,
  studentHomeworkListSuccessSchema,
  studentHomeworkSubmissionResultSchema,
  studentHomeworkSubmitRequestSchema,
  studentHomeworkSubmitRpcResultSchema,
  studentHomeworkSubmitSuccessSchema,
  studentHomeworkSummaryRpcRowSchema,
} from "@/lib/homework/schemas";
import { createClient } from "@/lib/supabase";
import type {
  StudentHomeworkDetailSuccess,
  StudentHomeworkListSuccess,
  StudentHomeworkSubmitRequest,
  StudentHomeworkSubmitSuccess,
} from "@/types";

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

interface DatabaseFailure {
  code?: unknown;
}

const supabaseResponseSchema = z
  .object({
    data: z.unknown(),
    error: z.unknown().nullable(),
    count: z.number().nullable().optional(),
    status: z.number().optional(),
    statusText: z.string().optional(),
  })
  .strict();

export type StudentHomeworkServiceErrorCode =
  | "INVALID_REQUEST"
  | "FORBIDDEN"
  | "HOMEWORK_UNAVAILABLE"
  | "SUBMISSION_CONFLICT"
  | "SCORING_UNAVAILABLE"
  | "DATABASE_UNAVAILABLE"
  | "PERSISTENCE_FAILURE";

export class StudentHomeworkServiceError extends Error {
  constructor(readonly code: StudentHomeworkServiceErrorCode) {
    super(code);
  }
}

export type StudentAuthorizationResult =
  | { status: "unauthenticated" }
  | { status: "not-student" }
  | { status: "profile-unavailable" }
  | { status: "authorized-student" };

export interface StudentAuthorizationLocals {
  user: Pick<User, "id"> | null;
}

function databaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as DatabaseFailure).code;
  return typeof code === "string" ? code : undefined;
}

function serviceErrorFor(error: unknown): StudentHomeworkServiceError {
  const code = databaseErrorCode(error);
  if (code === "22023") return new StudentHomeworkServiceError("INVALID_REQUEST");
  if (code === "42501") return new StudentHomeworkServiceError("FORBIDDEN");
  if (code === "P0002") return new StudentHomeworkServiceError("HOMEWORK_UNAVAILABLE");
  if (code === "P0003") return new StudentHomeworkServiceError("SUBMISSION_CONFLICT");
  if (code === "P0004") return new StudentHomeworkServiceError("SCORING_UNAVAILABLE");
  if (code === "P0005") return new StudentHomeworkServiceError("PERSISTENCE_FAILURE");
  if (code?.startsWith("08") || ["PGRST000", "PGRST001", "PGRST002"].includes(code ?? "")) {
    return new StudentHomeworkServiceError("DATABASE_UNAVAILABLE");
  }
  if (error instanceof TypeError) return new StudentHomeworkServiceError("DATABASE_UNAVAILABLE");
  return new StudentHomeworkServiceError("PERSISTENCE_FAILURE");
}

async function callRpc(client: RequestClient, name: string, args?: Record<string, unknown>): Promise<unknown> {
  let response: unknown;
  try {
    response = args === undefined ? await client.rpc(name) : await client.rpc(name, args);
  } catch (error) {
    throw serviceErrorFor(error);
  }

  const parsed = supabaseResponseSchema.safeParse(response);
  if (!parsed.success) throw new StudentHomeworkServiceError("PERSISTENCE_FAILURE");
  if (parsed.data.error !== null) throw serviceErrorFor(parsed.data.error);
  return parsed.data.data;
}

function compareAssignmentSummaries(
  left: z.infer<typeof studentHomeworkSummaryRpcRowSchema>,
  right: z.infer<typeof studentHomeworkSummaryRpcRowSchema>,
): number {
  if (left.submitted !== right.submitted) return left.submitted ? 1 : -1;
  const newestFirst = Date.parse(right.created_at) - Date.parse(left.created_at);
  if (newestFirst !== 0) return newestFirst;
  if (left.assignment_id === right.assignment_id) return 0;
  return left.assignment_id < right.assignment_id ? -1 : 1;
}

export async function authorizeStudent(
  locals: StudentAuthorizationLocals,
  client: RequestClient,
): Promise<StudentAuthorizationResult> {
  if (!locals.user) return { status: "unauthenticated" };

  let result: { data: { role?: unknown } | null; error: unknown };
  try {
    result = await client
      .from("profile_roles")
      .select("role")
      .eq("user_id", locals.user.id)
      .eq("role", "student")
      .maybeSingle();
  } catch {
    return { status: "profile-unavailable" };
  }

  if (result.error) return { status: "profile-unavailable" };
  if (!result.data) return { status: "not-student" };
  return result.data.role === "student" ? { status: "authorized-student" } : { status: "profile-unavailable" };
}

export async function listStudentHomework(client: RequestClient): Promise<StudentHomeworkListSuccess> {
  const data = await callRpc(client, "list_student_homework");
  const rows = studentHomeworkSummaryRpcRowSchema.array().safeParse(data);
  if (!rows.success) throw new StudentHomeworkServiceError("PERSISTENCE_FAILURE");

  const assignments = rows.data.sort(compareAssignmentSummaries).map((row) => ({
    assignmentId: row.assignment_id,
    className: row.class_name,
    title: row.assignment_title,
    createdAt: row.created_at,
    exerciseCount: row.exercise_count,
    submitted: row.submitted,
    submittedAt: row.submitted_at,
    correctCount: row.correct_count,
    passed: row.passed,
  }));
  const result = studentHomeworkListSuccessSchema.safeParse({ assignments });
  if (!result.success) throw new StudentHomeworkServiceError("PERSISTENCE_FAILURE");
  return result.data;
}

export async function getStudentHomework(
  client: RequestClient,
  assignmentId: string,
): Promise<StudentHomeworkDetailSuccess> {
  const parsedAssignmentId = studentHomeworkAssignmentIdSchema.safeParse(assignmentId);
  if (!parsedAssignmentId.success) throw new StudentHomeworkServiceError("INVALID_REQUEST");

  const data = await callRpc(client, "get_student_homework", { p_assignment_id: parsedAssignmentId.data });
  const detail = studentHomeworkDetailRpcSchema.safeParse(data);
  if (!detail.success) throw new StudentHomeworkServiceError("PERSISTENCE_FAILURE");

  const submissionResult = studentHomeworkSubmissionResultSchema.nullable().safeParse(
    detail.data.submission
      ? {
          submissionId: detail.data.submission.submission_id,
          submittedAt: detail.data.submission.submitted_at,
          correctCount: detail.data.submission.correct_count,
          assignedCount: detail.data.submission.assigned_count,
          passed: detail.data.submission.passed,
          answers: detail.data.submission.answers.map(({ position, answer, is_correct: isCorrect }) => ({
            position,
            answer,
            isCorrect,
          })),
        }
      : null,
  );
  if (!submissionResult.success) throw new StudentHomeworkServiceError("PERSISTENCE_FAILURE");

  const result = studentHomeworkDetailSuccessSchema.safeParse({
    assignment: {
      assignmentId: detail.data.assignment.assignment_id,
      className: detail.data.assignment.class_name,
      title: detail.data.assignment.title,
      createdAt: detail.data.assignment.created_at,
      exerciseCount: detail.data.assignment.exercise_count,
    },
    exercises: detail.data.exercises.map(({ position, prompt }) => ({ position, prompt })),
    submission: submissionResult.data,
  });
  if (!result.success) throw new StudentHomeworkServiceError("PERSISTENCE_FAILURE");
  return result.data;
}

export async function submitStudentHomework(
  client: RequestClient,
  assignmentId: string,
  request: StudentHomeworkSubmitRequest,
): Promise<StudentHomeworkSubmitSuccess> {
  const parsedAssignmentId = studentHomeworkAssignmentIdSchema.safeParse(assignmentId);
  const parsedRequest = studentHomeworkSubmitRequestSchema.safeParse(request);
  if (!parsedAssignmentId.success || !parsedRequest.success) {
    throw new StudentHomeworkServiceError("INVALID_REQUEST");
  }

  const data = await callRpc(client, "submit_student_homework", {
    p_assignment_id: parsedAssignmentId.data,
    p_answers: parsedRequest.data.answers.map(({ position, answer }) => ({ position, answer })),
  });
  const result = studentHomeworkSubmitRpcResultSchema.safeParse(data);
  if (!result.success) throw new StudentHomeworkServiceError("PERSISTENCE_FAILURE");

  const publicResult = {
    submissionId: result.data.submission_id,
    submittedAt: result.data.submitted_at,
    correctCount: result.data.correct_count,
    assignedCount: result.data.assigned_count,
    passed: result.data.passed,
    answers: result.data.answers.map(({ position, answer, is_correct: isCorrect }) => ({
      position,
      answer,
      isCorrect,
    })),
    replayed: result.data.replayed,
  };
  const parsedResult = studentHomeworkSubmitSuccessSchema.safeParse(publicResult);
  if (!parsedResult.success) throw new StudentHomeworkServiceError("PERSISTENCE_FAILURE");
  return parsedResult.data;
}
