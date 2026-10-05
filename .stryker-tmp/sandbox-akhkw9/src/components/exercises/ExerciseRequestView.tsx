// @ts-nocheck
import { AlertCircle, CheckCircle2, LoaderCircle, RefreshCw, Save, ShieldCheck, Sparkles, Trash2 } from "lucide-react";

import { ExerciseCandidateList } from "@/components/exercises/ExerciseCandidateList";
import type { ExerciseReviewBatch } from "@/components/hooks/use-session-exercise-batch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DIFFICULTY_LABELS, GRADE_4_EXERCISE_CATALOG } from "@/lib/exercises/catalog";
import { exerciseNoun } from "@/lib/exercises/exercise-count";
import type { ExerciseDifficulty, ExerciseTopicSlug } from "@/types";

type PendingAction = "generation" | "verification" | "approval";

export interface ExerciseRequestViewProps {
  topic: ExerciseTopicSlug;
  difficulty: ExerciseDifficulty;
  pendingAction: PendingAction | null;
  errorMessage: string | null;
  statusMessage: string | null;
  restoredBatch: ExerciseReviewBatch | null;
  onTopicChange: (topic: ExerciseTopicSlug) => void;
  onDifficultyChange: (difficulty: ExerciseDifficulty) => void;
  onSubmit: React.SubmitEventHandler<HTMLFormElement>;
  onVerify: () => void;
  onRetry: () => void;
  onSelectionChange: (verificationId: string, selected: boolean) => void;
  onApprove: () => void;
  onClear: () => void;
}

export function ExerciseRequestView({
  topic,
  difficulty,
  pendingAction,
  errorMessage,
  statusMessage,
  restoredBatch,
  onTopicChange,
  onDifficultyChange,
  onSubmit,
  onVerify,
  onRetry,
  onSelectionChange,
  onApprove,
  onClear,
}: ExerciseRequestViewProps) {
  const isBusy = pendingAction !== null;
  const unverifiedCount = restoredBatch?.candidates.filter(({ status }) => status === "unverified").length ?? 0;
  const indeterminateCount = restoredBatch?.candidates.filter(({ status }) => status === "indeterminate").length ?? 0;
  const selectedCount = restoredBatch?.selectedVerificationIds.length ?? 0;

  return (
    <>
      <form onSubmit={onSubmit} className="mt-8" aria-busy={pendingAction === "generation"}>
        <FieldSet disabled={isBusy} className="disabled:opacity-70">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="grade">Klasa</FieldLabel>
              <Select value="4" disabled>
                <SelectTrigger id="grade" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">Klasa 4</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="topic">Temat</FieldLabel>
              <Select
                value={topic}
                onValueChange={(value) => {
                  onTopicChange(value as ExerciseTopicSlug);
                }}
              >
                <SelectTrigger id="topic" className="h-11 w-full">
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

            <FieldSet>
              <FieldLegend variant="label">Poziom trudności</FieldLegend>
              <RadioGroup
                value={difficulty}
                onValueChange={(value) => {
                  onDifficultyChange(value as ExerciseDifficulty);
                }}
                className="grid grid-cols-1 gap-2 sm:grid-cols-3"
              >
                {(Object.entries(DIFFICULTY_LABELS) as [ExerciseDifficulty, string][]).map(([value, label]) => (
                  <FieldLabel
                    key={value}
                    htmlFor={`difficulty-${value}`}
                    className="bg-background has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent has-data-[state=checked]:text-accent-foreground min-h-11 w-full cursor-pointer items-center justify-center rounded-md border px-3 text-center"
                  >
                    <RadioGroupItem id={`difficulty-${value}`} value={value} />
                    {label}
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>

            <Button type="submit" size="lg" disabled={isBusy} className="min-h-11 w-full sm:w-auto">
              {pendingAction === "generation" ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                  Generowanie zadań...
                </>
              ) : (
                <>
                  <Sparkles aria-hidden="true" />
                  Wygeneruj 5 zadań
                </>
              )}
            </Button>
          </FieldGroup>
        </FieldSet>
      </form>

      <div className="grid min-h-6 gap-3 pt-4" aria-live="polite" aria-atomic="true">
        {pendingAction === "generation" && (
          <p className="text-muted-foreground text-sm">Generator przygotowuje propozycje. Może to potrwać do minuty.</p>
        )}
        {pendingAction === "verification" && (
          <p className="text-muted-foreground text-sm">Trwa niezależna weryfikacja odpowiedzi.</p>
        )}
        {pendingAction === "approval" && (
          <p className="text-muted-foreground text-sm">Zapisywanie wybranych zadań...</p>
        )}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        {statusMessage && (
          <Alert>
            <CheckCircle2 aria-hidden="true" />
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        )}
      </div>

      {restoredBatch && (
        <>
          <ExerciseCandidateList batch={restoredBatch} disabled={isBusy} onSelectionChange={onSelectionChange} />
          <section className="mt-6 border-t pt-5" aria-label="Działania zestawu">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button type="button" onClick={onVerify} disabled={isBusy || unverifiedCount === 0}>
                {pendingAction === "verification" && unverifiedCount > 0 ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <ShieldCheck aria-hidden="true" />
                )}
                Zweryfikuj zestaw
              </Button>
              {indeterminateCount > 0 && (
                <Button type="button" variant="outline" onClick={onRetry} disabled={isBusy}>
                  <RefreshCw aria-hidden="true" />
                  Ponów nierozstrzygnięte ({indeterminateCount})
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={onClear} disabled={isBusy}>
                <Trash2 aria-hidden="true" />
                Wyczyść wyniki
              </Button>
            </div>

            <div className="bg-muted mt-5 flex flex-col gap-3 rounded-md p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold" aria-live="polite">
                Wybrano: {selectedCount} {exerciseNoun(selectedCount)}
              </p>
              <Button type="button" size="lg" onClick={onApprove} disabled={isBusy || selectedCount === 0}>
                {pendingAction === "approval" ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Save aria-hidden="true" />
                )}
                Zatwierdź i zapisz
              </Button>
            </div>
          </section>
        </>
      )}
    </>
  );
}
