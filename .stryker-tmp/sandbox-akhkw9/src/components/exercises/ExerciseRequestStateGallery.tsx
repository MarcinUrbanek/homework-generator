// @ts-nocheck
import { useState } from "react";

import { ExerciseRequestView } from "@/components/exercises/ExerciseRequestView";
import {
  applyExerciseVerificationResults,
  createExerciseReviewBatch,
  selectExerciseVerification,
  type ExerciseReviewBatch,
} from "@/components/hooks/use-session-exercise-batch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExerciseCandidate, ExerciseDifficulty, ExerciseGenerationSuccess, ExerciseTopicSlug } from "@/types";

const roles = ["teacher", "student"] as const;
const modes = ["light", "dark"] as const;
const states = [
  "unverified",
  "verifying",
  "mixed",
  "selected",
  "approval-loading",
  "approval-error",
  "partial-post-save",
  "all-saved",
] as const;

type GalleryRole = (typeof roles)[number];
type GalleryMode = (typeof modes)[number];
type GalleryState = (typeof states)[number];

const stateLabels: Record<GalleryState, string> = {
  unverified: "Unverified batch",
  verifying: "Verification loading",
  mixed: "Mixed verification",
  selected: "Selected subset",
  "approval-loading": "Approval loading",
  "approval-error": "Approval error",
  "partial-post-save": "Partial post-save",
  "all-saved": "All saved",
};

function candidate(id: string, text: string, answer: string): ExerciseCandidate {
  return {
    id,
    grade: 4,
    topic: "multiplication-division",
    difficulty: "medium",
    text,
    proposedCanonicalAnswer: answer,
    approvalStatus: "unverified",
  };
}

const generatedBatch: ExerciseGenerationSuccess = {
  requestedCount: 5,
  validCount: 5,
  candidates: [
    candidate("gallery-1", "Oblicz 36 · 7.", "252"),
    candidate("gallery-2", "Podziel 864 przez 8.", "108"),
    candidate("gallery-3", "W bibliotece ustawiono 9 półek po 24 książki. Ile książek ustawiono?", "216"),
    candidate("gallery-4", "Oblicz 125 · 6.", "700"),
    candidate("gallery-5", "Podziel 945 przez 9 i podaj wszystkie możliwe wyniki.", "105"),
  ],
};

const mixedBatch = applyExerciseVerificationResults(createExerciseReviewBatch(generatedBatch), [
  {
    candidateId: "gallery-1",
    verificationId: "11111111-1111-4111-8111-111111111111",
    outcome: "unique_answer",
    verifiedAnswer: "252",
    rationale: "Działanie ma jeden wynik zgodny z proponowaną odpowiedzią.",
    verifierIdentity: "openrouter",
    verifierVersion: "gallery-model",
    verifiedAt: "2026-09-29T12:00:00.000Z",
  },
  {
    candidateId: "gallery-2",
    outcome: "indeterminate",
    error: { code: "PROVIDER_TIMEOUT", message: "Usługa weryfikacji przekroczyła limit czasu." },
  },
  {
    candidateId: "gallery-3",
    verificationId: "33333333-3333-4333-8333-333333333333",
    outcome: "unique_answer",
    verifiedAnswer: "216",
    rationale: "Treść prowadzi do jednego iloczynu: 9 · 24.",
    verifierIdentity: "openrouter",
    verifierVersion: "gallery-model",
    verifiedAt: "2026-09-29T12:00:00.000Z",
  },
  {
    candidateId: "gallery-4",
    verificationId: "44444444-4444-4444-8444-444444444444",
    outcome: "answer_mismatch",
    verifiedAnswer: "750",
    rationale: "Poprawny iloczyn różni się od proponowanej odpowiedzi.",
    verifierIdentity: "openrouter",
    verifierVersion: "gallery-model",
    verifiedAt: "2026-09-29T12:00:00.000Z",
  },
  {
    candidateId: "gallery-5",
    verificationId: "55555555-5555-4555-8555-555555555555",
    outcome: "not_unique_answer",
    verifiedAnswer: null,
    rationale: "Polecenie nie określa jednej oczekiwanej odpowiedzi.",
    verifierIdentity: "openrouter",
    verifierVersion: "gallery-model",
    verifiedAt: "2026-09-29T12:00:00.000Z",
  },
]);

const selectedBatch = selectExerciseVerification(
  selectExerciseVerification(mixedBatch, "11111111-1111-4111-8111-111111111111", true),
  "33333333-3333-4333-8333-333333333333",
  true,
);

const partialPostSaveBatch: ExerciseReviewBatch = {
  ...mixedBatch,
  validCount: 3,
  partial_batch: true,
  candidates: mixedBatch.candidates.slice(1, 4),
  selectedVerificationIds: [],
};

function fixtureBatch(state: GalleryState): ExerciseReviewBatch | null {
  if (state === "all-saved") return null;
  if (state === "unverified" || state === "verifying") return createExerciseReviewBatch(generatedBatch);
  if (state === "selected" || state === "approval-loading" || state === "approval-error") return selectedBatch;
  if (state === "partial-post-save") return partialPostSaveBatch;
  return mixedBatch;
}

export default function ExerciseRequestStateGallery() {
  const [role, setRole] = useState<GalleryRole>("teacher");
  const [mode, setMode] = useState<GalleryMode>("light");
  const [galleryState, setGalleryState] = useState<GalleryState>("unverified");
  const [topic, setTopic] = useState<ExerciseTopicSlug>("multiplication-division");
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty>("medium");
  const restoredBatch = fixtureBatch(galleryState);
  const pendingAction =
    galleryState === "verifying" ? "verification" : galleryState === "approval-loading" ? "approval" : null;
  const errorMessage =
    galleryState === "approval-error" ? "Nie udało się zapisać zestawu. Cały zestaw pozostał bez zmian." : null;
  const statusMessage =
    galleryState === "partial-post-save"
      ? "Zapisano 2 zadania w zatwierdzonej puli."
      : galleryState === "all-saved"
        ? "Zapisano 5 zadań w zatwierdzonej puli."
        : null;

  return (
    <main className="bg-muted text-foreground min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header>
          <p className="text-muted-foreground text-sm font-semibold">Development fixture</p>
          <h1 className="mt-1 text-3xl font-bold">Exercise review state gallery</h1>
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
          data-role={role}
          data-gallery-role={role}
          data-gallery-mode={mode}
          data-gallery-state={galleryState}
          className={cn("bg-background text-foreground mt-8 rounded-lg p-4 sm:p-8", mode === "dark" && "dark")}
        >
          <div className="mx-auto max-w-3xl">
            <section className="bg-card text-card-foreground rounded-lg border p-5 shadow-sm sm:p-8">
              <p className="text-primary text-sm font-semibold">Matematyka · klasa 4</p>
              <h2 className="mt-2 text-3xl font-bold">Wygeneruj propozycje zadań</h2>
              <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6 sm:text-base">
                Wybierz temat i poziom trudności, a potem zweryfikuj odpowiedzi przed zapisaniem.
              </p>
              <ExerciseRequestView
                topic={topic}
                difficulty={difficulty}
                pendingAction={pendingAction}
                errorMessage={errorMessage}
                statusMessage={statusMessage}
                restoredBatch={restoredBatch}
                onTopicChange={setTopic}
                onDifficultyChange={setDifficulty}
                onSubmit={(event) => {
                  event.preventDefault();
                }}
                onVerify={() => undefined}
                onRetry={() => undefined}
                onSelectionChange={() => undefined}
                onApprove={() => undefined}
                onClear={() => undefined}
              />
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}
