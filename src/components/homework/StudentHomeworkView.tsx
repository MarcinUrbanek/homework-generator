import { AlertCircle, CheckCircle2, ClipboardCheck, LoaderCircle, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useRef, type SubmitEventHandler } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { normalizeStudentHomeworkAnswer } from "@/lib/exercises/answer-normalization";
import { cn } from "@/lib/utils";
import type {
  StudentHomeworkAnswerResult,
  StudentHomeworkDetailAssignment,
  StudentHomeworkExercise,
  StudentHomeworkSubmissionResult,
} from "@/types";

export type StudentHomeworkViewStatus =
  | "editing"
  | "review"
  | "submitting"
  | "retryable-failure"
  | "recovering-result"
  | "recovery-failure"
  | "result"
  | "unavailable";

interface StudentHomeworkViewProps {
  assignment: StudentHomeworkDetailAssignment;
  exercises: StudentHomeworkExercise[];
  answers: Record<number, string>;
  validationErrors: Record<number, string>;
  unansweredCount: number;
  status: StudentHomeworkViewStatus;
  errorMessage: string | null;
  result: StudentHomeworkSubmissionResult | null;
  onAnswerChange: (position: number, answer: string) => void;
  onReview: SubmitEventHandler<HTMLFormElement>;
  onConfirm: () => void;
  onBack: () => void;
  onRetry: () => void;
}

function displayAnswer(answer: StudentHomeworkAnswerResult["answer"]): string {
  return answer === null || answer.trim() === "" ? "Bez odpowiedzi" : answer;
}

