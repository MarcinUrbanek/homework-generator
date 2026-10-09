import { describe, expect, it, vi } from "vitest";

import {
  createHomeworkAssignment,
  HomeworkAssignmentServiceError,
  loadApprovedHomeworkExerciseIds,
} from "./homework-assignments";

vi.mock("astro:env/server", () => ({
  SUPABASE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_URL: undefined,
}));

const classId = "00000000-0000-4000-8000-000000000001";
const firstStudentId = "00000000-0000-4000-8000-000000000002";
const secondStudentId = "00000000-0000-4000-8000-000000000003";
const idempotencyKey = "00000000-0000-4000-8000-000000000004";
const approvedAt = "2026-10-08T12:00:00.000Z";
const rosterRow = (studentId: string) => ({
  student_id: studentId,
  student_email: `${studentId.slice(-1)}@example.test`,
  joined_at: approvedAt,
});

function exerciseId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function savedExerciseRow(index: number) {
  return {
    id: exerciseId(index),
    exercise_text: `Exercise ${index}`,
    canonical_answer: `Answer ${index}`,
    grade: "4",
    topic: "addition-subtraction",
    difficulty: "easy",
    approved_at: approvedAt,
  };
}

function assignmentRow(replayed: boolean) {
  return {
    assignment_id: "00000000-0000-4000-8000-000000000005",
    assignment_title: "Practice",
    assigned_student_ids: [firstStudentId, secondStudentId],
    excluded_student_ids: [],
    created_at: approvedAt,
    replayed,
  };
}

const request = {
  classId,
  studentIds: [firstStudentId, secondStudentId],
  title: "Practice",
  topic: "addition-subtraction" as const,
  difficulty: "easy" as const,
  exerciseCount: 2 as const,
  idempotencyKey,
};

