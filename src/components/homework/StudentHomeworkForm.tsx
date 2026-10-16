import { useCallback, useEffect, useRef, useState, type SubmitEvent } from "react";

import StudentHomeworkView, { type StudentHomeworkViewStatus } from "@/components/homework/StudentHomeworkView";
import { normalizeStudentHomeworkAnswer } from "@/lib/exercises/answer-normalization";
import {
  studentHomeworkApiErrorSchema,
  studentHomeworkDetailSuccessSchema,
  studentHomeworkSubmitSuccessSchema,
} from "@/lib/homework/schemas";
import type {
  StudentHomeworkApiErrorCode,
  StudentHomeworkDetailSuccess,
  StudentHomeworkExercise,
  StudentHomeworkPromptDetailSuccess,
  StudentHomeworkResultOnlyDetailSuccess,
  StudentHomeworkSubmissionResult,
  StudentHomeworkSubmitRequest,
} from "@/types";

interface StudentHomeworkFormProps {
  detail: StudentHomeworkDetailSuccess;
}

function emptyAnswers(exercises: StudentHomeworkExercise[]): Record<number, string> {
  return Object.fromEntries(exercises.map(({ position }) => [position, ""]));
}

function answersFromSubmission(
  exercises: StudentHomeworkExercise[],
  submission: StudentHomeworkSubmissionResult | null,
): Record<number, string> {
  const answers = emptyAnswers(exercises);
  for (const answer of submission?.answers ?? []) {
    answers[answer.position] = answer.answer ?? "";
  }
  return answers;
}

function resultFromSubmit(
  value: ReturnType<typeof studentHomeworkSubmitSuccessSchema.parse>,
): StudentHomeworkSubmissionResult {
  return {
    submissionId: value.submissionId,
    submittedAt: value.submittedAt,
    correctCount: value.correctCount,
    assignedCount: value.assignedCount,
    passed: value.passed,
    answers: value.answers,
  };
}

function accessDeniedCode(value: unknown): boolean {
  const parsed = studentHomeworkApiErrorSchema.safeParse(value);
  return parsed.success && ["UNAUTHENTICATED", "FORBIDDEN", "HOMEWORK_UNAVAILABLE"].includes(parsed.data.error.code);
}

function isRequestAborted(controller: AbortController): boolean {
  return controller.signal.aborted;
}

function messageForErrorCode(code: StudentHomeworkApiErrorCode | undefined): string {
  switch (code) {
    case "INVALID_REQUEST":
      return "Nie udało się sprawdzić odpowiedzi. Sprawdź je i spróbuj ponownie.";
    case "SUBMISSION_CONFLICT":
      return "Zadanie zostało już wysłane. Pobieramy zapisany wynik.";
    case "SCORING_UNAVAILABLE":
      return "Sprawdzanie odpowiedzi jest chwilowo niedostępne. Możesz bezpiecznie ponowić próbę.";
    case "DATABASE_UNAVAILABLE":
      return "Usługa jest chwilowo niedostępna. Możesz bezpiecznie ponowić próbę.";
    case "PERSISTENCE_FAILURE":
      return "Nie udało się potwierdzić zapisu. Możesz bezpiecznie ponowić próbę.";
    default:
      return "Nie udało się potwierdzić wysłania. Możesz bezpiecznie ponowić próbę.";
  }
}

export default function StudentHomeworkForm({ detail }: StudentHomeworkFormProps) {
  if (detail.kind === "result-only") {
    return <StudentHomeworkView mode="result-only" assignment={detail.assignment} result={detail.result} />;
  }

  return <StudentHomeworkPromptForm detail={detail} />;
}

