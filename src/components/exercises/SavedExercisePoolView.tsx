import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DIFFICULTY_LABELS, GRADE_4_EXERCISE_CATALOG } from "@/lib/exercises/catalog";
import type { ExerciseDifficulty, ExerciseTopicSlug, SavedExerciseFilters, SavedExerciseSummary } from "@/types";

export interface SavedExercisePoolViewProps {
  topic: ExerciseTopicSlug;
  difficulty: ExerciseDifficulty | "all";
  appliedFilters: SavedExerciseFilters | null;
  exercises: SavedExerciseSummary[];
  nextCursor: string | null;
  pending: "search" | "more" | null;
  errorMessage: string | null;
  onTopicChange: (topic: ExerciseTopicSlug) => void;
  onDifficultyChange: (difficulty: ExerciseDifficulty | "all") => void;
  onSubmit: React.SubmitEventHandler<HTMLFormElement>;
  onLoadMore: () => void;
  onRetry: () => void;
}

function approvalDate(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "long" }).format(new Date(value));
}

function filterSummary(filters: SavedExerciseFilters): string {
  const topic =
    GRADE_4_EXERCISE_CATALOG.find((catalogTopic) => catalogTopic.slug === filters.topic)?.label ?? filters.topic;
  const difficulty = filters.difficulty ? `, ${DIFFICULTY_LABELS[filters.difficulty]}` : ", wszystkie poziomy";
  return `Klasa ${filters.grade}: ${topic}${difficulty}`;
}

export function SavedExercisePoolView({
  topic,
  difficulty,
  appliedFilters,
  exercises,
  nextCursor,
  pending,
  errorMessage,
  onTopicChange,
  onDifficultyChange,
  onSubmit,
  onLoadMore,
  onRetry,
}: SavedExercisePoolViewProps) {
  const isBusy = pending !== null;

  return (
    <>
      <form onSubmit={onSubmit} className="mt-8" aria-busy={pending === "search"}>
        <FieldSet disabled={isBusy} className="disabled:opacity-70">
          <FieldGroup className="gap-4 sm:grid sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="saved-grade">Klasa</FieldLabel>
              <Select value="4" disabled>
                <SelectTrigger id="saved-grade" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">Klasa 4</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="saved-topic">Temat</FieldLabel>
              <Select
                value={topic}
                onValueChange={(value) => {
                  onTopicChange(value as ExerciseTopicSlug);
                }}
              >
                <SelectTrigger id="saved-topic" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_4_EXERCISE_CATALOG.map((catalogTopic) => (
                    <SelectItem key={catalogTopic.slug} value={catalogTopic.slug}>
                      {catalogTopic.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="saved-difficulty">Poziom trudności</FieldLabel>
              <Select
                value={difficulty}
                onValueChange={(value) => {
                  onDifficultyChange(value as ExerciseDifficulty | "all");
                }}
              >
                <SelectTrigger id="saved-difficulty" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie poziomy</SelectItem>
                  {(Object.entries(DIFFICULTY_LABELS) as [ExerciseDifficulty, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <Button type="submit" size="lg" disabled={isBusy} className="mt-5 min-h-11 w-full sm:w-auto">
            {pending === "search" && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            Pokaż zadania
          </Button>
        </FieldSet>
      </form>

      <div className="mt-5 grid min-h-6 gap-3" aria-live="polite" aria-atomic="true">
        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertDescription>
              <p>{errorMessage}</p>
              <Button type="button" variant="link" className="h-auto px-0 py-0" onClick={onRetry} disabled={isBusy}>
                Spróbuj ponownie
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {appliedFilters && (
        <section className="mt-6" aria-label="Wyniki zapisanych zadań">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">Wyświetlane filtry: {filterSummary(appliedFilters)}</p>
            <Badge variant="secondary">{exercises.length} zadań</Badge>
          </div>
          {exercises.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground py-8 text-sm">
                Nie znaleziono zatwierdzonych zadań dla wybranych filtrów.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {exercises.map((exercise) => (
                <Card key={exercise.id}>
                  <CardHeader className="gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{DIFFICULTY_LABELS[exercise.difficulty]}</Badge>
                      <Badge variant="secondary">
                        {GRADE_4_EXERCISE_CATALOG.find((catalogTopic) => catalogTopic.slug === exercise.topic)?.label ??
                          exercise.topic}
                      </Badge>
                    </div>
                    <CardTitle className="text-base leading-6">{exercise.text}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm">
                    <p>
                      <span className="font-semibold">Odpowiedź:</span> {exercise.canonicalAnswer}
                    </p>
                    <p className="text-muted-foreground">Zatwierdzono: {approvalDate(exercise.approvedAt)}</p>
                  </CardContent>
                </Card>
              ))}
              {nextCursor && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onLoadMore}
                  disabled={isBusy}
                  className="min-h-11 self-start"
                >
                  {pending === "more" ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw aria-hidden="true" />
                  )}
                  Wczytaj więcej
                </Button>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
