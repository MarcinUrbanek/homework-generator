// @ts-nocheck
import { AlertCircle, CheckCircle2, CircleHelp, XCircle } from "lucide-react";

import type { ExerciseReviewBatch, ExerciseReviewCandidate } from "@/components/hooks/use-session-exercise-batch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { DIFFICULTY_LABELS, GRADE_4_EXERCISE_CATALOG } from "@/lib/exercises/catalog";

interface ExerciseCandidateListProps {
  batch: ExerciseReviewBatch;
  disabled: boolean;
  onSelectionChange: (verificationId: string, selected: boolean) => void;
}

const statusPresentation = {
  unverified: { label: "Niezweryfikowane", variant: "warning" as const, icon: CircleHelp },
  unique_answer: { label: "Odpowiedź potwierdzona", variant: "default" as const, icon: CheckCircle2 },
  answer_mismatch: { label: "Odpowiedź niezgodna", variant: "destructive" as const, icon: XCircle },
  not_unique_answer: { label: "Brak jednej odpowiedzi", variant: "warning" as const, icon: AlertCircle },
  indeterminate: { label: "Nie udało się rozstrzygnąć", variant: "outline" as const, icon: CircleHelp },
};

function eligibilityMessage(reviewCandidate: ExerciseReviewCandidate): string {
  switch (reviewCandidate.status) {
    case "unverified":
      return "Najpierw zweryfikuj zestaw.";
    case "answer_mismatch":
      return "Zadanie nie może zostać zapisane, ponieważ zweryfikowana odpowiedź różni się od proponowanej.";
    case "not_unique_answer":
      return "Zadanie nie może zostać zapisane, ponieważ nie ma jednej jednoznacznej odpowiedzi.";
    case "indeterminate":
      return "Zadanie nie może zostać zapisane, dopóki błąd techniczny nie zostanie rozstrzygnięty.";
    case "unique_answer":
      return "Odpowiedź została potwierdzona. Zadanie można wybrać do zapisania.";
  }
}

export function ExerciseCandidateList({ batch, disabled, onSelectionChange }: ExerciseCandidateListProps) {
  const firstCandidate = batch.candidates[0].candidate;
  const topicLabel = GRADE_4_EXERCISE_CATALOG.find((topic) => topic.slug === firstCandidate.topic)?.label;
  const difficultyLabel = DIFFICULTY_LABELS[firstCandidate.difficulty];

  return (
    <section className="mt-10" aria-labelledby="candidate-list-heading">
      <div className="border-b pb-5">
        <p className="text-primary text-sm font-semibold">
          {batch.partial_batch ? `W zestawie pozostało ${batch.validCount} z 5` : "W zestawie jest 5 zadań"}
        </p>
        <h2 id="candidate-list-heading" className="mt-1 text-2xl font-bold">
          Przegląd zestawu
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Klasa 4 · {topicLabel} · {difficultyLabel}
        </p>
      </div>

      {batch.partial_batch && (
        <Alert variant="warning" className="mt-4">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>
            Zestaw zawiera mniej niż pięć zadań. Możesz zweryfikować i zapisać dostępne propozycje.
          </AlertDescription>
        </Alert>
      )}

      <ol className="mt-5 grid gap-4">
        {batch.candidates.map((reviewCandidate, index) => {
          const { candidate, status } = reviewCandidate;
          const presentation = statusPresentation[status];
          const StatusIcon = presentation.icon;
          const verificationId =
            status === "unique_answer" && reviewCandidate.evidence.outcome === "unique_answer"
              ? reviewCandidate.evidence.verificationId
              : null;
          const isSelected = verificationId ? batch.selectedVerificationIds.includes(verificationId) : false;
          const descriptionId = `candidate-${candidate.id}-eligibility`;

          return (
            <li key={candidate.id}>
              <Card className="gap-0 py-0 shadow-none">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-primary text-sm font-semibold">Zadanie {index + 1}</span>
                    <Badge variant={presentation.variant}>
                      <StatusIcon aria-hidden="true" />
                      {presentation.label}
                    </Badge>
                  </div>
                  <p className="mt-4 text-base leading-7 whitespace-pre-wrap">{candidate.text}</p>
                  <dl className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                        Proponowana odpowiedź
                      </dt>
                      <dd className="mt-1 text-sm leading-6 break-words">{candidate.proposedCanonicalAnswer}</dd>
                    </div>
                    {status !== "unverified" && reviewCandidate.evidence.outcome !== "indeterminate" && (
                      <div>
                        <dt className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                          Zweryfikowana odpowiedź
                        </dt>
                        <dd className="mt-1 text-sm leading-6 break-words">
                          {reviewCandidate.evidence.verifiedAnswer ?? "Brak jednej poprawnej odpowiedzi"}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {status !== "unverified" && (
                    <div className="bg-muted mt-4 rounded-md p-4 text-sm leading-6">
                      <p className="font-semibold">Wynik weryfikacji</p>
                      <p className="text-muted-foreground mt-1">
                        {reviewCandidate.evidence.outcome === "indeterminate"
                          ? reviewCandidate.evidence.error.message
                          : reviewCandidate.evidence.rationale}
                      </p>
                    </div>
                  )}

                  <Field orientation="horizontal" className="mt-5 items-start border-t pt-4">
                    <input
                      id={`candidate-${candidate.id}-selection`}
                      type="checkbox"
                      className="border-input accent-primary mt-0.5 size-4 shrink-0 rounded"
                      checked={isSelected}
                      disabled={disabled || !verificationId}
                      aria-describedby={descriptionId}
                      aria-label={`Wybierz do zapisania: zadanie ${index + 1}`}
                      onChange={(event) => {
                        if (verificationId) onSelectionChange(verificationId, event.currentTarget.checked);
                      }}
                    />
                    <div>
                      <FieldLabel htmlFor={`candidate-${candidate.id}-selection`}>Wybierz do zapisania</FieldLabel>
                      <FieldDescription id={descriptionId}>{eligibilityMessage(reviewCandidate)}</FieldDescription>
                    </div>
                  </Field>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
