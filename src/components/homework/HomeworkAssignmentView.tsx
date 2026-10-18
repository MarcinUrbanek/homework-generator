import { AlertCircle, CheckCircle2, ClipboardCheck, LoaderCircle, RefreshCw, UsersRound } from "lucide-react";
import { useEffect, useRef, type SubmitEventHandler } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DIFFICULTY_LABELS,
  GRADE_4_EXERCISE_CATALOG,
  SUPPORTED_GRADE_4_ARITHMETIC_CATALOG,
} from "@/lib/exercises/catalog";
import { exerciseNoun } from "@/lib/exercises/exercise-count";
import type {
  ExerciseDifficulty,
  ExerciseTopicSlug,
  HomeworkApiErrorCode,
  HomeworkRosterMember,
  SupportedArithmeticTopicSlug,
} from "@/types";

export type HomeworkAssignmentViewStatus =
  | "loading"
  | "empty"
  | "editing"
  | "review"
  | "submitting"
  | "success"
  | "success-with-exclusions"
  | "insufficient-pool"
  | "authorization"
  | "retryable-failure";

interface CapacityDetails {
  requestedCount: number;
  recipientCount: number;
  requiredExerciseCount: number;
  availableExerciseCount: number;
}

interface HomeworkAssignmentViewProps {
  status: HomeworkAssignmentViewStatus;
  members: HomeworkRosterMember[];
  selectedStudentIds: string[];
  title: string;
  topic: SupportedArithmeticTopicSlug;
  difficulty: ExerciseDifficulty;
  exerciseCount: 1 | 2 | 3 | 4 | 5;
  errorMessage: string | null;
  failureCode: HomeworkApiErrorCode | null;
  capacity: CapacityDetails | null;
  assignedCount: number;
  excludedCount: number;
  excludedEmails: string[];
  refreshRosterHref: string;
  onStudentToggle: (studentId: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onTitleChange: (value: string) => void;
  onTopicChange: (value: SupportedArithmeticTopicSlug) => void;
  onDifficultyChange: (value: ExerciseDifficulty) => void;
  onExerciseCountChange: (value: 1 | 2 | 3 | 4 | 5) => void;
  onReview: SubmitEventHandler<HTMLFormElement>;
  onConfirm: () => void;
  onEdit: () => void;
  onRetry: () => void;
}

const RECIPIENT_COUNTS = [1, 2, 3, 4, 5] as const;

function topicLabel(topic: ExerciseTopicSlug): string {
  return GRADE_4_EXERCISE_CATALOG.find((item) => item.slug === topic)?.label ?? topic;
}

function selectedMembers(members: HomeworkRosterMember[], selectedIds: string[]): HomeworkRosterMember[] {
  const selected = new Set(selectedIds);
  return members.filter(({ studentId }) => selected.has(studentId));
}

function ReviewSummary({
  members,
  title,
  topic,
  difficulty,
  exerciseCount,
}: {
  members: HomeworkRosterMember[];
  title: string;
  topic: ExerciseTopicSlug;
  difficulty: ExerciseDifficulty;
  exerciseCount: number;
}) {
  return (
    <dl className="bg-muted/40 grid gap-3 rounded-md border p-4 text-sm sm:grid-cols-2">
      <div>
        <dt className="font-semibold">Tytuł</dt>
        <dd className="mt-1 break-words">{title.trim() || "Bez tytułu"}</dd>
      </div>
      <div>
        <dt className="font-semibold">Temat i poziom</dt>
        <dd className="mt-1 break-words">
          {topicLabel(topic)} · {DIFFICULTY_LABELS[difficulty]}
        </dd>
      </div>
      <div>
        <dt className="font-semibold">Liczba zadań na ucznia</dt>
        <dd className="mt-1">{exerciseCount}</dd>
      </div>
      <div>
        <dt className="font-semibold">Odbiorcy ({members.length})</dt>
        <dd className="mt-1 break-words">{members.map(({ email }) => email).join(", ")}</dd>
      </div>
    </dl>
  );
}

export function HomeworkAssignmentView({
  status,
  members,
  selectedStudentIds,
  title,
  topic,
  difficulty,
  exerciseCount,
  errorMessage,
  failureCode,
  capacity,
  assignedCount,
  excludedCount,
  excludedEmails,
  refreshRosterHref,
  onStudentToggle,
  onSelectAll,
  onClearSelection,
  onTitleChange,
  onTopicChange,
  onDifficultyChange,
  onExerciseCountChange,
  onReview,
  onConfirm,
  onEdit,
  onRetry,
}: HomeworkAssignmentViewProps) {
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const isEditing = status === "editing";
  const chosenMembers = selectedMembers(members, selectedStudentIds);
  const shouldFocusResult = [
    "success",
    "success-with-exclusions",
    "insufficient-pool",
    "authorization",
    "retryable-failure",
  ].includes(status);

  useEffect(() => {
    if (shouldFocusResult) resultHeading.current?.focus();
  }, [shouldFocusResult, status]);

  if (status === "loading") {
    return (
      <div
        className="text-muted-foreground mt-8 flex min-h-11 items-center gap-3 text-sm"
        role="status"
        aria-live="polite"
      >
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Pobieranie listy uczniów...
      </div>
    );
  }

  if (status === "empty") {
    return (
      <Alert className="mt-8">
        <UsersRound aria-hidden="true" />
        <AlertDescription>W tej klasie nie ma jeszcze uczniów, którym można przydzielić zadania.</AlertDescription>
      </Alert>
    );
  }

  if (status === "success" || status === "success-with-exclusions") {
    return (
      <section className="mt-8 grid gap-4" aria-labelledby="assignment-result-heading">
        <h2
          id="assignment-result-heading"
          ref={resultHeading}
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          Przydzielanie zakończone
        </h2>
        <Alert>
          <CheckCircle2 aria-hidden="true" />
          <AlertDescription>
            Przydzielono kompletne zestawy {assignedCount} {assignedCount === 1 ? "uczniowi" : "uczniom"}.
          </AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2" aria-label="Podsumowanie przydzielenia">
          <Badge variant="secondary">Przydzielono: {assignedCount}</Badge>
          <Badge variant={excludedCount > 0 ? "warning" : "outline"}>Wyłączono: {excludedCount}</Badge>
        </div>
        {excludedEmails.length > 0 && (
          <section className="grid gap-2" aria-labelledby="excluded-recipients-heading">
            <h3 id="excluded-recipients-heading" className="text-sm font-semibold">
              Uczniowie, którzy opuścili klasę
            </h3>
            <ul className="grid gap-2 text-sm">
              {excludedEmails.map((email) => (
                <li key={email} className="rounded-md border px-3 py-2 break-all">
                  {email}
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    );
  }

  if (status === "insufficient-pool" && capacity) {
    return (
      <section className="mt-8 grid gap-4" aria-labelledby="assignment-result-heading">
        <h2
          id="assignment-result-heading"
          ref={resultHeading}
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          Zbyt mała pula zatwierdzonych zadań
        </h2>
        <Alert variant="warning">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>
            <p>{errorMessage}</p>
            <p>
              Wybrano {capacity.requestedCount} {exerciseNoun(capacity.requestedCount)} dla {capacity.recipientCount}{" "}
              {capacity.recipientCount === 1 ? "ucznia" : "uczniów"}. Potrzeba co najmniej{" "}
              {capacity.requiredExerciseCount} różnych zatwierdzonych zadań; dostępne: {capacity.availableExerciseCount}
              .
            </p>
          </AlertDescription>
        </Alert>
        <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={onEdit}>
          Zmień parametry
        </Button>
      </section>
    );
  }

  if (status === "authorization") {
    return (
      <section className="mt-8 grid gap-4" aria-labelledby="assignment-result-heading">
        <h2
          id="assignment-result-heading"
          ref={resultHeading}
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          Brak dostępu do przydzielania
        </h2>
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        <a className="text-primary text-sm font-semibold underline-offset-4 hover:underline" href="/classes">
          Wróć do klas
        </a>
      </section>
    );
  }

  if (status === "retryable-failure") {
    return (
      <section className="mt-8 grid gap-4" aria-labelledby="assignment-result-heading">
        <h2
          id="assignment-result-heading"
          ref={resultHeading}
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          Nie udało się dokończyć przydzielania
        </h2>
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        {failureCode === "EMPTY_ELIGIBLE_ROSTER" ? (
          <a
            href={refreshRosterHref}
            className="text-primary inline-flex min-h-11 items-center text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Pobierz aktualny skład klasy
          </a>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" className="min-h-11" onClick={onRetry}>
              <RefreshCw aria-hidden="true" />
              Spróbuj ponownie
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={onEdit}>
              Zmień dane
            </Button>
          </div>
        )}
      </section>
    );
  }

  if (status === "submitting") {
    return (
      <section className="mt-8 grid gap-4" aria-busy="true">
        <h2 className="text-xl font-semibold">Zapisywanie przydzielenia...</h2>
        <div
          className="text-muted-foreground flex min-h-11 items-center gap-3 text-sm"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Sprawdzanie aktualnego składu i zapisywanie kompletnych zestawów.
        </div>
      </section>
    );
  }

  if (status === "review") {
    return (
      <section className="mt-8 grid gap-4" aria-labelledby="assignment-review-heading">
        <h2 id="assignment-review-heading" className="text-lg font-semibold">
          Sprawdź przydzielenie
        </h2>
        <ReviewSummary
          members={chosenMembers}
          title={title}
          topic={topic}
          difficulty={difficulty}
          exerciseCount={exerciseCount}
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" className="min-h-11" onClick={onEdit}>
            Wróć do edycji
          </Button>
          <Button type="button" className="min-h-11" onClick={onConfirm}>
            <ClipboardCheck aria-hidden="true" />
            Potwierdź przydzielenie
          </Button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={onReview} className="mt-8 grid gap-6" aria-busy={false}>
      <FieldSet disabled={!isEditing} className="grid gap-6 disabled:opacity-70">
        <fieldset className="grid gap-3" aria-describedby="recipient-selection-summary">
          <legend className="text-sm font-semibold">Odbiorcy</legend>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p id="recipient-selection-summary" className="text-muted-foreground text-sm" aria-live="polite">
              Wybrano: {selectedStudentIds.length} z {members.length}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={onSelectAll}>
                Zaznacz wszystkich
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={onClearSelection}>
                Wyczyść wybór
              </Button>
            </div>
          </div>
          <ul className="grid gap-2">
            {members.map((member, index) => (
              <li key={member.studentId}>
                <label
                  htmlFor={`homework-recipient-${index}`}
                  className="bg-background focus-within:ring-ring flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm focus-within:ring-2"
                >
                  <input
                    id={`homework-recipient-${index}`}
                    type="checkbox"
                    checked={selectedStudentIds.includes(member.studentId)}
                    onChange={(event) => {
                      onStudentToggle(member.studentId, event.currentTarget.checked);
                    }}
                    className="accent-primary size-4 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
                  />
                  <span className="break-all">{member.email}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <FieldGroup className="gap-4 sm:grid sm:grid-cols-2">
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="homework-title">Tytuł (opcjonalnie)</FieldLabel>
            <input
              id="homework-title"
              type="text"
              maxLength={120}
              value={title}
              onChange={(event) => {
                onTitleChange(event.currentTarget.value);
              }}
              className="bg-background text-foreground border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
              placeholder="Na przykład: Powtórka przed sprawdzianem"
            />
            <p className="text-muted-foreground text-xs">{title.length}/120 znaków</p>
          </Field>
          <Field>
            <FieldLabel htmlFor="homework-topic">Temat</FieldLabel>
            <Select
              value={topic}
              onValueChange={(value) => {
                onTopicChange(value as SupportedArithmeticTopicSlug);
              }}
              disabled={!isEditing}
            >
              <SelectTrigger id="homework-topic" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_GRADE_4_ARITHMETIC_CATALOG.map((item) => (
                  <SelectItem key={item.slug} value={item.slug}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="homework-difficulty">Poziom trudności</FieldLabel>
            <Select
              value={difficulty}
              onValueChange={(value) => {
                onDifficultyChange(value as ExerciseDifficulty);
              }}
              disabled={!isEditing}
            >
              <SelectTrigger id="homework-difficulty" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(DIFFICULTY_LABELS) as [ExerciseDifficulty, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="homework-exercise-count">Liczba zadań na ucznia</FieldLabel>
            <Select
              value={String(exerciseCount)}
              onValueChange={(value) => {
                if (RECIPIENT_COUNTS.some((count) => String(count) === value)) {
                  onExerciseCountChange(Number(value) as 1 | 2 | 3 | 4 | 5);
                }
              }}
              disabled={!isEditing}
            >
              <SelectTrigger id="homework-exercise-count" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECIPIENT_COUNTS.map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </FieldSet>

      <Button
        type="submit"
        disabled={selectedStudentIds.length === 0 || !isEditing}
        className="min-h-11 w-full sm:w-auto"
      >
        Sprawdź przydzielenie
      </Button>
    </form>
  );
}
