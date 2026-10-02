import { useRef, useState } from "react";

import { SavedExercisePoolView } from "@/components/exercises/SavedExercisePoolView";
import { savedExerciseErrorSchema, savedExerciseSuccessSchema } from "@/lib/exercises/schemas";
import type { ExerciseDifficulty, ExerciseTopicSlug, SavedExerciseFilters, SavedExerciseSummary } from "@/types";

interface RequestDescriptor {
  filters: SavedExerciseFilters;
  cursor: string | null;
}

function requestUrl({ filters, cursor }: RequestDescriptor): string {
  const parameters = new URLSearchParams({ grade: String(filters.grade), topic: filters.topic });
  if (filters.difficulty) parameters.set("difficulty", filters.difficulty);
  if (cursor) parameters.set("cursor", cursor);
  return `/api/exercises/saved?${parameters.toString()}`;
}

function failureMessage(value: unknown): string {
  const error = savedExerciseErrorSchema.safeParse(value);
  return error.success ? error.data.error.message : "Nie udało się odczytać odpowiedzi zapisanych zadań.";
}

export default function SavedExerciseBrowser() {
  const [topic, setTopic] = useState<ExerciseTopicSlug>("addition-subtraction");
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty | "all">("all");
  const [appliedFilters, setAppliedFilters] = useState<SavedExerciseFilters | null>(null);
  const [exercises, setExercises] = useState<SavedExerciseSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pending, setPending] = useState<"search" | "more" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeRequest = useRef(false);
  const latestRequest = useRef(0);
  const retryRequest = useRef<RequestDescriptor | null>(null);

  async function fetchExercises(descriptor: RequestDescriptor): Promise<void> {
    if (activeRequest.current) return;
    activeRequest.current = true;
    const requestId = ++latestRequest.current;
    const isLoadMore = descriptor.cursor !== null;
    setPending(isLoadMore ? "more" : "search");
    setErrorMessage(null);

    try {
      const response = await fetch(requestUrl(descriptor));
      const value = (await response.json()) as unknown;
      const success = savedExerciseSuccessSchema.safeParse(value);
      if (!response.ok || !success.success) {
        throw new Error(failureMessage(value));
      }
      if (requestId !== latestRequest.current) return;

      if (isLoadMore) {
        setExercises((current) => {
          const knownIds = new Set(current.map((exercise) => exercise.id));
          return [...current, ...success.data.exercises.filter((exercise) => !knownIds.has(exercise.id))];
        });
      } else {
        setExercises(success.data.exercises);
        setAppliedFilters(descriptor.filters);
      }
      setNextCursor(success.data.nextCursor);
      retryRequest.current = null;
    } catch (error) {
      if (requestId !== latestRequest.current) return;
      const message = error instanceof Error ? error.message : "Nie udało się pobrać zapisanych zadań.";
      setErrorMessage(`${message} Widoczne wyniki i filtry pozostały bez zmian.`);
      retryRequest.current = descriptor;
    } finally {
      if (requestId === latestRequest.current) {
        activeRequest.current = false;
        setPending(null);
      }
    }
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    void fetchExercises({
      filters: { grade: 4, topic, ...(difficulty === "all" ? {} : { difficulty }) },
      cursor: null,
    });
  }

  function handleLoadMore(): void {
    if (!appliedFilters || !nextCursor) return;
    void fetchExercises({ filters: appliedFilters, cursor: nextCursor });
  }

  return (
    <SavedExercisePoolView
      topic={topic}
      difficulty={difficulty}
      appliedFilters={appliedFilters}
      exercises={exercises}
      nextCursor={nextCursor}
      pending={pending}
      errorMessage={errorMessage}
      onTopicChange={setTopic}
      onDifficultyChange={setDifficulty}
      onSubmit={handleSubmit}
      onLoadMore={handleLoadMore}
      onRetry={() => retryRequest.current && void fetchExercises(retryRequest.current)}
    />
  );
}
