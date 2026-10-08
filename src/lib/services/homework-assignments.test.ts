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
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: exercises, error: null })
      .mockResolvedValueOnce({ data: [assignmentRow(false)], error: null })
      .mockResolvedValueOnce({ data: exercises, error: null })
      .mockResolvedValueOnce({ data: [assignmentRow(true)], error: null });

    const client = { rpc } as never;
    const firstResult = await createHomeworkAssignment(client, request);
    const retryResult = await createHomeworkAssignment(client, request);
    const firstCreateArgs = rpc.mock.calls[1][1] as { p_allocations: unknown; p_idempotency_key: string };
    const retryCreateArgs = rpc.mock.calls[3][1] as { p_allocations: unknown; p_idempotency_key: string };

    expect(firstResult.replayed).toBe(false);
    expect(retryResult.replayed).toBe(true);
    expect(firstResult.assignmentId).toBe(retryResult.assignmentId);
    expect(firstCreateArgs.p_idempotency_key).toBe(idempotencyKey);
    expect(retryCreateArgs.p_idempotency_key).toBe(idempotencyKey);
    expect(retryCreateArgs.p_allocations).toEqual(firstCreateArgs.p_allocations);
    expect(firstResult).not.toHaveProperty("allocations");
    expect(JSON.stringify(firstResult)).not.toContain("canonical_answer");
    expect(JSON.stringify(firstResult)).not.toContain("exerciseIds");
  });

  it("does not call the creation RPC when combination capacity is insufficient", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: Array.from({ length: 4 }, (_, index) => savedExerciseRow(index + 1)), error: null });
    const oversizedRequest = {
      ...request,
      studentIds: Array.from({ length: 7 }, (_, index) => exerciseId(index + 101)),
    };

    await expect(createHomeworkAssignment({ rpc } as never, oversizedRequest)).rejects.toBeInstanceOf(
      HomeworkAssignmentServiceError,
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("maps a changed idempotency payload to an invalid-request error", async () => {
    const exercises = Array.from({ length: 4 }, (_, index) => savedExerciseRow(index + 1));
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: exercises, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "22023", message: "private SQL detail" } });

    await expect(createHomeworkAssignment({ rpc } as never, request)).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    });
  });
});
