import { z } from "zod";

import { savedExerciseRetrievalRowSchema } from "@/lib/exercises/schemas";
import { allocateDistinctSets } from "@/lib/homework/allocate-distinct-sets";
import { homeworkAssignmentRpcRowSchema, homeworkRosterRpcRowSchema } from "@/lib/homework/schemas";
import { createClient } from "@/lib/supabase";
import type {
  ExerciseDifficulty,
  ExerciseTopicSlug,
  HomeworkAssignmentRequest,
  HomeworkAssignmentSuccess,
  HomeworkRosterMember,
} from "@/types";

type RequestClient = NonNullable<ReturnType<typeof createClient>>;

interface DatabaseFailure {
  code?: string;
}

const supabaseResponseSchema = z.object({ data: z.unknown(), error: z.unknown().nullable() });

export type HomeworkAssignmentServiceErrorCode =
  | "INVALID_REQUEST"
  | "CLASS_UNAVAILABLE"
  | "EMPTY_ELIGIBLE_ROSTER"
  | "INSUFFICIENT_POOL"
  | "DATABASE_UNAVAILABLE"
  | "PERSISTENCE_FAILURE";

export class HomeworkAssignmentServiceError extends Error {
  constructor(
    readonly code: HomeworkAssignmentServiceErrorCode,
    readonly requiredExerciseCount?: number,
    readonly availableExerciseCount?: number,
  ) {
    super(code);
  }
}

function databaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof (error as DatabaseFailure).code === "string" ? (error as DatabaseFailure).code : undefined;
}

function serviceErrorFor(error: unknown): HomeworkAssignmentServiceError {
  const code = databaseErrorCode(error);
  if (code === "22023") return new HomeworkAssignmentServiceError("INVALID_REQUEST");
  if (code === "42501") return new HomeworkAssignmentServiceError("CLASS_UNAVAILABLE");
  if (code === "P0002") return new HomeworkAssignmentServiceError("EMPTY_ELIGIBLE_ROSTER");
  if (code?.startsWith("08") || ["PGRST000", "PGRST001", "PGRST002"].includes(code ?? "")) {
    return new HomeworkAssignmentServiceError("DATABASE_UNAVAILABLE");
  }
  if (error instanceof TypeError) return new HomeworkAssignmentServiceError("DATABASE_UNAVAILABLE");
  return new HomeworkAssignmentServiceError("PERSISTENCE_FAILURE");
}

async function callRpc(client: RequestClient, name: string, args: Record<string, unknown>): Promise<unknown> {
  let response: unknown;
  try {
    response = await client.rpc(name, args);
  } catch (error) {
    throw serviceErrorFor(error);
  }

  const parsed = supabaseResponseSchema.safeParse(response);
  if (!parsed.success) throw new HomeworkAssignmentServiceError("PERSISTENCE_FAILURE");
  if (parsed.data.error !== null) throw serviceErrorFor(parsed.data.error);
  return parsed.data.data;
}

export async function loadHomeworkRoster(client: RequestClient, classId: string): Promise<HomeworkRosterMember[]> {
  const data = await callRpc(client, "list_class_homework_roster", { p_class_id: classId });
  const rows = homeworkRosterRpcRowSchema.array().safeParse(data);
  if (!rows.success) throw new HomeworkAssignmentServiceError("PERSISTENCE_FAILURE");
  return rows.data.map((row) => ({
    studentId: row.student_id,
    email: row.student_email,
    joinedAt: row.joined_at,
  }));
}

export async function loadApprovedHomeworkExerciseIds(
  client: RequestClient,
  topic: ExerciseTopicSlug,
  difficulty: ExerciseDifficulty,
): Promise<string[]> {
  const exerciseIds: string[] = [];
  const seenIds = new Set<string>();
  let cursor: { approvedAt: string; id: string } | null = null;
  const seenCursors = new Set<string>();

  for (;;) {
    const rowsData = await callRpc(client, "get_saved_exercises", {
      p_grade: "4",
      p_topic: topic,
      p_difficulty: difficulty,
      p_cursor_approved_at: cursor?.approvedAt ?? null,
      p_cursor_id: cursor?.id ?? null,
      p_limit: 21,
    });
    const rows = savedExerciseRetrievalRowSchema.array().safeParse(rowsData);
    if (!rows.success || rows.data.length > 21) throw new HomeworkAssignmentServiceError("PERSISTENCE_FAILURE");

    for (const row of rows.data) {
      if (row.topic !== topic || row.difficulty !== difficulty || seenIds.has(row.id)) {
        throw new HomeworkAssignmentServiceError("PERSISTENCE_FAILURE");
      }
      seenIds.add(row.id);
      exerciseIds.push(row.id);
    }

    if (rows.data.length < 21) return exerciseIds;
    const lastRow = rows.data[20];
    const nextCursor = { approvedAt: lastRow.approved_at, id: lastRow.id };
    const cursorKey = `${nextCursor.approvedAt}:${nextCursor.id}`;
    if (seenCursors.has(cursorKey)) throw new HomeworkAssignmentServiceError("PERSISTENCE_FAILURE");
    seenCursors.add(cursorKey);
    cursor = nextCursor;
  }
}

function seededRandom(key: string): () => number {
  let seed = 2166136261;
  for (const character of key) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);

  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export async function createHomeworkAssignment(
  client: RequestClient,
  request: HomeworkAssignmentRequest,
): Promise<HomeworkAssignmentSuccess> {
  const exerciseIds = await loadApprovedHomeworkExerciseIds(client, request.topic, request.difficulty);
  const allocation = allocateDistinctSets({
    exerciseIds,
    studentIds: request.studentIds,
    exerciseCount: request.exerciseCount,
    random: seededRandom(request.idempotencyKey),
  });
  if (!allocation.ok) {
    if (allocation.code === "INSUFFICIENT_POOL") {
      throw new HomeworkAssignmentServiceError(
        "INSUFFICIENT_POOL",
        allocation.requiredExerciseCount,
        allocation.availableExerciseCount,
      );
    }
    throw new HomeworkAssignmentServiceError("PERSISTENCE_FAILURE");
  }

  const data = await callRpc(client, "create_homework_assignment", {
    p_class_id: request.classId,
    p_title: request.title ?? null,
    p_topic: request.topic,
    p_difficulty: request.difficulty,
    p_exercise_count: request.exerciseCount,
    p_idempotency_key: request.idempotencyKey,
    p_allocations: allocation.allocations.map(({ studentId, exerciseIds: assignedExerciseIds }) => ({
      student_id: studentId,
      exercise_ids: assignedExerciseIds,
    })),
  });
  const rows = homeworkAssignmentRpcRowSchema.array().safeParse(data);
  if (!rows.success || rows.data.length !== 1) throw new HomeworkAssignmentServiceError("PERSISTENCE_FAILURE");

  const row = rows.data[0];
  const requestedStudentIds = new Set(request.studentIds);
  const returnedStudentIds = [...row.assigned_student_ids, ...row.excluded_student_ids];
  if (
    returnedStudentIds.length !== request.studentIds.length ||
    returnedStudentIds.some((studentId) => !requestedStudentIds.has(studentId))
  ) {
    throw new HomeworkAssignmentServiceError("PERSISTENCE_FAILURE");
  }

  return {
    assignmentId: row.assignment_id,
    title: row.assignment_title,
    createdAt: row.created_at,
    assignedCount: row.assigned_student_ids.length,
    excludedStudentIds: row.excluded_student_ids,
    excludedCount: row.excluded_student_ids.length,
    replayed: row.replayed,
  };
}
