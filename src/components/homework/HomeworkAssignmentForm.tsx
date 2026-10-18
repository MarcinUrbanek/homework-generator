import { useEffect, useRef, useState, type SubmitEvent } from "react";

import {
  HomeworkAssignmentView,
  type HomeworkAssignmentViewStatus,
} from "@/components/homework/HomeworkAssignmentView";
import {
  homeworkApiErrorSchema,
  homeworkAssignmentSuccessSchema,
  homeworkRosterSuccessSchema,
} from "@/lib/homework/schemas";
import type {
  ExerciseDifficulty,
  HomeworkApiErrorCode,
  HomeworkAssignmentRequest,
  HomeworkRosterMember,
  SupportedArithmeticTopicSlug,
} from "@/types";

interface HomeworkAssignmentFormProps {
  classId: string;
}

interface SubmissionAttempt {
  fingerprint: string;
  idempotencyKey: string;
}

interface CapacityDetails {
  requestedCount: number;
  recipientCount: number;
  requiredExerciseCount: number;
  availableExerciseCount: number;
}

function apiError(value: unknown) {
  const parsed = homeworkApiErrorSchema.safeParse(value);
  return parsed.success ? parsed.data.error : null;
}

function isAuthorizationError(code: HomeworkApiErrorCode | undefined): boolean {
  return code === "UNAUTHENTICATED" || code === "FORBIDDEN" || code === "CLASS_UNAVAILABLE";
}

function messageFor(errorCode: HomeworkApiErrorCode | undefined, message?: string): string {
  if (errorCode === "EMPTY_ELIGIBLE_ROSTER") {
    return "Skład klasy zmienił się od pobrania listy. Żaden uczeń nie otrzymał zadania. Odśwież stronę, aby pobrać aktualny skład.";
  }
  return message ?? "Nie udało się odczytać odpowiedzi serwera. Spróbuj ponownie.";
}