describe("homework assignment adapters", () => {
  it("loads every saved-exercise page while retaining only approved IDs", async () => {
    const firstPage = Array.from({ length: 21 }, (_, index) => savedExerciseRow(index + 1));
    const secondPage = [savedExerciseRow(22), savedExerciseRow(23)];
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: secondPage, error: null });

    const exerciseIds = await loadApprovedHomeworkExerciseIds({ rpc } as never, "addition-subtraction", "easy");

    expect(exerciseIds).toEqual(Array.from({ length: 23 }, (_, index) => exerciseId(index + 1)));
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(
      1,
      "get_saved_exercises",
      expect.objectContaining({ p_grade: "4", p_topic: "addition-subtraction", p_difficulty: "easy", p_limit: 21 }),
    );
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      "get_saved_exercises",
      expect.objectContaining({ p_cursor_approved_at: approvedAt, p_cursor_id: exerciseId(21) }),
    );
    expect(JSON.stringify(exerciseIds)).not.toContain("canonical_answer");
    expect(JSON.stringify(exerciseIds)).not.toContain("Answer");
  });

  it("rejects malformed saved-exercise database rows", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: exerciseId(1), canonical_answer: "secret" }], error: null });

    await expect(
      loadApprovedHomeworkExerciseIds({ rpc } as never, "addition-subtraction", "easy"),
    ).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
  });

  it("preserves allocations for the same idempotency key and returns summary data only", async () => {
    const exercises = Array.from({ length: 4 }, (_, index) => savedExerciseRow(index + 1));
    let replayLookups = 0;
    const rpc = vi.fn<(name: string, args: Record<string, unknown>) => unknown>((name) => {
      if (name === "get_homework_assignment_replay") {
        replayLookups += 1;
        return { data: replayLookups === 1 ? [] : [assignmentRow(true)], error: null };
      }
      if (name === "list_class_homework_roster") {
        return { data: [rosterRow(firstStudentId), rosterRow(secondStudentId)], error: null };
      }
      if (name === "get_saved_exercises") return { data: exercises, error: null };
      if (name === "create_homework_assignment") return { data: [assignmentRow(false)], error: null };
      throw new Error(`Unexpected RPC: ${name}`);
    });

    const client = { rpc } as never;
    const firstResult = await createHomeworkAssignment(client, request);
    const retryResult = await createHomeworkAssignment(client, request);
    const firstCreateArgs = rpc.mock.calls.find(([name]) => name === "create_homework_assignment")?.[1];

    expect(firstResult.replayed).toBe(false);
    expect(retryResult.replayed).toBe(true);
    expect(firstResult.assignmentId).toBe(retryResult.assignmentId);
    expect(firstCreateArgs?.p_idempotency_key).toBe(idempotencyKey);
    expect(rpc.mock.calls.filter(([name]) => name === "create_homework_assignment")).toHaveLength(1);
    expect(rpc.mock.calls.filter(([name]) => name === "get_homework_assignment_replay")).toHaveLength(2);
    expect(firstResult).not.toHaveProperty("allocations");
    expect(JSON.stringify(firstResult)).not.toContain("canonical_answer");
    expect(JSON.stringify(firstResult)).not.toContain("exerciseIds");
  });

  it("allocates for current recipients when departed selections exceed pool capacity", async () => {
    const thirdStudentId = "00000000-0000-4000-8000-000000000006";
    const exercises = [savedExerciseRow(1), savedExerciseRow(2)];
    const createdRow = {
      ...assignmentRow(false),
      assigned_student_ids: [firstStudentId, secondStudentId],
      excluded_student_ids: [thirdStudentId],
    };
    const rpc = vi.fn<(name: string, args: Record<string, unknown>) => unknown>((name) => {
      if (name === "get_homework_assignment_replay") return { data: [], error: null };
      if (name === "list_class_homework_roster") {
        return { data: [rosterRow(firstStudentId), rosterRow(secondStudentId)], error: null };
      }
      if (name === "get_saved_exercises") return { data: exercises, error: null };
      if (name === "create_homework_assignment") return { data: [createdRow], error: null };
      throw new Error(`Unexpected RPC: ${name}`);
    });

    const result = await createHomeworkAssignment({ rpc } as never, {
      ...request,
      studentIds: [firstStudentId, secondStudentId, thirdStudentId],
      exerciseCount: 1,
    });
    const createArgs = rpc.mock.calls.find(([name]) => name === "create_homework_assignment")?.[1];

    expect(result).toMatchObject({ assignedCount: 2, excludedStudentIds: [thirdStudentId], excludedCount: 1 });
    expect(createArgs?.p_allocations).toHaveLength(3);
    expect(createArgs?.p_allocations).toMatchObject([
      { student_id: firstStudentId },
      { student_id: secondStudentId },
      { student_id: thirdStudentId },
    ]);
  });

  it("does not call the creation RPC when combination capacity is insufficient", async () => {
    const rpc = vi.fn((name: string) => {
      if (name === "get_homework_assignment_replay") return { data: [], error: null };
      if (name === "list_class_homework_roster") {
        return {
          data: Array.from({ length: 7 }, (_, index) => rosterRow(exerciseId(index + 101))),
          error: null,
        };
      }
      if (name === "get_saved_exercises") {
        return { data: Array.from({ length: 4 }, (_, index) => savedExerciseRow(index + 1)), error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });
    const oversizedRequest = {
      ...request,
      studentIds: Array.from({ length: 7 }, (_, index) => exerciseId(index + 101)),
    };

    await expect(createHomeworkAssignment({ rpc } as never, oversizedRequest)).rejects.toBeInstanceOf(
      HomeworkAssignmentServiceError,
    );
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "get_homework_assignment_replay",
      "list_class_homework_roster",
      "get_saved_exercises",
    ]);
  });

  it("maps a changed idempotency payload to an invalid-request error", async () => {
    const rpc = vi.fn((name: string) => {
      if (name === "get_homework_assignment_replay") {
        return { data: null, error: { code: "22023", message: "private SQL detail" } };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });

    await expect(createHomeworkAssignment({ rpc } as never, request)).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    });
  });
});
