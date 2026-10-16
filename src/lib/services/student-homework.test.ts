import { describe, expect, it, vi } from "vitest";

import {
  authorizeStudent,
  getStudentHomework,
  listStudentHomework,
  StudentHomeworkServiceError,
  submitStudentHomework,
} from "./student-homework";

vi.mock("astro:env/server", () => ({
  SUPABASE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_URL: undefined,
}));

const assignmentId = "00000000-0000-4000-8000-000000000001";
const secondAssignmentId = "00000000-0000-4000-8000-000000000002";
const submittedAt = "2026-10-09T12:00:00.000Z";
const request = {
  answers: [
    { position: 2, answer: null },
    { position: 1, answer: " 0001 " },
  ],
};

function summaryRow(overrides: Record<string, unknown> = {}) {
  return {
    assignment_id: assignmentId,
    class_name: "Matematyka 4A",
    assignment_title: null,
    created_at: "2026-10-09T10:00:00.000Z",
    exercise_count: 2,
    submitted: false,
    submitted_at: null,
    correct_count: null,
    passed: null,
    ...overrides,
  };
}

function submissionRow(replayed: boolean) {
  return {
    kind: "scored",
    submission_id: "00000000-0000-4000-8000-000000000003",
    submitted_at: submittedAt,
    correct_count: 1,
    assigned_count: 2,
    passed: true,
    answers: [
      { position: 1, answer: " 0001 ", normalized_answer: "1", is_correct: true },
      { position: 2, answer: null, normalized_answer: null, is_correct: false },
    ],
    replayed,
  };
}

function detailRow(withSubmission = false) {
  return {
    kind: "prompts",
    assignment: {
      assignment_id: assignmentId,
      class_name: "Matematyka 4A",
      title: "Powtórka",
      created_at: "2026-10-09T10:00:00.000Z",
      exercise_count: 2,
    },
    exercises: [
      { position: 1, prompt: "Ile to 1 + 1?" },
      { position: 2, prompt: "Ile to 2 + 2?" },
    ],
    submission: withSubmission
      ? {
          submission_id: "00000000-0000-4000-8000-000000000003",
          submitted_at: submittedAt,
          correct_count: 1,
          assigned_count: 2,
          passed: true,
          answers: [
            { position: 1, answer: " 0001 ", normalized_answer: "1", is_correct: true },
            { position: 2, answer: null, normalized_answer: null, is_correct: false },
          ],
        }
      : null,
  };
}

function resultOnlyDetailRow() {
  return {
    kind: "result-only",
    assignment: {
      assignment_id: assignmentId,
      class_name: "Matematyka 4A",
      title: "Powtórka",
      created_at: "2026-10-09T10:00:00.000Z",
      exercise_count: 2,
    },
    result: {
      submission_id: "00000000-0000-4000-8000-000000000003",
      submitted_at: submittedAt,
      correct_count: 1,
      assigned_count: 2,
      passed: true,
      answers: [
        { position: 1, answer: " 0001 ", is_correct: true },
        { position: 2, answer: null, is_correct: false },
      ],
    },
  };
}

function rpcClient(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as never;
}

