import { useState } from "react";

import { ExerciseRequestView } from "@/components/exercises/ExerciseRequestView";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExerciseCandidate, ExerciseDifficulty, ExerciseGenerationSuccess, ExerciseTopicSlug } from "@/types";

const roles = ["teacher", "student"] as const;
const modes = ["light", "dark"] as const;
const states = ["default", "selected", "disabled", "loading", "error", "empty", "partial", "populated"] as const;

type GalleryRole = (typeof roles)[number];
type GalleryMode = (typeof modes)[number];
type GalleryState = (typeof states)[number];

const stateLabels: Record<GalleryState, string> = {
  default: "Default",
  selected: "Selected",
  disabled: "Disabled",
  loading: "Loading",
  error: "Error",
  empty: "Empty",
  partial: "Partial result",
  populated: "Populated result",
};

function candidate(
  id: string,
  text: string,
  proposedCanonicalAnswer: string,
  topic: ExerciseTopicSlug = "multiplication-division",
  difficulty: ExerciseDifficulty = "medium",
): ExerciseCandidate {
  return {
    id,
    grade: 4,
    topic,
    difficulty,
    text,
    proposedCanonicalAnswer,
    approvalStatus: "unverified",
  };
}

const populatedBatch: ExerciseGenerationSuccess = {
  requestedCount: 5,
  validCount: 5,
  candidates: [
    candidate("gallery-1", "Oblicz 36 · 7.", "252"),
    candidate("gallery-2", "Podziel 864 przez 8.", "108"),
    candidate("gallery-3", "W bibliotece ustawiono 9 półek po 24 książki. Ile książek ustawiono?", "216"),
    candidate("gallery-4", "Oblicz 125 · 6.", "750"),
    candidate("gallery-5", "Podziel 945 przez 9.", "105"),
  ],
};

const partialBatch: ExerciseGenerationSuccess = {
  requestedCount: 5,
  validCount: 2,
  partial_batch: true,
  candidates: populatedBatch.candidates.slice(0, 2),
};

export default function ExerciseRequestStateGallery() {
  const [role, setRole] = useState<GalleryRole>("teacher");
  const [mode, setMode] = useState<GalleryMode>("light");
  const [galleryState, setGalleryState] = useState<GalleryState>("default");
  const [topic, setTopic] = useState<ExerciseTopicSlug>("addition-subtraction");
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty>("easy");

  const isLoading = galleryState === "disabled" || galleryState === "loading";
  const errorMessage =
    galleryState === "error" ? "Generator chwilowo nie odpowiada. Spróbuj ponownie za kilka minut." : null;
  const restoredBatch =
    galleryState === "partial" ? partialBatch : galleryState === "populated" ? populatedBatch : null;

  function selectState(nextState: GalleryState) {
    setGalleryState(nextState);
    if (nextState === "selected") {
      setTopic("word-problems");
      setDifficulty("hard");
    } else if (nextState === "default" || nextState === "empty") {
      setTopic("addition-subtraction");
      setDifficulty("easy");
    }
  }

  return (
    <main className="bg-muted text-foreground min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header>
          <p className="text-muted-foreground text-sm font-semibold">Development fixture</p>
          <h1 className="mt-1 text-3xl font-bold">Exercise request state gallery</h1>
        </header>

        <section
          className="bg-card text-card-foreground mt-6 grid gap-5 rounded-lg border p-5"
          aria-label="Gallery controls"
        >
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Role</legend>
            <div className="flex flex-wrap gap-2">
              {roles.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={role === value ? "default" : "outline"}
                  aria-pressed={role === value}
                  onClick={() => {
                    setRole(value);
                  }}
                >
                  {value === "teacher" ? "Teacher" : "Student"}
                </Button>
              ))}
            </div>
          </fieldset>

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
                    selectState(value);
                  }}
                >
                  {stateLabels[value]}
                </Button>
              ))}
            </div>
          </fieldset>
        </section>

        <article
          data-role={role}
          data-gallery-role={role}
          data-gallery-mode={mode}
          data-gallery-state={galleryState}
          className={cn("bg-background text-foreground mt-8 rounded-lg p-4 sm:p-8", mode === "dark" && "dark")}
        >
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div>
                <p className="text-primary text-sm font-semibold">
                  {role === "teacher" ? "Teacher" : "Student"} · {mode === "light" ? "Light" : "Dark"}
                </p>
                <h2 className="mt-1 text-2xl font-bold">{stateLabels[galleryState]}</h2>
              </div>
              <div className="flex flex-wrap gap-2" aria-label="Interactive state capture controls">
                <Button type="button">Default control</Button>
                <Button type="button" disabled>
                  Disabled control
                </Button>
                <Button type="button" variant="outline" data-gallery-target="hover">
                  Hover target
                </Button>
                <Button type="button" variant="outline" data-gallery-target="focus">
                  Focus target
                </Button>
              </div>
            </div>

            <section className="bg-card text-card-foreground mt-6 rounded-lg border p-5 shadow-sm sm:p-8">
              <p className="text-primary text-sm font-semibold">Matematyka · klasa 4</p>
              <h3 className="mt-2 text-3xl font-bold">Wygeneruj propozycje zadań</h3>
              <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6 sm:text-base">
                Wybierz temat i poziom trudności. Otrzymane zadania oraz odpowiedzi są propozycjami i wymagają
                weryfikacji przed użyciem.
              </p>
              <ExerciseRequestView
                topic={topic}
                difficulty={difficulty}
                isLoading={isLoading}
                errorMessage={errorMessage}
                restoredBatch={restoredBatch}
                onTopicChange={(value) => {
                  setTopic(value);
                  setGalleryState("selected");
                }}
                onDifficultyChange={(value) => {
                  setDifficulty(value);
                  setGalleryState("selected");
                }}
                onSubmit={(event) => {
                  event.preventDefault();
                }}
                onClear={() => {
                  setGalleryState("empty");
                }}
              />
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}
