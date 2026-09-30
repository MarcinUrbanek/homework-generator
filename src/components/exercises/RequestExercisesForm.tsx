import { useRef, useState } from "react";

import { ExerciseRequestView } from "@/components/exercises/ExerciseRequestView";
import { useSessionExerciseBatch } from "@/components/hooks/use-session-exercise-batch";
import { exerciseNoun } from "@/lib/exercises/exercise-count";
import {
  exerciseApprovalErrorSchema,
  exerciseApprovalSuccessSchema,
  exerciseGenerationErrorSchema,
  exerciseGenerationSuccessSchema,
  exerciseVerificationErrorSchema,
  exerciseVerificationSuccessSchema,
} from "@/lib/exercises/schemas";
import type { ExerciseDifficulty, ExerciseGenerationRequest, ExerciseTopicSlug } from "@/types";

type PendingAction = "generation" | "verification" | "approval";

function savedCountMessage(savedCount: number): string {
  return `Zapisano ${savedCount} ${exerciseNoun(savedCount)} w zatwierdzonej puli.`;
}

export default function RequestExercisesForm() {
  const [topic, setTopic] = useState<ExerciseTopicSlug>("addition-subtraction");
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty>("easy");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const isMutationPending = useRef(false);
  const {
    batch,
    isRestored,
    replaceBatch,
    applyVerificationResults,
    setVerificationSelected,
    removeApprovedCandidates,
    clearBatch,
  } = useSessionExerciseBatch();
  const isBusy = pendingAction !== null;

  function beginAction(action: PendingAction): boolean {
    if (isMutationPending.current) return false;
    isMutationPending.current = true;
    setPendingAction(action);
    setErrorMessage(null);
    setStatusMessage(null);
    return true;
  }

  function finishAction(): void {
    isMutationPending.current = false;
    setPendingAction(null);
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!beginAction("generation")) return;

    const request: ExerciseGenerationRequest = { grade: 4, topic, difficulty };
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
        `${parsedError.success ? parsedError.data.error.message : "Nie udało się odczytać odpowiedzi generatora."} Poprzednie wyniki, jeśli były dostępne, pozostały bez zmian.`,
      );
    } catch {
      setErrorMessage(
        "Nie udało się połączyć z generatorem. Sprawdź połączenie i spróbuj ponownie. Poprzednie wyniki pozostały bez zmian.",
      );
    } finally {
      finishAction();
    }
  }

  async function handleVerify(retryIndeterminate: boolean): Promise<void> {
    if (!batch || !beginAction("verification")) return;
    const candidates = batch.candidates
      .filter(({ status }) => (retryIndeterminate ? status === "indeterminate" : status === "unverified"))
      .map(({ candidate }) => candidate);

    if (candidates.length === 0) {
      finishAction();
      return;
    }

    try {
      const response = await fetch("/api/exercises/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates }),
      });
      const responseValue = (await response.json()) as unknown;
      const parsedSuccess = exerciseVerificationSuccessSchema.safeParse(responseValue);
      if (response.ok && parsedSuccess.success) {
        applyVerificationResults(parsedSuccess.data.results);
        setStatusMessage("Weryfikacja zakończona. Przejrzyj wyniki i wybierz zadania do zapisania.");
        return;
      }

      const parsedError = exerciseVerificationErrorSchema.safeParse(responseValue);
      setErrorMessage(
        `${parsedError.success ? parsedError.data.error.message : "Nie udało się odczytać wyników weryfikacji."} Dotychczasowe wyniki pozostały bez zmian.`,
      );
    } catch {
      setErrorMessage("Nie udało się połączyć z usługą weryfikacji. Dotychczasowe wyniki pozostały bez zmian.");
    } finally {
      finishAction();
    }
  }

  async function handleApprove(): Promise<void> {
    if (!batch || batch.selectedVerificationIds.length === 0 || !beginAction("approval")) return;

    try {
      const response = await fetch("/api/exercises/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationIds: batch.selectedVerificationIds }),
      });
      const responseValue = (await response.json()) as unknown;
      const parsedSuccess = exerciseApprovalSuccessSchema.safeParse(responseValue);
      if (response.ok && parsedSuccess.success) {
        removeApprovedCandidates(parsedSuccess.data.mappings);
        setStatusMessage(savedCountMessage(parsedSuccess.data.mappings.length));
        return;
      }

      const parsedError = exerciseApprovalErrorSchema.safeParse(responseValue);
      setErrorMessage(
        `${parsedError.success ? parsedError.data.error.message : "Nie udało się odczytać wyniku zapisu."} Cały zestaw pozostał bez zmian.`,
      );
    } catch {
      setErrorMessage("Nie udało się połączyć podczas zapisu. Cały zestaw pozostał bez zmian.");
    } finally {
      finishAction();
    }
  }

  return (
    <ExerciseRequestView
      topic={topic}
      difficulty={difficulty}
      pendingAction={pendingAction}
      errorMessage={errorMessage}
      statusMessage={statusMessage}
      restoredBatch={isRestored ? batch : null}
      onTopicChange={setTopic}
      onDifficultyChange={setDifficulty}
      onSubmit={handleSubmit}
      onVerify={() => void handleVerify(false)}
      onRetry={() => void handleVerify(true)}
      onSelectionChange={setVerificationSelected}
      onApprove={() => void handleApprove()}
      onClear={() => {
        if (!isBusy) clearBatch();
      }}
    />
  );
}
