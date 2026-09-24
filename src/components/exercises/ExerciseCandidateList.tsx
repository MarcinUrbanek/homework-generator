import { AlertCircle } from "lucide-react";

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
      <div className="flex flex-col gap-3 border-b border-white/15 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-cyan-200">
            {batch.partial_batch ? `Wygenerowano ${batch.validCount} z 5` : "Wygenerowano 5 z 5"}
          </p>
          <h2 id="candidate-list-heading" className="mt-1 text-2xl font-bold text-white">
            Propozycje zadań
          </h2>
          <p className="mt-1 text-sm text-blue-100/65">
            Klasa 4 · {topicLabel} · {difficultyLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="self-start rounded-md border border-white/20 px-3 py-2 text-sm font-medium text-blue-100 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:self-auto"
        >
          Wyczyść wyniki
        </button>
      </div>

      {batch.partial_batch && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Generator zwrócił mniej niż pięć poprawnych propozycji. Możesz je przejrzeć lub wygenerować nowy zestaw.
        </p>
      )}

      <ol className="mt-5 grid gap-4">
        {batch.candidates.map((candidate, index) => (
          <li key={candidate.id} className="rounded-lg border border-white/15 bg-slate-950/35 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-blue-200">Zadanie {index + 1}</span>
              <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-100">
                Niezweryfikowane
              </span>
            </div>
            <p className="mt-4 text-base leading-7 whitespace-pre-wrap text-white">{candidate.text}</p>
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-xs font-semibold tracking-wide text-blue-200/70 uppercase">Proponowana odpowiedź</p>
              <p className="mt-1 text-sm leading-6 break-words text-blue-50">{candidate.proposedCanonicalAnswer}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
