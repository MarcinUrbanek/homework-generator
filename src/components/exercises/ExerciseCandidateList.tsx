import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DIFFICULTY_LABELS, GRADE_4_EXERCISE_CATALOG } from "@/lib/exercises/catalog";
import type { ExerciseGenerationSuccess } from "@/types";

interface ExerciseCandidateListProps {
  batch: ExerciseGenerationSuccess;
  onClear: () => void;
}

export function ExerciseCandidateList({ batch, onClear }: ExerciseCandidateListProps) {
  const topicLabel = GRADE_4_EXERCISE_CATALOG.find((topic) => topic.slug === batch.candidates[0]?.topic)?.label;
  const difficultyLabel = batch.candidates[0] ? DIFFICULTY_LABELS[batch.candidates[0].difficulty] : undefined;

  return (
    <section className="mt-10" aria-labelledby="candidate-list-heading">
      <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-primary text-sm font-semibold">
            {batch.partial_batch ? `Wygenerowano ${batch.validCount} z 5` : "Wygenerowano 5 z 5"}
          </p>
          <h2 id="candidate-list-heading" className="mt-1 text-2xl font-bold">
            Propozycje zadań
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Klasa 4 · {topicLabel} · {difficultyLabel}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={onClear} className="self-start sm:self-auto">
          Wyczyść wyniki
        </Button>
      </div>

      {batch.partial_batch && (
        <Alert variant="warning" className="mt-4">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>
            Generator zwrócił mniej niż pięć poprawnych propozycji. Możesz je przejrzeć lub wygenerować nowy zestaw.
          </AlertDescription>
        </Alert>
      )}

      <ol className="mt-5 grid gap-4">
        {batch.candidates.map((candidate, index) => (
          <li key={candidate.id}>
            <Card className="gap-0 py-0 shadow-none">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-primary text-sm font-semibold">Zadanie {index + 1}</span>
                  <Badge variant="warning">Niezweryfikowane</Badge>
                </div>
                <p className="mt-4 text-base leading-7 whitespace-pre-wrap">{candidate.text}</p>
                <div className="mt-5 border-t pt-4">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Proponowana odpowiedź
                  </p>
                  <p className="mt-1 text-sm leading-6 break-words">{candidate.proposedCanonicalAnswer}</p>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
