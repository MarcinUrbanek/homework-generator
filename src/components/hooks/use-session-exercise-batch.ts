import { useCallback, useState, useSyncExternalStore } from "react";
import { z } from "zod";

import {
  exerciseCandidateSchema,
  exerciseGenerationSuccessSchema,
  exerciseVerificationResultSchema,
} from "@/lib/exercises/schemas";
import type {
  ExerciseApprovalMapping,
  ExerciseCandidate,
  ExerciseGenerationSuccess,
  ExerciseGenerationSuccessMetadata,
  ExerciseVerificationResult,
} from "@/types";

const STORAGE_KEY = "latest-successful-exercise-batch";
const STORAGE_VERSION = 2;

export type ExerciseReviewStatus =
  "unverified" | "unique_answer" | "answer_mismatch" | "not_unique_answer" | "indeterminate";

export type ExerciseReviewCandidate =
  | { candidate: ExerciseCandidate; status: "unverified" }
  | {
      candidate: ExerciseCandidate;
      status: Exclude<ExerciseReviewStatus, "unverified">;
      evidence: ExerciseVerificationResult;
    };

export interface ExerciseReviewBatch extends ExerciseGenerationSuccessMetadata {
  candidates: ExerciseReviewCandidate[];
  selectedVerificationIds: string[];
}

interface StoredExerciseBatch {
  version: typeof STORAGE_VERSION;
  batch: ExerciseReviewBatch;
}

const validExerciseCountSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const exerciseReviewCandidateSchema = z
  .object({
    candidate: exerciseCandidateSchema,
    status: z.enum(["unverified", "unique_answer", "answer_mismatch", "not_unique_answer", "indeterminate"]),
    evidence: exerciseVerificationResultSchema.optional(),
  })
  .strict()
  .superRefine((reviewCandidate, context) => {
    if (reviewCandidate.status === "unverified") {
      if (reviewCandidate.evidence !== undefined) {
        context.addIssue({ code: "custom", path: ["evidence"], message: "Unverified candidates cannot have evidence" });
      }
      return;
    }

    if (
      reviewCandidate.evidence?.outcome !== reviewCandidate.status ||
      reviewCandidate.evidence.candidateId !== reviewCandidate.candidate.id
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidence"],
        message: "Evidence must match the candidate and review status",
      });
    }
  });

const exerciseReviewBatchSchema = z
  .object({
    requestedCount: z.literal(5),
    validCount: validExerciseCountSchema,
    partial_batch: z.literal(true).optional(),
    candidates: z.array(exerciseReviewCandidateSchema).min(1).max(5),
    selectedVerificationIds: z.array(z.uuid()).max(5),
  })
  .strict()
  .superRefine((batch, context) => {
    if (batch.candidates.length !== batch.validCount) {
      context.addIssue({ code: "custom", path: ["validCount"], message: "validCount must match candidates" });
    }
    if (batch.validCount < batch.requestedCount !== (batch.partial_batch === true)) {
      context.addIssue({ code: "custom", path: ["partial_batch"], message: "partial_batch must match validCount" });
    }

    const successfulVerificationIds = new Set(
      batch.candidates.flatMap((reviewCandidate) =>
        reviewCandidate.status === "unique_answer" && reviewCandidate.evidence?.outcome === "unique_answer"
          ? [reviewCandidate.evidence.verificationId]
          : [],
      ),
    );
    if (
      new Set(batch.selectedVerificationIds).size !== batch.selectedVerificationIds.length ||
      batch.selectedVerificationIds.some((verificationId) => !successfulVerificationIds.has(verificationId))
    ) {
      context.addIssue({
        code: "custom",
        path: ["selectedVerificationIds"],
        message: "Only distinct successful verifications may be selected",
      });
    }
  });

function unsubscribeFromHydration(): void {
  return;
}

function subscribeToHydration(): () => void {
  return unsubscribeFromHydration;
}

