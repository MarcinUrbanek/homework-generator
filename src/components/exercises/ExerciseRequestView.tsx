import { AlertCircle, LoaderCircle, Sparkles } from "lucide-react";

import { ExerciseCandidateList } from "@/components/exercises/ExerciseCandidateList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DIFFICULTY_LABELS, GRADE_4_EXERCISE_CATALOG } from "@/lib/exercises/catalog";
import type { ExerciseDifficulty, ExerciseGenerationSuccess, ExerciseTopicSlug } from "@/types";

export interface ExerciseRequestViewProps {
  topic: ExerciseTopicSlug;
  difficulty: ExerciseDifficulty;
  isLoading: boolean;
  errorMessage: string | null;
  restoredBatch: ExerciseGenerationSuccess | null;
  onTopicChange: (topic: ExerciseTopicSlug) => void;
  onDifficultyChange: (difficulty: ExerciseDifficulty) => void;
  onSubmit: React.SubmitEventHandler<HTMLFormElement>;
  onClear: () => void;
}

export function ExerciseRequestView({
  topic,
  difficulty,
  isLoading,
  errorMessage,
  restoredBatch,
  onTopicChange,
  onDifficultyChange,
  onSubmit,
  onClear,
}: ExerciseRequestViewProps) {
  return (
    <>
      <form onSubmit={onSubmit} className="mt-8" aria-busy={isLoading}>
        <FieldSet disabled={isLoading} className="disabled:opacity-70">
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

            <Button type="submit" size="lg" disabled={isLoading} className="min-h-11 w-full sm:w-auto">
              {isLoading ? (
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

      <div className="min-h-6 pt-4" aria-live="polite" aria-atomic="true">
        {isLoading && (
          <p className="text-muted-foreground text-sm">Generator przygotowuje propozycje. Może to potrwać do minuty.</p>
        )}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertDescription>
              {errorMessage} Poprzednie wyniki, jeśli były dostępne, pozostały bez zmian.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {restoredBatch && <ExerciseCandidateList batch={restoredBatch} onClear={onClear} />}
    </>
  );
}
