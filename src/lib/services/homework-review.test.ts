import { describe, expect, it, vi } from "vitest";

import {
  getTeacherHomeworkAssignment,
  getTeacherHomeworkSubmission,
  HomeworkReviewServiceError,
  listTeacherClassHomework,
  saveHomeworkSubmissionFeedback,
} from "./homework-review";

vi.mock("astro:env/server", () => ({
  SUPABASE_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_URL: undefined,
}));

const classId = "00000000-0000-4000-8000-000000000010";
const assignmentId = "00000000-0000-4000-8000-000000000001";
const studentId = "00000000-0000-4000-8000-000000000002";
const submittedAt = "2026-10-22T10:00:00.000Z";
const updatedAt = "2026-10-23T08:00:00.000Z";

function rpcClient(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as never;
}

function classRow(overrides: Record<string, unknown> = {}) {
  return {
    assignment_id: assignmentId,
    title: "Powtórka",
    grade: "4",
    topic: "addition-subtraction",
    difficulty: "easy",
    exercise_count: 2,
    created_at: "2026-10-20T10:00:00.000Z",
    recipient_count: 5,
    submitted_count: 4,
    passed_count: 3,
    feedback_count: 1,
    ...overrides,
  };
}

function assignmentRow() {
  return {
    assignment_id: assignmentId,
    class_id: classId,
    class_name: "Matematyka 4A",
    title: "Powtórka",
    grade: "4",
    topic: "addition-subtraction",
    difficulty: "easy",
    exercise_count: 2,
    created_at: "2026-10-20T10:00:00.000Z",
  };
}

function recipientRow(overrides: Record<string, unknown> = {}) {
  return {
    student_id: studentId,
    student_email: "uczen@example.test",
    is_member: true,
    submitted: true,
    submitted_at: submittedAt,
    correct_count: 1,
    passed: true,
    has_feedback: true,
    ...overrides,
  };
}

function submissionRow(overrides: Record<string, unknown> = {}) {
  return {
    assignment: assignmentRow(),
    student: { student_id: studentId, student_email: "uczen@example.test", is_member: true },
    submission: {
      submission_id: "00000000-0000-4000-8000-000000000003",
      submitted_at: submittedAt,
      correct_count: 1,
      assigned_count: 2,
      passed: true,
      answers: [
        { position: 1, prompt: "Ile to 0 + 1?", answer: "1", is_correct: true, expected_answer: "1" },
        { position: 2, prompt: "Ile to 1 + 1?", answer: "5", is_correct: false, expected_answer: "2" },
      ],
    },
    feedback: { body: "Dobra praca.\nPopraw zadanie 2.", updated_at: updatedAt },
    ...overrides,
  };
}