const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function createExerciseReviewBatch(batch: ExerciseGenerationSuccess): ExerciseReviewBatch {
  return {
    requestedCount: batch.requestedCount,
    validCount: batch.validCount,
    ...(batch.partial_batch ? { partial_batch: true as const } : {}),
    candidates: batch.candidates.map((candidate) => ({ candidate, status: "unverified" })),
    selectedVerificationIds: [],
  };
}

export function restoreSessionExerciseBatch(storage: Storage): ExerciseReviewBatch | null {
  try {
    const storedValue = storage.getItem(STORAGE_KEY);
    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as unknown;
    if (
      typeof parsedValue !== "object" ||
      parsedValue === null ||
      !("version" in parsedValue) ||
      !("batch" in parsedValue)
    ) {
      clearSessionExerciseBatch(storage);
      return null;
    }

    if (parsedValue.version === 1) {
      const parsedGenerationBatch = exerciseGenerationSuccessSchema.safeParse(parsedValue.batch);
      if (!parsedGenerationBatch.success) {
        clearSessionExerciseBatch(storage);
        return null;
      }
      const migratedBatch = createExerciseReviewBatch(parsedGenerationBatch.data);
      storeSessionExerciseBatch(storage, migratedBatch);
      return migratedBatch;
    }

    if (parsedValue.version !== STORAGE_VERSION) {
      clearSessionExerciseBatch(storage);
      return null;
    }

    const parsedBatch = exerciseReviewBatchSchema.safeParse(parsedValue.batch);
    if (!parsedBatch.success) {
      clearSessionExerciseBatch(storage);
      return null;
    }
    return parsedBatch.data as ExerciseReviewBatch;
  } catch {
    clearSessionExerciseBatch(storage);
    return null;
  }
}

export function storeSessionExerciseBatch(storage: Storage, batch: ExerciseReviewBatch): void {
  const storedBatch: StoredExerciseBatch = { version: STORAGE_VERSION, batch };
  storage.setItem(STORAGE_KEY, JSON.stringify(storedBatch));
}

export function clearSessionExerciseBatch(storage: Storage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // The in-memory batch remains usable when browser storage is unavailable.
  }
}

export function applyExerciseVerificationResults(
  batch: ExerciseReviewBatch,
  results: ExerciseVerificationResult[],
): ExerciseReviewBatch {
  const resultByCandidateId = new Map(results.map((result) => [result.candidateId, result]));
  const candidateIds = new Set(batch.candidates.map(({ candidate }) => candidate.id));
  if (resultByCandidateId.size !== results.length || results.some((result) => !candidateIds.has(result.candidateId))) {
    return batch;
  }

  const candidates = batch.candidates.map((reviewCandidate) => {
    const result = resultByCandidateId.get(reviewCandidate.candidate.id);
    if (reviewCandidate.status !== "unverified" && reviewCandidate.status !== "indeterminate") {
      return reviewCandidate;
    }
    return result
      ? { candidate: reviewCandidate.candidate, status: result.outcome, evidence: result }
      : reviewCandidate;
  });
  const successfulVerificationIds = new Set(
    candidates.flatMap((reviewCandidate) =>
      reviewCandidate.status === "unique_answer" && reviewCandidate.evidence.outcome === "unique_answer"
        ? [reviewCandidate.evidence.verificationId]
        : [],
    ),
  );

  return {
    ...batch,
    candidates,
    selectedVerificationIds: batch.selectedVerificationIds.filter((id) => successfulVerificationIds.has(id)),
  };
}

