// @ts-nocheck
import { useState } from "react";

import { SavedExercisePoolView } from "@/components/exercises/SavedExercisePoolView";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExerciseDifficulty, ExerciseTopicSlug, SavedExerciseFilters, SavedExerciseSummary } from "@/types";

const modes = ["light", "dark"] as const;
const states = ["initial", "loading", "populated", "terminal", "empty", "search-error", "more-error"] as const;

type GalleryMode = (typeof modes)[number];
type GalleryState = (typeof states)[number];

const stateLabels: Record<GalleryState, string> = {
  initial: "Initial",
  loading: "Search loading",
  populated: "First page",
  terminal: "Terminal page",
  empty: "Empty",
  "search-error": "Search error",
  "more-error": "Load more error",
};

const filters: SavedExerciseFilters = { grade: 4, topic: "addition-subtraction" };

const exercises: SavedExerciseSummary[] = [
  {
    id: "gallery-saved-1",
    grade: 4,
    topic: "addition-subtraction",
    difficulty: "easy",
    text: "Oblicz 348 + 127.",
    canonicalAnswer: "475",
    approvedAt: "2026-10-02T10:00:00.000Z",
  },
  {
    id: "gallery-saved-2",
    grade: 4,
    topic: "addition-subtraction",
    difficulty: "medium",
    text: "Od 900 odejmij 468.",
    canonicalAnswer: "432",
    approvedAt: "2026-10-01T12:30:00.000Z",
  },
];

function fixture(
  state: GalleryState,
): Pick<
  React.ComponentProps<typeof SavedExercisePoolView>,
  "appliedFilters" | "exercises" | "nextCursor" | "pending" | "errorMessage"
> {
  if (state === "initial") {
    return { appliedFilters: null, exercises: [], nextCursor: null, pending: null, errorMessage: null };
  }

  if (state === "loading") {
    return { appliedFilters: null, exercises: [], nextCursor: null, pending: "search", errorMessage: null };
  }

  if (state === "empty") {
    return { appliedFilters: filters, exercises: [], nextCursor: null, pending: null, errorMessage: null };
  }

  if (state === "terminal") {
    return { appliedFilters: filters, exercises, nextCursor: null, pending: null, errorMessage: null };
  }

  if (state === "search-error") {
    return {
      appliedFilters: filters,
      exercises,
      nextCursor: "gallery-next-page",
      pending: null,
      errorMessage: "Nie udało się pobrać zapisanych zadań. Widoczne wyniki i filtry pozostały bez zmian.",
    };
  }

  if (state === "more-error") {
    return {
      appliedFilters: filters,
      exercises,
      nextCursor: "gallery-next-page",
      pending: null,
      errorMessage: "Nie udało się wczytać kolejnej strony. Widoczne wyniki i filtry pozostały bez zmian.",
    };
  }

  return { appliedFilters: filters, exercises, nextCursor: "gallery-next-page", pending: null, errorMessage: null };
}

export default function SavedExercisePoolStateGallery() {
  const [mode, setMode] = useState<GalleryMode>("light");
  const [galleryState, setGalleryState] = useState<GalleryState>("initial");
  const [topic, setTopic] = useState<ExerciseTopicSlug>("addition-subtraction");
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty | "all">("all");
  const view = fixture(galleryState);

  return (
    <main className="bg-muted text-foreground min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header>
          <p className="text-muted-foreground text-sm font-semibold">Development fixture</p>
          <h1 className="mt-1 text-3xl font-bold">Saved exercise pool state gallery</h1>
        </header>
        <section
          className="bg-card text-card-foreground mt-6 grid gap-5 rounded-lg border p-5"
          aria-label="Gallery controls"
        >
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Mode</legend>
            <div className="flex flex-wrap gap-2">
              {modes.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={mode === value ? "default" : "outline"}
                  aria-pressed={mode === value}
                  onClick={() => {
                    setMode(value);
                  }}
                >
                  {value === "light" ? "Light" : "Dark"}
                </Button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">State</legend>
            <div className="flex flex-wrap gap-2">
              {states.map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={galleryState === value ? "default" : "outline"}
                  aria-pressed={galleryState === value}
                  onClick={() => {
                    setGalleryState(value);
                  }}
                >
                  {stateLabels[value]}
                </Button>
              ))}
            </div>
          </fieldset>
        </section>

        <article
          data-role="teacher"
          data-gallery-mode={mode}
          data-gallery-state={galleryState}
          className={cn("bg-background text-foreground mt-8 rounded-lg p-4 sm:p-8", mode === "dark" && "dark")}
        >
          <div className="bg-card text-card-foreground mx-auto max-w-3xl rounded-lg border p-5 shadow-sm sm:p-8">
            <p className="text-primary text-sm font-semibold">Matematyka · klasa 4</p>
            <h2 className="mt-2 text-3xl font-bold">Zatwierdzone zadania</h2>
            <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6 sm:text-base">
              Przeglądaj zadania zatwierdzone do ponownego wykorzystania w pracy z uczniami.
            </p>
            <SavedExercisePoolView
              topic={topic}
              difficulty={difficulty}
              {...view}
              onTopicChange={setTopic}
              onDifficultyChange={setDifficulty}
              onSubmit={(event) => {
                event.preventDefault();
              }}
              onLoadMore={() => undefined}
              onRetry={() => undefined}
            />
          </div>
        </article>
      </div>
    </main>
  );
}