describe("student homework adapters", () => {
  it("loads every allowlisted summary and orders pending/newest before submitted with stable IDs", async () => {
    const rows = [
      summaryRow({ assignment_id: "00000000-0000-4000-8000-000000000006", created_at: "2026-10-07T10:00:00.000Z" }),
      summaryRow({ assignment_id: secondAssignmentId, created_at: "2026-10-09T10:00:00.000Z" }),
      summaryRow({
        assignment_id: "00000000-0000-4000-8000-000000000004",
        created_at: "2026-10-08T10:00:00.000Z",
        submitted: true,
        submitted_at: submittedAt,
        correct_count: 1,
        passed: true,
      }),
      summaryRow({
        assignment_id: "00000000-0000-4000-8000-000000000005",
        created_at: "2026-10-08T10:00:00.000Z",
        submitted: true,
        submitted_at: submittedAt,
        correct_count: 0,
        passed: false,
      }),
      summaryRow({
        assignment_id: "00000000-0000-4000-8000-000000000008",
        created_at: "2026-10-09T10:00:00.000Z",
      }),
      summaryRow({
        assignment_id: "00000000-0000-4000-8000-000000000007",
        created_at: "2026-10-09T10:00:00.000Z",
      }),
    ];
    const rpc = vi.fn().mockResolvedValue({ success: true, data: rows, error: null });

    const result = await listStudentHomework(rpcClient(rpc));

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("list_student_homework");
    expect(result.assignments.map(({ assignmentId: id }) => id)).toEqual([
      secondAssignmentId,
      "00000000-0000-4000-8000-000000000007",
      "00000000-0000-4000-8000-000000000008",
      "00000000-0000-4000-8000-000000000006",
      "00000000-0000-4000-8000-000000000004",
      "00000000-0000-4000-8000-000000000005",
    ]);
    expect(result.assignments[0]).toEqual({
      assignmentId: secondAssignmentId,
      className: "Matematyka 4A",
      title: null,
      createdAt: "2026-10-09T10:00:00.000Z",
      exerciseCount: 2,
      submitted: false,
      submittedAt: null,
      correctCount: null,
      passed: null,
    });
    expect(JSON.stringify(result)).not.toMatch(/canonical_answer|exercise_id|recipient_id|student_email|verifier/i);
  });

  it("does not truncate accessible rows and rejects malformed or non-allowlisted RPC rows", async () => {
    const manyRows = Array.from({ length: 30 }, (_, index) =>
      summaryRow({
        assignment_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      }),
    );
    const rpc = vi.fn().mockResolvedValue({ data: manyRows, error: null });
    await expect(listStudentHomework(rpcClient(rpc))).resolves.toHaveProperty("assignments.length", 30);

    const malformedRpc = vi
      .fn()
      .mockResolvedValue({ data: [{ ...summaryRow(), canonical_answer: "private" }], error: null });
    await expect(listStudentHomework(rpcClient(malformedRpc))).rejects.toMatchObject({
      code: "PERSISTENCE_FAILURE",
    });
  });

  it("maps detail RPC data to ordered prompts and a nullable, raw-answer result", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: detailRow(true), error: null });

    const result = await getStudentHomework(rpcClient(rpc), assignmentId);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_student_homework", { p_assignment_id: assignmentId });
    expect(result).toEqual({
      kind: "prompts",
      assignment: {
        assignmentId,
        className: "Matematyka 4A",
        title: "Powtórka",
        createdAt: "2026-10-09T10:00:00.000Z",
        exerciseCount: 2,
      },
      exercises: [
        { position: 1, prompt: "Ile to 1 + 1?" },
        { position: 2, prompt: "Ile to 2 + 2?" },
      ],
      submission: {
        submissionId: "00000000-0000-4000-8000-000000000003",
        submittedAt,
        correctCount: 1,
        assignedCount: 2,
        passed: true,
        answers: [
          { position: 1, answer: " 0001 ", isCorrect: true },
          { position: 2, answer: null, isCorrect: false },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/normalized_answer|canonical_answer|exercise_id|verifier|classmate/i);
  });

  it("loads a prompt-free historical result with only saved answers and correctness", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: resultOnlyDetailRow(), error: null });

    const result = await getStudentHomework(rpcClient(rpc), assignmentId);

    expect(result).toEqual({
      kind: "result-only",
      assignment: {
        assignmentId,
        className: "Matematyka 4A",
        title: "Powtórka",
        createdAt: "2026-10-09T10:00:00.000Z",
        exerciseCount: 2,
      },
      result: {
        submissionId: "00000000-0000-4000-8000-000000000003",
        submittedAt,
        correctCount: 1,
        assignedCount: 2,
        passed: true,
        answers: [
          { position: 1, answer: " 0001 ", isCorrect: true },
          { position: 2, answer: null, isCorrect: false },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/prompt|canonical_answer|normalized_answer|authority/i);
  });

  it("rejects malformed detail results and invalid IDs without disclosing SQL messages", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ...detailRow(), exercises: [...detailRow().exercises].reverse() },
      error: null,
    });
    await expect(getStudentHomework(rpcClient(rpc), assignmentId)).rejects.toMatchObject({
      code: "PERSISTENCE_FAILURE",
    });

    const unusedRpc = vi.fn();
    await expect(getStudentHomework(rpcClient(unusedRpc), "not-a-uuid")).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    });
    expect(unusedRpc).not.toHaveBeenCalled();
  });

  it("submits only ordered positional raw answers and maps the private RPC result", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: submissionRow(false), error: null });

    const result = await submitStudentHomework(rpcClient(rpc), assignmentId, request);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("submit_student_homework", {
      p_assignment_id: assignmentId,
      p_answers: request.answers,
    });
    expect(result).toEqual({
      submissionId: "00000000-0000-4000-8000-000000000003",
      submittedAt,
      correctCount: 1,
      assignedCount: 2,
      passed: true,
      answers: [
        { position: 1, answer: " 0001 ", isCorrect: true },
        { position: 2, answer: null, isCorrect: false },
      ],
      kind: "scored",
      replayed: false,
    });
    expect(JSON.stringify(result)).not.toMatch(/normalized_answer|canonical_answer|exercise_id|verifier|classmate/i);
  });

  it("returns the saved result for equivalent retries without trusting caller scores", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: submissionRow(false), error: null })
      .mockResolvedValueOnce({ data: submissionRow(true), error: null });
    const client = rpcClient(rpc);
    const first = await submitStudentHomework(client, assignmentId, request);
    const retry = await submitStudentHomework(client, assignmentId, request);

    expect(first.replayed).toBe(false);
    expect(retry.replayed).toBe(true);
    expect(retry.submissionId).toBe(first.submissionId);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("marks an equivalent replay of quarantined homework as result-only", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        kind: "result-only",
        submission_id: "00000000-0000-4000-8000-000000000003",
        submitted_at: submittedAt,
        correct_count: 1,
        assigned_count: 2,
        passed: true,
        answers: [
          { position: 1, answer: " 0001 ", is_correct: true },
          { position: 2, answer: null, is_correct: false },
        ],
        replayed: true,
      },
      error: null,
    });

    const result = await submitStudentHomework(rpcClient(rpc), assignmentId, request);

    expect(result).toMatchObject({
      kind: "result-only",
      replayed: true,
      submissionId: "00000000-0000-4000-8000-000000000003",
    });
    expect(JSON.stringify(result)).not.toContain("normalized_answer");
  });

  it("rejects invalid requests before making the submit RPC", async () => {
    const rpc = vi.fn();

    await expect(
      submitStudentHomework(rpcClient(rpc), assignmentId, { answers: [{ position: 1, answer: "four" }] }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(submitStudentHomework(rpcClient(rpc), "not-a-uuid", request)).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    { sqlCode: "22023", code: "INVALID_REQUEST" },
    { sqlCode: "42501", code: "FORBIDDEN" },
    { sqlCode: "P0002", code: "HOMEWORK_UNAVAILABLE" },
    { sqlCode: "P0003", code: "SUBMISSION_CONFLICT" },
    { sqlCode: "P0004", code: "SCORING_UNAVAILABLE" },
    { sqlCode: "P0005", code: "PERSISTENCE_FAILURE" },
    { sqlCode: "08006", code: "DATABASE_UNAVAILABLE" },
    { sqlCode: "XX000", code: "PERSISTENCE_FAILURE" },
  ])("maps database code $sqlCode without exposing database messages", async ({ sqlCode, code }) => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: sqlCode, message: "raw private SQL detail" },
    });

    let caught: unknown;
    try {
      await getStudentHomework(rpcClient(rpc), assignmentId);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(StudentHomeworkServiceError);
    expect(caught).toMatchObject({ code, message: code });
    expect(JSON.stringify(caught)).not.toContain("raw private SQL detail");
  });

  it("treats malformed Supabase envelopes and malformed submit RPC results as persistence failures", async () => {
    const malformedEnvelope = vi.fn().mockResolvedValue({ data: [], error: null, rawMessage: "private" });
    await expect(listStudentHomework(rpcClient(malformedEnvelope))).rejects.toMatchObject({
      code: "PERSISTENCE_FAILURE",
    });

    const malformedResult = vi.fn().mockResolvedValue({
      data: { ...submissionRow(false), canonical_answer: "private" },
      error: null,
    });
    await expect(submitStudentHomework(rpcClient(malformedResult), assignmentId, request)).rejects.toMatchObject({
      code: "PERSISTENCE_FAILURE",
    });
  });

  it("authorizes only accounts with their own student role", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { role: "student" }, error: null });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle,
    };
    const clientMock = { from: vi.fn(() => query) };
    const client = clientMock as never;

    await expect(authorizeStudent({ user: { id: "student-id" } }, client)).resolves.toEqual({
      status: "authorized-student",
    });
    expect(clientMock.from).toHaveBeenCalledWith("profile_roles");
    expect(query.select).toHaveBeenCalledWith("role");
    expect(query.eq).toHaveBeenNthCalledWith(1, "user_id", "student-id");
    expect(query.eq).toHaveBeenNthCalledWith(2, "role", "student");

    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(authorizeStudent({ user: { id: "teacher-id" } }, client)).resolves.toEqual({ status: "not-student" });
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "private" } });
    await expect(authorizeStudent({ user: { id: "unknown-id" } }, client)).resolves.toEqual({
      status: "profile-unavailable",
    });
  });
});