describe("homework review service", () => {
  it("lists class homework with counts and tolerates the SSR success key", async () => {
    const rpc = vi.fn().mockResolvedValue({ success: true, data: [classRow()], error: null });

    const result = await listTeacherClassHomework(rpcClient(rpc), classId);

    expect(rpc).toHaveBeenCalledWith("list_teacher_class_homework", { p_class_id: classId });
    expect(result).toEqual([
      {
        assignmentId,
        title: "Powtórka",
        grade: "4",
        topic: "addition-subtraction",
        difficulty: "easy",
        exerciseCount: 2,
        createdAt: "2026-10-20T10:00:00.000Z",
        recipientCount: 5,
        submittedCount: 4,
        passedCount: 3,
        feedbackCount: 1,
      },
    ]);
  });

  it("rejects inconsistent class counts as persistence failures", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [classRow({ feedback_count: 5 })], error: null });
    await expect(listTeacherClassHomework(rpcClient(rpc), classId)).rejects.toMatchObject({
      code: "PERSISTENCE_FAILURE",
    });
  });

  it("maps assignment recipients including departed and unsubmitted students", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        assignment: assignmentRow(),
        recipients: [
          recipientRow(),
          recipientRow({
            student_id: "00000000-0000-4000-8000-000000000004",
            student_email: "odszedl@example.test",
            is_member: false,
            has_feedback: false,
          }),
          recipientRow({
            student_id: "00000000-0000-4000-8000-000000000005",
            student_email: "brak@example.test",
            submitted: false,
            submitted_at: null,
            correct_count: null,
            passed: null,
            has_feedback: false,
          }),
        ],
      },
      error: null,
    });

    const result = await getTeacherHomeworkAssignment(rpcClient(rpc), assignmentId);

    expect(rpc).toHaveBeenCalledWith("get_teacher_homework_assignment", { p_assignment_id: assignmentId });
    expect(result.assignment).toEqual({
      assignmentId,
      classId,
      className: "Matematyka 4A",
      title: "Powtórka",
      grade: "4",
      topic: "addition-subtraction",
      difficulty: "easy",
      exerciseCount: 2,
      createdAt: "2026-10-20T10:00:00.000Z",
    });
    expect(result.recipients[0]).toEqual({
      studentId,
      email: "uczen@example.test",
      isMember: true,
      submitted: true,
      submittedAt,
      correctCount: 1,
      passed: true,
      hasFeedback: true,
    });
    expect(result.recipients[1]).toMatchObject({ isMember: false, submitted: true });
    expect(result.recipients[2]).toMatchObject({ submitted: false, hasFeedback: false, correctCount: null });
  });

  it("rejects recipient feedback flags without a submission", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        assignment: assignmentRow(),
        recipients: [
          recipientRow({ submitted: false, submitted_at: null, correct_count: null, passed: null, has_feedback: true }),
        ],
      },
      error: null,
    });
    await expect(getTeacherHomeworkAssignment(rpcClient(rpc), assignmentId)).rejects.toMatchObject({
      code: "PERSISTENCE_FAILURE",
    });
  });

  it("maps a submission review with expected answers and feedback", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: submissionRow(), error: null });

    const result = await getTeacherHomeworkSubmission(rpcClient(rpc), assignmentId, studentId);

    expect(rpc).toHaveBeenCalledWith("get_teacher_homework_submission", {
      p_assignment_id: assignmentId,
      p_student_id: studentId,
    });
    expect(result.student).toEqual({ studentId, email: "uczen@example.test", isMember: true });
    expect(result.submission?.answers).toEqual([
      { position: 1, prompt: "Ile to 0 + 1?", answer: "1", isCorrect: true, expectedAnswer: "1" },
      { position: 2, prompt: "Ile to 1 + 1?", answer: "5", isCorrect: false, expectedAnswer: "2" },
    ]);
    expect(result.feedback).toEqual({ body: "Dobra praca.\nPopraw zadanie 2.", updatedAt });
  });

  it("maps an unsubmitted review and rejects feedback without a submission", async () => {
    const unsubmitted = vi.fn().mockResolvedValue({
      data: submissionRow({ submission: null, feedback: null }),
      error: null,
    });
    await expect(getTeacherHomeworkSubmission(rpcClient(unsubmitted), assignmentId, studentId)).resolves.toMatchObject({
      submission: null,
      feedback: null,
    });

    const orphan = vi.fn().mockResolvedValue({ data: submissionRow({ submission: null }), error: null });
    await expect(getTeacherHomeworkSubmission(rpcClient(orphan), assignmentId, studentId)).rejects.toMatchObject({
      code: "PERSISTENCE_FAILURE",
    });
  });

  it("saves and clears feedback through the RPC", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: { feedback: { body: "Super", updated_at: updatedAt } },
        error: null,
      })
      .mockResolvedValueOnce({ data: { feedback: null }, error: null });

    await expect(saveHomeworkSubmissionFeedback(rpcClient(rpc), assignmentId, studentId, " Super ")).resolves.toEqual({
      feedback: { body: "Super", updatedAt },
    });
    expect(rpc).toHaveBeenCalledWith("save_homework_submission_feedback", {
      p_assignment_id: assignmentId,
      p_student_id: studentId,
      p_body: " Super ",
    });
    await expect(saveHomeworkSubmissionFeedback(rpcClient(rpc), assignmentId, studentId, "   ")).resolves.toEqual({
      feedback: null,
    });
  });

  it("validates IDs and feedback length before calling the RPC", async () => {
    const rpc = vi.fn();
    await expect(listTeacherClassHomework(rpcClient(rpc), "nope")).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(getTeacherHomeworkAssignment(rpcClient(rpc), "nope")).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    });
    await expect(getTeacherHomeworkSubmission(rpcClient(rpc), assignmentId, "nope")).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    });
    await expect(
      saveHomeworkSubmissionFeedback(rpcClient(rpc), assignmentId, studentId, "a".repeat(2001)),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(
      saveHomeworkSubmissionFeedback(rpcClient(rpc), assignmentId, studentId, `  ${"a".repeat(2000)}\n`),
    ).rejects.not.toMatchObject({ code: "INVALID_REQUEST" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    { sqlCode: "22023", code: "INVALID_REQUEST" },
    { sqlCode: "P0002", code: "HOMEWORK_UNAVAILABLE" },
    { sqlCode: "42501", code: "HOMEWORK_UNAVAILABLE" },
    { sqlCode: "P0003", code: "FEEDBACK_NOT_ALLOWED" },
    { sqlCode: "08006", code: "DATABASE_UNAVAILABLE" },
    { sqlCode: "PGRST001", code: "DATABASE_UNAVAILABLE" },
    { sqlCode: "XX000", code: "PERSISTENCE_FAILURE" },
  ])("maps database code $sqlCode to $code without leaking SQL", async ({ sqlCode, code }) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: sqlCode, message: "raw private SQL detail" } });

    let caught: unknown;
    try {
      await saveHomeworkSubmissionFeedback(rpcClient(rpc), assignmentId, studentId, "Komentarz");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(HomeworkReviewServiceError);
    expect(caught).toMatchObject({ code, message: code });
    expect(JSON.stringify(caught)).not.toContain("raw private SQL detail");
  });

  it("maps network errors and malformed envelopes or payloads", async () => {
    const network = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(listTeacherClassHomework(rpcClient(network), classId)).rejects.toMatchObject({
      code: "DATABASE_UNAVAILABLE",
    });

    const envelope = vi.fn().mockResolvedValue({ data: [], error: null, rawMessage: "private" });
    await expect(listTeacherClassHomework(rpcClient(envelope), classId)).rejects.toMatchObject({
      code: "PERSISTENCE_FAILURE",
    });

    const extraField = vi.fn().mockResolvedValue({
      data: { feedback: { body: "Super", updated_at: updatedAt, teacher_id: studentId } },
      error: null,
    });
    await expect(
      saveHomeworkSubmissionFeedback(rpcClient(extraField), assignmentId, studentId, "Super"),
    ).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
  });
});
