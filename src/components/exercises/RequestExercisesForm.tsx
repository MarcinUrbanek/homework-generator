import { useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";

import { ExerciseCandidateList } from "@/components/exercises/ExerciseCandidateList";
import { useSessionExerciseBatch } from "@/components/hooks/use-session-exercise-batch";
import { DIFFICULTY_LABELS, GRADE_4_EXERCISE_CATALOG } from "@/lib/exercises/catalog";
import { exerciseGenerationErrorSchema, exerciseGenerationSuccessSchema } from "@/lib/exercises/schemas";
import type { ExerciseDifficulty, ExerciseGenerationRequest, ExerciseTopicSlug } from "@/types";

export default function RequestExercisesForm() {
  const [topic, setTopic] = useState<ExerciseTopicSlug>("addition-subtraction");
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty>("easy");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { batch, isRestored, replaceBatch, clearBatch } = useSessionExerciseBatch();

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) {
      return;
    }

    const request: ExerciseGenerationRequest = { grade: 4, topic, difficulty };
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/exercises/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const responseValue = (await response.json()) as unknown;
      const parsedSuccess = exerciseGenerationSuccessSchema.safeParse(responseValue);

      if (response.ok && parsedSuccess.success) {
        replaceBatch(parsedSuccess.data);
        return;
      }

      const parsedError = exerciseGenerationErrorSchema.safeParse(responseValue);
      setErrorMessage(
        parsedError.success ? parsedError.data.error.message : "Nie udało się odczytać odpowiedzi generatora.",
      );
    } catch {
      setErrorMessage("Nie udało się połączyć z generatorem. Sprawdź połączenie i spróbuj ponownie.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-8" aria-busy={isLoading}>
        <fieldset disabled={isLoading} className="grid gap-6 disabled:opacity-70">
          <div className="grid gap-2">
            <label htmlFor="grade" className="text-sm font-semibold text-blue-100">
              Klasa
            </label>
            <select
              id="grade"
              value="4"
              disabled
              className="h-11 rounded-md border border-white/20 bg-slate-950/60 px-3 text-white disabled:cursor-not-allowed disabled:opacity-100"
            >
              <option value="4">Klasa 4</option>
            </select>
          </div>

          <div className="grid gap-2">
            <label htmlFor="topic" className="text-sm font-semibold text-blue-100">
              Temat
            </label>
            <select
              id="topic"
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value as ExerciseTopicSlug);
              }}
              className="h-11 rounded-md border border-white/20 bg-slate-950/60 px-3 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
            >
              {GRADE_4_EXERCISE_CATALOG.map((catalogTopic) => (
                <option key={catalogTopic.slug} value={catalogTopic.slug}>
                  {catalogTopic.label}
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-blue-100">Poziom trudności</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(Object.entries(DIFFICULTY_LABELS) as [ExerciseDifficulty, string][]).map(([value, label]) => (
                <label key={value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="difficulty"
                    value={value}
                    checked={difficulty === value}
                    onChange={() => {
                      setDifficulty(value);
                    }}
                    className="peer sr-only"
                  />
                  <span className="flex min-h-11 items-center justify-center rounded-md border border-white/20 px-2 text-center text-sm font-semibold text-blue-100 transition-colors peer-checked:border-cyan-200 peer-checked:bg-cyan-200 peer-checked:text-slate-950 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cyan-200">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-cyan-200 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Generowanie zadań...
              </>
            ) : (
              <>
                <Sparkles className="size-4" aria-hidden="true" />
                Wygeneruj 5 zadań
              </>
            )}
          </button>
        </fieldset>
      </form>

      <div className="min-h-6 pt-4" aria-live="polite" aria-atomic="true">
        {isLoading && (
          <p className="text-sm text-blue-100">Generator przygotowuje propozycje. Może to potrwać do minuty.</p>
        )}
        {errorMessage && (
          <p role="alert" className="rounded-md border border-red-300/30 bg-red-300/10 p-3 text-sm text-red-100">
            {errorMessage} Poprzednie wyniki, jeśli były dostępne, pozostały bez zmian.
          </p>
        )}
      </div>

      {isRestored && batch && <ExerciseCandidateList batch={batch} onClear={clearBatch} />}
    </>
  );
}