export default function StudentHomeworkView({
  assignment,
  exercises,
  answers,
  validationErrors,
  unansweredCount,
  status,
  errorMessage,
  result,
  onAnswerChange,
  onReview,
  onConfirm,
  onBack,
  onRetry,
}: StudentHomeworkViewProps) {
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const messageHeading = useRef<HTMLHeadingElement>(null);
  const errorHeading = useRef<HTMLHeadingElement>(null);
  const hasValidationErrors = Object.keys(validationErrors).length > 0;
  const showAnswers = ["editing", "submitting", "retryable-failure", "recovery-failure"].includes(status);
  const canEdit = status === "editing";

  useEffect(() => {
    if (status === "review") reviewHeading.current?.focus();
    else if (status === "result") resultHeading.current?.focus();
    else if (status === "unavailable" || status === "retryable-failure" || status === "recovery-failure") {
      messageHeading.current?.focus();
    } else if (hasValidationErrors) errorHeading.current?.focus();
  }, [hasValidationErrors, status]);

  if (status === "unavailable") {
    return (
      <section className="grid gap-4" role="alert" aria-labelledby="student-homework-unavailable-heading">
        <h2
          id="student-homework-unavailable-heading"
          ref={messageHeading}
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          Zadanie domowe jest niedostępne
        </h2>
        <p className="text-muted-foreground leading-7">
          Nie można już wyświetlić tego zadania ani jego wyniku. Wróć do listy zadań domowych.
        </p>
        <a
          className="text-primary inline-flex min-h-11 w-fit items-center font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          href="/homework"
        >
          Wróć do listy zadań
        </a>
      </section>
    );
  }

  if (status === "result" && result) {
    const answersByPosition = new Map(result.answers.map((answer) => [answer.position, answer]));

    return (
      <section className="grid gap-5" aria-labelledby="student-homework-result-heading">
        <h2
          id="student-homework-result-heading"
          ref={resultHeading}
          tabIndex={-1}
          className="text-2xl font-bold outline-none"
        >
          Wynik zadania domowego
        </h2>
        <Alert variant={result.passed ? "default" : "warning"}>
          {result.passed ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
          <AlertDescription>
            <p className="font-semibold">{result.passed ? "Zaliczone" : "Nie zaliczone"}</p>
            <p>
              Poprawne odpowiedzi: {result.correctCount} z {result.assignedCount}. Próg zaliczenia wynosi co najmniej
              połowę przydzielonych zadań.
            </p>
            <p>
              Wysłano:{" "}
              <time dateTime={result.submittedAt}>
                {new Intl.DateTimeFormat("pl-PL", {
                  dateStyle: "long",
                  timeStyle: "short",
                  timeZone: "Europe/Warsaw",
                }).format(new Date(result.submittedAt))}
              </time>
            </p>
          </AlertDescription>
        </Alert>
        <ol className="grid gap-3">
          {exercises.map((exercise) => {
            const submittedAnswer = answersByPosition.get(exercise.position);
            const isCorrect = submittedAnswer?.isCorrect ?? false;
            const isBlank = normalizeStudentHomeworkAnswer(submittedAnswer?.answer ?? null) === null;
            const answer = displayAnswer(submittedAnswer?.answer ?? null);

            return (
              <li
                key={exercise.position}
                className={cn(
                  "rounded-lg border p-4 sm:p-5",
                  isCorrect ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5",
                )}
              >
                <h3 className="font-semibold">
                  Zadanie {exercise.position}: {exercise.prompt}
                </h3>
                <p className="mt-3 text-sm">
                  Twoja odpowiedź: <span className="font-medium">{answer}</span>
                </p>
                <p className={cn("mt-1 text-sm font-semibold", isCorrect ? "text-success" : "text-warning")}>
                  {isCorrect ? "Poprawna" : isBlank ? "Brak odpowiedzi — niepoprawna" : "Niepoprawna"}
                </p>
              </li>
            );
          })}
        </ol>
        <a
          className="hover:bg-accent inline-flex min-h-11 w-fit items-center justify-center rounded-md border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          href="/homework"
        >
          Wróć do listy zadań
        </a>
      </section>
    );
  }

  if (status === "review") {
    return (
      <section className="grid gap-5" aria-labelledby="student-homework-review-heading">
        <h2
          id="student-homework-review-heading"
          ref={reviewHeading}
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          Sprawdź odpowiedzi
        </h2>
        <p className="text-sm leading-6">
          Bez odpowiedzi:{" "}
          <strong>
            {unansweredCount} z {assignment.exerciseCount}
          </strong>
          . Puste odpowiedzi zostaną uznane za niepoprawne.
        </p>
        <ol className="grid gap-3">
          {exercises.map((exercise) => (
            <li key={exercise.position} className="rounded-md border p-4">
              <h3 className="font-medium">
                Zadanie {exercise.position}: {exercise.prompt}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm break-all">
                Twoja odpowiedź: {answers[exercise.position].trim() ? answers[exercise.position] : "Bez odpowiedzi"}
              </p>
            </li>
          ))}
        </ol>
        <Alert variant="warning">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>
            Po wysłaniu nie można zmienić odpowiedzi. Wynik i każda odpowiedź zostaną zapisane jako ostateczne.
          </AlertDescription>
        </Alert>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" className="min-h-11" onClick={onBack}>
            Wróć do odpowiedzi
          </Button>
          <Button type="button" className="min-h-11" onClick={onConfirm}>
            <ClipboardCheck aria-hidden="true" />
            Wyślij ostateczne odpowiedzi
          </Button>
        </div>
      </section>
    );
  }

  if (status === "recovering-result") {
    return (
      <div className="text-muted-foreground flex min-h-11 items-center gap-3 text-sm" role="status" aria-live="polite">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Odczytywanie zapisanego wyniku...
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {status === "submitting" && (
        <div
          className="text-muted-foreground flex min-h-11 items-center gap-3 text-sm"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Zapisywanie ostatecznych odpowiedzi...
        </div>
      )}
      {status === "retryable-failure" && (
        <section className="grid gap-4" role="alert" aria-labelledby="student-homework-error-heading">
          <h2
            id="student-homework-error-heading"
            ref={messageHeading}
            tabIndex={-1}
            className="text-lg font-semibold outline-none"
          >
            Nie udało się potwierdzić wysłania
          </h2>
          <p className="text-sm leading-6">{errorMessage}</p>
          <p className="text-muted-foreground text-sm leading-6">
            Możesz ponowić próbę z dokładnie tymi samymi odpowiedziami.
          </p>
          <Button type="button" className="min-h-11 w-full sm:w-fit" onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            Spróbuj ponownie
          </Button>
        </section>
      )}
      {status === "recovery-failure" && (
        <section className="grid gap-4" role="alert" aria-labelledby="student-homework-recovery-heading">
          <h2
            id="student-homework-recovery-heading"
            ref={messageHeading}
            tabIndex={-1}
            className="text-lg font-semibold outline-none"
          >
            Nie udało się pobrać zapisanego wyniku
          </h2>
          <p className="text-sm leading-6">{errorMessage}</p>
          <p className="text-muted-foreground text-sm leading-6">
            Twoje odpowiedzi nie są uznane za wysłane, dopóki nie zostanie odczytany wynik.
          </p>
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-fit" onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            Pobierz zapisany wynik
          </Button>
        </section>
      )}

      {showAnswers && (
        <form onSubmit={onReview} className="grid gap-6" aria-busy={status === "submitting"}>
          <FieldGroup className="gap-5">
            {exercises.map((exercise) => {
              const error = validationErrors[exercise.position];
              const inputId = `homework-answer-${exercise.position}`;
              const errorId = `${inputId}-error`;
              const hintId = `${inputId}-hint`;

              return (
                <Field key={exercise.position} data-invalid={Boolean(error)} className="gap-2">
                  <FieldLabel htmlFor={inputId}>
                    Odpowiedź do zadania {exercise.position}: {exercise.prompt}
                  </FieldLabel>
                  <input
                    id={inputId}
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    maxLength={200}
                    value={answers[exercise.position] ?? ""}
                    readOnly={!canEdit}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : hintId}
                    onChange={(event) => {
                      onAnswerChange(exercise.position, event.currentTarget.value);
                    }}
                    className={cn(
                      "bg-background text-foreground border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]",
                      error && "border-destructive focus-visible:ring-destructive/30",
                    )}
                  />
                  {error ? (
                    <p id={errorId} className="text-destructive text-sm">
                      {error}
                    </p>
                  ) : (
                    <p id={hintId} className="text-muted-foreground text-xs">
                      Wpisz liczbę naturalną lub pozostaw puste. Tysiące można rozdzielić spacją.
                    </p>
                  )}
                </Field>
              );
            })}
          </FieldGroup>

          {hasValidationErrors && (
            <section className="border-destructive/30 bg-destructive/5 rounded-md border p-4" role="alert">
              <h2 ref={errorHeading} tabIndex={-1} className="text-destructive font-semibold outline-none">
                Popraw zaznaczone odpowiedzi
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Dozwolone są wyłącznie liczby naturalne zapisane cyframi lub puste pola.
              </p>
            </section>
          )}

          {canEdit && (
            <Button type="submit" className="min-h-11 w-full sm:w-fit">
              Sprawdź odpowiedzi
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
