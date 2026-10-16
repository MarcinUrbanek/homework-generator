import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  studentHomeworkDetailRpcSchema,
  studentHomeworkListSuccessSchema,
  studentHomeworkSubmitRequestSchema,
  studentHomeworkSubmitRpcResultSchema,
  studentHomeworkSummaryRpcRowSchema,
} from "./schemas";

const assignmentId = "00000000-0000-4000-8000-000000000001";
const submittedAt = "2026-10-09T12:00:00.000Z";
const answerFormatCases = readFileSync(
  new URL("../../../supabase/tests/database/homework-answer-format-cases.csv", import.meta.url),
  "utf8",
)
  .split(/\r?\n/)
  .slice(1)
  .filter((line) => line.length > 0)
  .map((line) => {
    const [name, answer, accepted] = line.split(",");
    return { name, answer, accepted: accepted === "true" };
  });

function validSummary() {
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
  };
}

function validPublicSummary() {
  return {
    assignmentId,
    className: "Matematyka 4A",
    title: null,
    createdAt: "2026-10-09T10:00:00.000Z",
    exerciseCount: 2,
    submitted: false,
    submittedAt: null,
    correctCount: null,
    passed: null,
  };
}

function validSubmission(replayed = false) {
  return {
    kind: "scored",
    submission_id: "00000000-0000-4000-8000-000000000002",
    submitted_at: submittedAt,
    correct_count: 1,
    assigned_count: 2,
    passed: true,
    answers: [
      { position: 1, answer: " 0001 ", normalized_answer: "1", is_correct: true },
      { position: 2, answer: null, normalized_answer: null, is_correct: false },
    ],
    ...(replayed ? { replayed: true } : {}),
  };
}

function validDetail() {
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
    submission: null,
  };
}

describe("student homework request schemas", () => {
  it.each(answerFormatCases)("$name matches the shared database answer-format fixture", ({ answer, accepted }) => {
    expect(
      studentHomeworkSubmitRequestSchema.safeParse({
        answers: [{ position: 1, answer }],
      }).success,
    ).toBe(accepted);
  });

  it("accepts positional numeric answers and preserves the exact raw text", () => {
    const request = {
      answers: [
        { position: 1, answer: " \t0001 \n" },
        { position: 2, answer: "1 234" },
        { position: 3, answer: null },
        { position: 4, answer: " \v " },
      ],
    };

    expect(studentHomeworkSubmitRequestSchema.parse(request)).toEqual(request);
  });

  it.each([
    { answers: [{ position: 1, answer: "four" }] },
    { answers: [{ position: 1, answer: "-1" }] },
    { answers: [{ position: 1, answer: "+1" }] },
    { answers: [{ position: 1, answer: "1.0" }] },
    { answers: [{ position: 1, answer: "1,5" }] },
    { answers: [{ position: 1, answer: "1/2" }] },
    { answers: [{ position: 1, answer: "12 34" }] },
    { answers: [{ position: 1, answer: "1 23 456" }] },
    { answers: [{ position: 1, answer: "\u00a0" }] },
    { answers: [{ position: 1, answer: "1".repeat(201) }] },
  ])("rejects unsupported, malformed, or oversized answers", (request) => {
    expect(studentHomeworkSubmitRequestSchema.safeParse(request).success).toBe(false);
  });

  it.each([
    { ...validRequest(), grade: 4 },
    { answers: [{ position: 1, answer: "1", isCorrect: true }] },
    { answers: [{ position: 1, answer: "1", canonicalAnswer: "1" }] },
    { answers: [{ position: 1, answer: "1", exerciseId: assignmentId }] },
    { answers: [{ position: 1, answer: "1", studentId: assignmentId }] },
    {
      answers: [
        { position: 1, answer: "1" },
        { position: 1, answer: "2" },
      ],
    },
    { answers: [] },
    { answers: [{ position: 0, answer: "1" }] },
    { answers: [{ position: 6, answer: "1" }] },
    { answers: [{ position: 1.5, answer: "1" }] },
  ])("rejects untrusted fields and invalid positional vectors", (request) => {
    expect(studentHomeworkSubmitRequestSchema.safeParse(request).success).toBe(false);
  });
});

describe("student homework RPC schemas", () => {
  it("accepts allowlisted list rows and rejects answer or identity fields", () => {
    expect(studentHomeworkSummaryRpcRowSchema.safeParse(validSummary()).success).toBe(true);
    expect(
      studentHomeworkSummaryRpcRowSchema.safeParse({
        ...validSummary(),
        canonical_answer: "private",
      }).success,
    ).toBe(false);
    expect(
      studentHomeworkSummaryRpcRowSchema.safeParse({
        ...validSummary(),
        student_email: "classmate@example.test",
      }).success,
    ).toBe(false);
  });

  it("requires consistent list submission fields and accepts all accessible rows", () => {
    expect(studentHomeworkListSuccessSchema.safeParse({ assignments: [validPublicSummary()] }).success).toBe(true);
    expect(
      studentHomeworkListSuccessSchema.safeParse({
        assignments: [
          validPublicSummary(),
          {
            ...validPublicSummary(),
            assignmentId: "00000000-0000-4000-8000-000000000003",
            submitted: true,
            submittedAt,
            correctCount: 1,
            passed: true,
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      studentHomeworkSummaryRpcRowSchema.safeParse({
        ...validSummary(),
        submitted: true,
      }).success,
    ).toBe(false);
    expect(
      studentHomeworkSummaryRpcRowSchema.safeParse({
        ...validSummary(),
        submitted: true,
        submitted_at: submittedAt,
        correct_count: 1,
        passed: false,
      }).success,
    ).toBe(false);
  });

  it("validates ordered detail items and forbids canonical, verifier, and classmate fields", () => {
    expect(studentHomeworkDetailRpcSchema.safeParse(validDetail()).success).toBe(true);
    expect(
      studentHomeworkDetailRpcSchema.safeParse({
        ...validDetail(),
        exercises: [...validDetail().exercises].reverse(),
      }).success,
    ).toBe(false);
    expect(
      studentHomeworkDetailRpcSchema.safeParse({
        ...validDetail(),
        exercises: [{ ...validDetail().exercises[0], exercise_id: assignmentId }],
      }).success,
    ).toBe(false);
  });

  it("validates persisted raw and normalized results while excluding normalized data from public DTOs", () => {
    expect(studentHomeworkSubmitRpcResultSchema.safeParse(validSubmission(true)).success).toBe(true);
    expect(
      studentHomeworkSubmitRpcResultSchema.safeParse({
        ...validSubmission(true),
        answers: [{ position: 1, answer: " 0001 ", normalized_answer: "2", is_correct: true }],
      }).success,
    ).toBe(false);
    expect(
      studentHomeworkSubmitRpcResultSchema.safeParse({
        ...validSubmission(true),
        answers: [
          { position: 1, answer: " 0001 ", normalized_answer: "1", is_correct: true },
          { position: 2, answer: null, normalized_answer: null, is_correct: true },
        ],
        correct_count: 2,
        passed: true,
      }).success,
    ).toBe(false);
    expect(
      studentHomeworkSubmitRpcResultSchema.safeParse({
        ...validSubmission(true),
        canonical_answer: "private",
      }).success,
    ).toBe(false);
  });
});

function validRequest() {
  return { answers: [{ position: 1, answer: "1" }] };
}