function StudentHomeworkPromptForm({ detail }: { detail: StudentHomeworkPromptDetailSuccess }) {
  const { assignment, exercises, submission } = detail;
  const [answers, setAnswers] = useState(() => answersFromSubmission(exercises, submission));
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<StudentHomeworkViewStatus>(submission ? "result" : "editing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState(submission);
  const [historicalResult, setHistoricalResult] = useState<StudentHomeworkResultOnlyDetailSuccess | null>(null);
  const pendingAnswers = useRef<StudentHomeworkSubmitRequest | null>(null);
  const recoveringConflict = useRef(false);
  const activeController = useRef<AbortController | null>(null);
  const submitting = useRef(false);

  const markUnavailable = useCallback(() => {
    pendingAnswers.current = null;
    recoveringConflict.current = false;
    setAnswers(emptyAnswers(exercises));
    setValidationErrors({});
    setErrorMessage(null);
    setResult(null);
    setHistoricalResult(null);
    setStatus("unavailable");
  }, [exercises]);

  async function readPersistedResult(controller: AbortController): Promise<void> {
    const response = await fetch(`/api/homework/${encodeURIComponent(assignment.assignmentId)}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    const value: unknown = await response.json();
    if (controller.signal.aborted) return;
    if (!response.ok) {
      if (accessDeniedCode(value)) {
        markUnavailable();
        return;
      }
      setErrorMessage("Nie udało się pobrać zapisanego wyniku. Spróbuj ponownie.");
      setStatus("recovery-failure");
      return;
    }

    const detail = studentHomeworkDetailSuccessSchema.safeParse(value);
    if (!detail.success) {
      setErrorMessage("Nie udało się potwierdzić zapisanego wyniku. Spróbuj ponownie.");
      setStatus("recovery-failure");
      return;
    }

    if (detail.data.kind === "result-only") {
      setHistoricalResult(detail.data);
      setResult(detail.data.result);
      setAnswers(answersFromSubmission(exercises, detail.data.result));
    } else if (detail.data.submission) {
      setHistoricalResult(null);
      setResult(detail.data.submission);
      setAnswers(answersFromSubmission(exercises, detail.data.submission));
    } else {
      setErrorMessage("Nie udało się potwierdzić zapisanego wyniku. Spróbuj ponownie.");
      setStatus("recovery-failure");
      return;
    }
    setValidationErrors({});
    setErrorMessage(null);
    setStatus("result");
    pendingAnswers.current = null;
    recoveringConflict.current = false;
  }

  useEffect(() => {
    if (!submission) return;
    const controller = new AbortController();
    activeController.current = controller;

    void (async () => {
      try {
        const response = await fetch(`/api/homework/${encodeURIComponent(assignment.assignmentId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const value: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok && accessDeniedCode(value)) {
          markUnavailable();
          return;
        }
        if (response.ok) {
          const detail = studentHomeworkDetailSuccessSchema.safeParse(value);
          if (detail.success && detail.data.kind === "result-only") {
            setHistoricalResult(detail.data);
            setResult(detail.data.result);
            setAnswers(answersFromSubmission(exercises, detail.data.result));
          } else if (detail.success && detail.data.kind === "prompts" && detail.data.submission) {
            setHistoricalResult(null);
            setResult(detail.data.submission);
            setAnswers(answersFromSubmission(exercises, detail.data.submission));
          }
        }
      } catch {
        return;
      }
    })();

    return () => {
      controller.abort();
      if (activeController.current === controller) activeController.current = null;
    };
  }, [assignment.assignmentId, exercises, markUnavailable, submission]);

  useEffect(
    () => () => {
      activeController.current?.abort();
    },
    [],
  );

  function handleAnswerChange(position: number, answer: string): void {
    setAnswers((current) => ({ ...current, [position]: answer }));
    setValidationErrors((current) => {
      if (!current[position]) return current;
      const next = { ...current };
      Reflect.deleteProperty(next, position);
      return next;
    });
  }

  function handleReview(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (status !== "editing") return;

    const nextErrors: Record<number, string> = {};
    for (const exercise of exercises) {
      const answer = answers[exercise.position] ?? "";
      if (answer.length > 200 || normalizeStudentHomeworkAnswer(answer) === undefined) {
        nextErrors[exercise.position] = "Wpisz liczbę naturalną cyframi lub pozostaw pole puste.";
      }
    }
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setErrorMessage(null);
    setStatus("review");
  }

  async function submitAnswers(request: StudentHomeworkSubmitRequest): Promise<void> {
    if (submitting.current) return;
    submitting.current = true;
    pendingAnswers.current = request;
    recoveringConflict.current = false;
    setErrorMessage(null);
    setStatus("submitting");

    const controller = new AbortController();
    activeController.current = controller;
    try {
      const response = await fetch(`/api/homework/${encodeURIComponent(assignment.assignmentId)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const value: unknown = await response.json();
      if (controller.signal.aborted) return;

      if (response.ok) {
        const parsed = studentHomeworkSubmitSuccessSchema.safeParse(value);
        if (parsed.success) {
          const submittedResult = resultFromSubmit(parsed.data);
          setResult(submittedResult);
          if (parsed.data.kind === "result-only") {
            setHistoricalResult({ kind: "result-only", assignment, result: submittedResult });
          } else {
            setHistoricalResult(null);
          }
          setStatus("result");
          setErrorMessage(null);
          pendingAnswers.current = null;
          return;
        }
        setErrorMessage("Nie udało się odczytać potwierdzenia. Możesz ponowić próbę z tymi samymi odpowiedziami.");
        setStatus("retryable-failure");
        return;
      }

      if (accessDeniedCode(value)) {
        markUnavailable();
        return;
      }

      const parsedError = studentHomeworkApiErrorSchema.safeParse(value);
      const code = parsedError.success ? parsedError.data.error.code : undefined;
      if (code === "SUBMISSION_CONFLICT") {
        recoveringConflict.current = true;
        setStatus("recovering-result");
        try {
          await readPersistedResult(controller);
        } catch {
          if (!isRequestAborted(controller)) {
            setErrorMessage("Nie udało się pobrać zapisanego wyniku. Spróbuj ponownie.");
            setStatus("recovery-failure");
          }
        }
        return;
      }

      setErrorMessage(messageForErrorCode(code));
      setStatus("retryable-failure");
    } catch {
      if (controller.signal.aborted) return;
      setErrorMessage("Nie udało się połączyć z usługą. Możesz ponowić próbę z tymi samymi odpowiedziami.");
      setStatus("retryable-failure");
    } finally {
      if (activeController.current === controller) activeController.current = null;
      submitting.current = false;
    }
  }

  async function retryResultRead(): Promise<void> {
    if (submitting.current) return;
    submitting.current = true;
    setStatus("recovering-result");
    setErrorMessage(null);
    const controller = new AbortController();
    activeController.current = controller;

    try {
      await readPersistedResult(controller);
    } catch {
      if (controller.signal.aborted) return;
      setErrorMessage("Nie udało się pobrać zapisanego wyniku. Spróbuj ponownie.");
      setStatus("recovery-failure");
    } finally {
      if (activeController.current === controller) activeController.current = null;
      submitting.current = false;
    }
  }

  function handleConfirm(): void {
    if (status !== "review" || submitting.current) return;
    const request: StudentHomeworkSubmitRequest = {
      answers: [...exercises]
        .sort((left, right) => left.position - right.position)
        .map(({ position }) => {
          const answer = answers[position] ?? "";
          return {
            position,
            answer: normalizeStudentHomeworkAnswer(answer) === null ? null : answer,
          };
        }),
    };
    void submitAnswers(request);
  }

  function handleRetry(): void {
    if (recoveringConflict.current) {
      void retryResultRead();
      return;
    }
    if (pendingAnswers.current) void submitAnswers(pendingAnswers.current);
  }

  function handleBack(): void {
    if (status !== "review") return;
    setStatus("editing");
  }

  const unansweredCount = exercises.filter(
    ({ position }) => normalizeStudentHomeworkAnswer(answers[position] ?? "") === null,
  ).length;

  if (historicalResult) {
    return (
      <StudentHomeworkView
        mode="result-only"
        assignment={historicalResult.assignment}
        result={historicalResult.result}
      />
    );
  }

  return (
    <StudentHomeworkView
      mode="prompts"
      assignment={assignment}
      exercises={exercises}
      answers={answers}
      validationErrors={validationErrors}
      unansweredCount={unansweredCount}
      status={status}
      errorMessage={errorMessage}
      result={result}
      onAnswerChange={handleAnswerChange}
      onReview={handleReview}
      onConfirm={handleConfirm}
      onBack={handleBack}
      onRetry={handleRetry}
    />
  );
}