export function selectExerciseVerification(
  batch: ExerciseReviewBatch,
  verificationId: string,
  selected: boolean,
): ExerciseReviewBatch {
  const isSuccessful = batch.candidates.some(
    (reviewCandidate) =>
      reviewCandidate.status === "unique_answer" &&
      reviewCandidate.evidence.outcome === "unique_answer" &&
      reviewCandidate.evidence.verificationId === verificationId,
  );
  if (!isSuccessful) {
    return batch;
  }

  const selectedVerificationIds = selected
    ? [...new Set([...batch.selectedVerificationIds, verificationId])]
    : batch.selectedVerificationIds.filter((id) => id !== verificationId);
  return { ...batch, selectedVerificationIds };
}

export function removeApprovedExerciseCandidates(
  batch: ExerciseReviewBatch,
  mappings: ExerciseApprovalMapping[],
): ExerciseReviewBatch | null {
  const savedVerificationIds = new Set(mappings.map(({ verificationId }) => verificationId));
  const candidates = batch.candidates.filter(
    (reviewCandidate) =>
      reviewCandidate.status !== "unique_answer" ||
      reviewCandidate.evidence.outcome !== "unique_answer" ||
      !savedVerificationIds.has(reviewCandidate.evidence.verificationId),
  );
  if (candidates.length === 0) {
    return null;
  }

  return {
    ...batch,
    validCount: candidates.length as ExerciseGenerationSuccessMetadata["validCount"],
    partial_batch: true,
    candidates,
    selectedVerificationIds: batch.selectedVerificationIds.filter((id) => !savedVerificationIds.has(id)),
  };
}

export function useSessionExerciseBatch() {
  const [batch, setBatch] = useState<ExerciseReviewBatch | null>(() =>
    typeof window === "undefined" ? null : restoreSessionExerciseBatch(window.sessionStorage),
  );
  const isRestored = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);

  const persistBatch = useCallback((nextBatch: ExerciseReviewBatch | null) => {
    try {
      if (nextBatch) storeSessionExerciseBatch(window.sessionStorage, nextBatch);
      else clearSessionExerciseBatch(window.sessionStorage);
    } catch {
      // A storage failure must not hide paid generation or verification work.
    }
    setBatch(nextBatch);
  }, []);

  const replaceBatch = useCallback(
    (nextBatch: ExerciseGenerationSuccess) => {
      persistBatch(createExerciseReviewBatch(nextBatch));
    },
    [persistBatch],
  );

  const applyVerificationResults = useCallback((results: ExerciseVerificationResult[]) => {
    setBatch((currentBatch) => {
      if (!currentBatch) return currentBatch;
      const nextBatch = applyExerciseVerificationResults(currentBatch, results);
      try {
        storeSessionExerciseBatch(window.sessionStorage, nextBatch);
      } catch {
        // Keep the in-memory evidence when browser storage is unavailable.
      }
      return nextBatch;
    });
  }, []);

  const setVerificationSelected = useCallback((verificationId: string, selected: boolean) => {
    setBatch((currentBatch) => {
      if (!currentBatch) return currentBatch;
      const nextBatch = selectExerciseVerification(currentBatch, verificationId, selected);
      try {
        storeSessionExerciseBatch(window.sessionStorage, nextBatch);
      } catch {
        // Keep the in-memory selection when browser storage is unavailable.
      }
      return nextBatch;
    });
  }, []);

  const removeApprovedCandidates = useCallback((mappings: ExerciseApprovalMapping[]) => {
    setBatch((currentBatch) => {
      if (!currentBatch) return currentBatch;
      const nextBatch = removeApprovedExerciseCandidates(currentBatch, mappings);
      try {
        if (nextBatch) storeSessionExerciseBatch(window.sessionStorage, nextBatch);
        else clearSessionExerciseBatch(window.sessionStorage);
      } catch {
        // Keep the in-memory remainder when browser storage is unavailable.
      }
      return nextBatch;
    });
  }, []);

  const clearBatch = useCallback(() => {
    persistBatch(null);
  }, [persistBatch]);

  return {
    batch,
    isRestored,
    replaceBatch,
    applyVerificationResults,
    setVerificationSelected,
    removeApprovedCandidates,
    clearBatch,
  };
}