function HomeworkAssignmentFormForClass({ classId }: HomeworkAssignmentFormProps) {
  const [status, setStatus] = useState<HomeworkAssignmentViewStatus>("loading");
  const [members, setMembers] = useState<HomeworkRosterMember[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState<SupportedArithmeticTopicSlug>("addition-subtraction");
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty>("easy");
  const [exerciseCount, setExerciseCount] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failureCode, setFailureCode] = useState<HomeworkApiErrorCode | null>(null);
  const [capacity, setCapacity] = useState<CapacityDetails | null>(null);
  const [assignedCount, setAssignedCount] = useState(0);
  const [excludedCount, setExcludedCount] = useState(0);
  const [excludedEmails, setExcludedEmails] = useState<string[]>([]);
  const retryTarget = useRef<"roster" | "assignment">("roster");
  const submissionAttempt = useRef<SubmissionAttempt | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/members`, {
          signal: controller.signal,
        });
        const value = (await response.json()) as unknown;
        if (controller.signal.aborted) return;
        const roster = homeworkRosterSuccessSchema.safeParse(value);
        if (!response.ok || !roster.success) {
          const failure = apiError(value);
          setErrorMessage(messageFor(failure?.code, failure?.message ?? "Nie udało się pobrać listy uczniów."));
          setFailureCode(failure?.code ?? null);
          setStatus(isAuthorizationError(failure?.code) ? "authorization" : "retryable-failure");
          retryTarget.current = "roster";
          return;
        }

        setMembers(roster.data.members);
        setSelectedStudentIds(roster.data.members.map(({ studentId }) => studentId));
        setStatus(roster.data.members.length === 0 ? "empty" : "editing");
      } catch {
        if (controller.signal.aborted) return;
        setErrorMessage("Nie udało się połączyć z listą uczniów. Spróbuj ponownie.");
        setFailureCode(null);
        setStatus("retryable-failure");
        retryTarget.current = "roster";
      }
    })();

    return () => {
      controller.abort();
    };
  }, [classId]);

  function handleReview(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (selectedStudentIds.length === 0 || status !== "editing") return;
    setErrorMessage(null);
    setFailureCode(null);
    setCapacity(null);
    setStatus("review");
  }

  async function handleConfirm(): Promise<void> {
    if (submitting.current || selectedStudentIds.length === 0) return;
    submitting.current = true;
    retryTarget.current = "assignment";

    const normalizedTitle = title.trim().slice(0, 120);
    const requestWithoutKey: Omit<HomeworkAssignmentRequest, "idempotencyKey"> = {
      classId,
      studentIds: [...selectedStudentIds],
      ...(normalizedTitle ? { title: normalizedTitle } : {}),
      topic,
      difficulty,
      exerciseCount,
    };
    const fingerprint = JSON.stringify(requestWithoutKey);
    if (submissionAttempt.current?.fingerprint !== fingerprint) {
      submissionAttempt.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
    }
    const request: HomeworkAssignmentRequest = {
      ...requestWithoutKey,
      idempotencyKey: submissionAttempt.current.idempotencyKey,
    };

    setStatus("submitting");
    setErrorMessage(null);
    setFailureCode(null);
    setCapacity(null);

    try {
      const response = await fetch("/api/homework/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const value = (await response.json()) as unknown;
      const assignment = homeworkAssignmentSuccessSchema.safeParse(value);
      if (response.ok && assignment.success) {
        const excludedIds = new Set(assignment.data.excludedStudentIds);
        setAssignedCount(assignment.data.assignedCount);
        setExcludedCount(assignment.data.excludedCount);
        setExcludedEmails(members.filter(({ studentId }) => excludedIds.has(studentId)).map(({ email }) => email));
        setStatus(assignment.data.excludedCount > 0 ? "success-with-exclusions" : "success");
        submissionAttempt.current = null;
        return;
      }

      const failure = apiError(value);
      if (!response.ok && failure?.code === "INSUFFICIENT_POOL") {
        setErrorMessage(failure.message);
        setCapacity({
          requestedCount: exerciseCount,
          recipientCount: selectedStudentIds.length,
          requiredExerciseCount: failure.requiredExerciseCount ?? 0,
          availableExerciseCount: failure.availableExerciseCount ?? 0,
        });
        setFailureCode(failure.code);
        setStatus("insufficient-pool");
        return;
      }

      if (!response.ok && failure) {
        setErrorMessage(messageFor(failure.code, failure.message));
        setFailureCode(failure.code);
        setStatus(isAuthorizationError(failure.code) ? "authorization" : "retryable-failure");
        return;
      }

      setErrorMessage("Nie udało się odczytać odpowiedzi przydzielania. Spróbuj ponownie.");
      setFailureCode(null);
      setStatus("retryable-failure");
    } catch {
      setErrorMessage("Nie udało się połączyć z usługą przydzielania. Spróbuj ponownie.");
      setFailureCode(null);
      setStatus("retryable-failure");
    } finally {
      submitting.current = false;
    }
  }

  function handleStudentToggle(studentId: string, checked: boolean): void {
    submissionAttempt.current = null;
    setSelectedStudentIds((current) =>
      checked
        ? current.includes(studentId)
          ? current
          : [...current, studentId]
        : current.filter((id) => id !== studentId),
    );
  }

  function handleInputChange(update: () => void): void {
    submissionAttempt.current = null;
    setErrorMessage(null);
    setFailureCode(null);
    setCapacity(null);
    update();
  }

  function handleRetry(): void {
    if (retryTarget.current === "roster") {
      window.location.reload();
      return;
    }
    void handleConfirm();
  }

  function handleEdit(): void {
    setErrorMessage(null);
    setFailureCode(null);
    setCapacity(null);
    setStatus("editing");
  }

  return (
    <HomeworkAssignmentView
      status={status}
      members={members}
      selectedStudentIds={selectedStudentIds}
      title={title}
      topic={topic}
      difficulty={difficulty}
      exerciseCount={exerciseCount}
      errorMessage={errorMessage}
      failureCode={failureCode}
      capacity={capacity}
      assignedCount={assignedCount}
      excludedCount={excludedCount}
      excludedEmails={excludedEmails}
      refreshRosterHref={`/classes/${encodeURIComponent(classId)}/assign`}
      onStudentToggle={handleStudentToggle}
      onSelectAll={() => {
        submissionAttempt.current = null;
        setSelectedStudentIds(members.map(({ studentId }) => studentId));
      }}
      onClearSelection={() => {
        submissionAttempt.current = null;
        setSelectedStudentIds([]);
      }}
      onTitleChange={(value) => {
        handleInputChange(() => {
          setTitle(value.slice(0, 120));
        });
      }}
      onTopicChange={(value) => {
        handleInputChange(() => {
          setTopic(value);
        });
      }}
      onDifficultyChange={(value) => {
        handleInputChange(() => {
          setDifficulty(value);
        });
      }}
      onExerciseCountChange={(value) => {
        handleInputChange(() => {
          setExerciseCount(value);
        });
      }}
      onReview={handleReview}
      onConfirm={handleConfirm}
      onEdit={handleEdit}
      onRetry={handleRetry}
    />
  );
}

export default function HomeworkAssignmentForm({ classId }: HomeworkAssignmentFormProps) {
  return <HomeworkAssignmentFormForClass key={classId} classId={classId} />;
}
