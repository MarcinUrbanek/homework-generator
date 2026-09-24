import { useCallback, useState, useSyncExternalStore } from "react";

import { exerciseGenerationSuccessSchema } from "@/lib/exercises/schemas";
import type { ExerciseGenerationSuccess } from "@/types";

const STORAGE_KEY = "latest-successful-exercise-batch";
const STORAGE_VERSION = 1;

interface StoredExerciseBatch {
  version: typeof STORAGE_VERSION;
  batch: ExerciseGenerationSuccess;
}

function unsubscribeFromHydration(): void {
  return;
}

function subscribeToHydration(): () => void {
  return unsubscribeFromHydration;
}

const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function restoreSessionExerciseBatch(storage: Storage): ExerciseGenerationSuccess | null {
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
      parsedValue.version !== STORAGE_VERSION ||
      !("batch" in parsedValue)
    ) {
      clearSessionExerciseBatch(storage);
      return null;
    }

    const parsedBatch = exerciseGenerationSuccessSchema.safeParse(parsedValue.batch);
    if (!parsedBatch.success) {
      clearSessionExerciseBatch(storage);
      return null;
    }

    return parsedBatch.data;
  } catch {
    clearSessionExerciseBatch(storage);
    return null;
  }
}

export function storeSessionExerciseBatch(storage: Storage, batch: ExerciseGenerationSuccess): void {
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

export function useSessionExerciseBatch() {
  const [batch, setBatch] = useState<ExerciseGenerationSuccess | null>(() =>
    typeof window === "undefined" ? null : restoreSessionExerciseBatch(window.sessionStorage),
  );
  const isRestored = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);

  const replaceBatch = useCallback((nextBatch: ExerciseGenerationSuccess) => {
    try {
      storeSessionExerciseBatch(window.sessionStorage, nextBatch);
    } catch {
      // A storage failure must not hide a successfully generated paid result.
    }
    setBatch(nextBatch);
  }, []);

  const clearBatch = useCallback(() => {
    clearSessionExerciseBatch(window.sessionStorage);
    setBatch(null);
  }, []);

  return { batch, isRestored, replaceBatch, clearBatch };
}
