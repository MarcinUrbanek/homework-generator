import { useRef, useState } from "react";

import { ExerciseRequestView } from "@/components/exercises/ExerciseRequestView";
import { useSessionExerciseBatch } from "@/components/hooks/use-session-exercise-batch";
import { exerciseGenerationErrorSchema, exerciseGenerationSuccessSchema } from "@/lib/exercises/schemas";
import type { ExerciseDifficulty, ExerciseGenerationRequest, ExerciseTopicSlug } from "@/types";

export default function RequestExercisesForm() {
  const [topic, setTopic] = useState<ExerciseTopicSlug>("addition-subtraction");
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty>("easy");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isRequestPending = useRef(false);
  const { batch, isRestored, replaceBatch, clearBatch } = useSessionExerciseBatch();

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRequestPending.current) {
      return;
    }

    const request: ExerciseGenerationRequest = { grade: 4, topic, difficulty };
    isRequestPending.current = true;
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
      isRequestPending.current = false;
      setIsLoading(false);
    }
  }

  return (
    <ExerciseRequestView
      topic={topic}
      difficulty={difficulty}
      isLoading={isLoading}
      errorMessage={errorMessage}
      restoredBatch={isRestored ? batch : null}
      onTopicChange={setTopic}
      onDifficultyChange={setDifficulty}
      onSubmit={handleSubmit}
      onClear={clearBatch}
    />
  );
}
