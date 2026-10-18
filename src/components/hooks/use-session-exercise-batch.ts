import { useCallback, useState, useSyncExternalStore } from "react";
import { z } from "zod";

import {
  exerciseCandidateSchema,
  generatedExerciseCandidateSchema,
  exerciseVerificationResultSchema,
} from "@/lib/exercises/schemas";
import {
  ArithmeticAuthorityError,
  arithmeticStructureSchema,
  renderArithmeticExercise,
} from "@/lib/exercises/arithmetic-authority";
import type {
  ExerciseApprovalMapping,
  ExerciseCandidate,
  ExerciseGenerationSuccess,
  ExerciseGenerationSuccessMetadata,
  ExerciseVerificationResult,
} from "@/types";

const STORAGE_KEY = "latest-successful-exercise-batch";
const STORAGE_VERSION = 4;

export type ExerciseReviewStatus =
  "unverified" | "unique_answer" | "answer_mismatch" | "unsupported_evidence" | "indeterminate";

export type ExerciseReviewCandidate =
  | { candidate: ExerciseCandidate; status: "unverified" }
  | {
      candidate: ExerciseCandidate;
      status: Exclude<ExerciseReviewStatus, "unverified">;
      evidence: ExerciseVerificationResult;
    };

export interface ExerciseReviewBatch extends ExerciseGenerationSuccessMetadata {
  eligibility: "current" | "reference-only";
  candidates: ExerciseReviewCandidate[];
  selectedVerificationIds: string[];
}

interface StoredExerciseBatch {
  version: typeof STORAGE_VERSION;
  batch: ExerciseReviewBatch;
}

const validExerciseCountSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const legacyGenerationBatchSchema = z
  .object({
    requestedCount: z.literal(5),
    validCount: validExerciseCountSchema,
    partial_batch: z.literal(true).optional(),
    candidates: z.array(exerciseCandidateSchema.strict()).min(1).max(5),
  })
  .strict()
  .superRefine((batch, context) => {
    if (batch.candidates.length !== batch.validCount) {
      context.addIssue({ code: "custom", path: ["validCount"], message: "validCount must match candidates" });
    }
    if (batch.validCount < batch.requestedCount !== (batch.partial_batch === true)) {
      context.addIssue({ code: "custom", path: ["partial_batch"], message: "partial_batch must match validCount" });
    }
  });
const legacyPersistedEvidenceBaseSchema = z.object({
  verificationId: z.uuid(),
  candidateId: z.string().trim().min(1),
  rationale: z.string().trim().min(1),
  verifierIdentity: z.string().trim().min(1),
  verifierVersion: z.string().trim().min(1),
  verifiedAt: z.iso.datetime({ offset: true }),
});
const legacyExerciseVerificationEvidenceSchema = z.discriminatedUnion("outcome", [
  legacyPersistedEvidenceBaseSchema
    .extend({ outcome: z.literal("unique_answer"), verifiedAnswer: z.string().trim().min(1) })
    .strict(),
  legacyPersistedEvidenceBaseSchema
    .extend({ outcome: z.literal("answer_mismatch"), verifiedAnswer: z.string().trim().min(1) })
    .strict(),
  legacyPersistedEvidenceBaseSchema
    .extend({ outcome: z.literal("not_unique_answer"), verifiedAnswer: z.null() })
    .strict(),
  z
    .object({
      candidateId: z.string().trim().min(1),
      outcome: z.literal("indeterminate"),
      error: z.object({ code: z.string().trim().min(1), message: z.string().trim().min(1) }).strict(),
    })
    .strict(),
]);
const legacyExerciseReviewCandidateSchema = z
  .object({
    candidate: exerciseCandidateSchema,
    status: z.enum(["unverified", "unique_answer", "answer_mismatch", "not_unique_answer", "indeterminate"]),
    evidence: legacyExerciseVerificationEvidenceSchema.optional(),
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
        message: "Legacy evidence must match the candidate and review status",
      });
    }
  });
const legacyExerciseReviewBatchSchema = z
  .object({
    requestedCount: z.literal(5),
    validCount: validExerciseCountSchema,
    partial_batch: z.literal(true).optional(),
    candidates: z.array(legacyExerciseReviewCandidateSchema).min(1).max(5),
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
  });
const versionThreeExerciseReviewCandidateSchema = z
  .object({
    candidate: exerciseCandidateSchema,
    status: z.enum([
      "unverified",
      "unique_answer",
      "answer_mismatch",
      "not_unique_answer",
      "unsupported_evidence",
      "indeterminate",
    ]),
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
const versionThreeExerciseReviewBatchSchema = z
  .object({
    requestedCount: z.literal(5),
    validCount: validExerciseCountSchema,
    partial_batch: z.literal(true).optional(),
    candidates: z.array(versionThreeExerciseReviewCandidateSchema).min(1).max(5),
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
  });

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function renderedCandidate(candidate: ExerciseCandidate) {
  if (candidate.arithmeticStructure === undefined || candidate.arithmeticStructure === null) return null;
  try {
    return renderArithmeticExercise(candidate, candidate.arithmeticStructure);
  } catch (error) {
    if (error instanceof ArithmeticAuthorityError) return null;
    throw error;
  }
}

function candidateMatchesCurrentAuthority(candidate: ExerciseCandidate): boolean {
  const rendered = renderedCandidate(candidate);
  return (
    rendered !== null &&
    rendered.text === candidate.text &&
    rendered.proposedCanonicalAnswer === candidate.proposedCanonicalAnswer &&
    stableJson(rendered.arithmeticStructure) === stableJson(candidate.arithmeticStructure)
  );
}

function candidateMatchesCurrentPrompt(candidate: ExerciseCandidate): boolean {
  const rendered = renderedCandidate(candidate);
  return (
    rendered !== null &&
    rendered.text === candidate.text &&
    stableJson(rendered.arithmeticStructure) === stableJson(candidate.arithmeticStructure)
  );
}

export function isCurrentBoundSuccess(candidate: ExerciseCandidate, evidence: ExerciseVerificationResult): boolean {
  if (
    evidence.outcome !== "unique_answer" ||
    evidence.candidateId !== candidate.id ||
    evidence.verifierIdentity !== "ArithmeticAuthority" ||
    evidence.verifierVersion !== "arithmetic-authority-v1" ||
    evidence.authorityVersion !== 1
  ) {
    return false;
  }

  const candidateStructure = arithmeticStructureSchema.safeParse(candidate.arithmeticStructure);
  const evidenceStructure = arithmeticStructureSchema.safeParse(evidence.arithmeticStructure);
  if (!candidateStructure.success || !evidenceStructure.success) return false;
  if (stableJson(candidateStructure.data) !== stableJson(evidenceStructure.data)) return false;

  const rendered = renderedCandidate(candidate);
  return (
    rendered !== null &&
    rendered.text === candidate.text &&
    rendered.proposedCanonicalAnswer === candidate.proposedCanonicalAnswer &&
    rendered.proposedCanonicalAnswer === evidence.verifiedAnswer &&
    stableJson(rendered.arithmeticStructure) === stableJson(evidenceStructure.data)
  );
}

function isCurrentBoundMismatch(candidate: ExerciseCandidate, evidence: ExerciseVerificationResult): boolean {
  if (
    evidence.outcome !== "answer_mismatch" ||
    evidence.candidateId !== candidate.id ||
    evidence.verifierIdentity !== "ArithmeticAuthority" ||
    evidence.verifierVersion !== "arithmetic-authority-v1" ||
    evidence.authorityVersion !== 1
  ) {
    return false;
  }

  const candidateStructure = arithmeticStructureSchema.safeParse(candidate.arithmeticStructure);
  const evidenceStructure = arithmeticStructureSchema.safeParse(evidence.arithmeticStructure);
  if (!candidateStructure.success || !evidenceStructure.success) return false;
  if (stableJson(candidateStructure.data) !== stableJson(evidenceStructure.data)) return false;

  const rendered = renderedCandidate(candidate);
  return (
    rendered !== null &&
    rendered.text === candidate.text &&
    rendered.proposedCanonicalAnswer !== candidate.proposedCanonicalAnswer &&
    rendered.proposedCanonicalAnswer === evidence.verifiedAnswer &&
    stableJson(rendered.arithmeticStructure) === stableJson(evidenceStructure.data)
  );
}

function isCurrentUnsupportedEvidence(candidate: ExerciseCandidate, evidence: ExerciseVerificationResult): boolean {
  return (
    evidence.outcome === "unsupported_evidence" &&
    evidence.candidateId === candidate.id &&
    evidence.arithmeticStructure === null &&
    evidence.authorityVersion === null
  );
}

function isCurrentEvidence(candidate: ExerciseCandidate, evidence: ExerciseVerificationResult): boolean {
  if (evidence.outcome === "unique_answer") return isCurrentBoundSuccess(candidate, evidence);
  if (evidence.outcome === "answer_mismatch") return isCurrentBoundMismatch(candidate, evidence);
  if (evidence.outcome === "indeterminate") return evidence.candidateId === candidate.id;
  return isCurrentUnsupportedEvidence(candidate, evidence);
}

const exerciseReviewCandidateSchema = z
  .object({
    candidate: generatedExerciseCandidateSchema,
    status: z.enum(["unverified", "unique_answer", "answer_mismatch", "unsupported_evidence", "indeterminate"]),
    evidence: exerciseVerificationResultSchema.optional(),
  })
  .strict()
  .superRefine((reviewCandidate, context) => {
    if (
      !candidateMatchesCurrentPrompt(reviewCandidate.candidate) ||
      (reviewCandidate.status !== "answer_mismatch" && !candidateMatchesCurrentAuthority(reviewCandidate.candidate))
    ) {
      context.addIssue({
        code: "custom",
        path: ["candidate"],
        message: "Current candidates must match their rendered arithmetic structure",
      });
    }

    if (reviewCandidate.status === "unverified") {
      if (reviewCandidate.evidence !== undefined) {
        context.addIssue({ code: "custom", path: ["evidence"], message: "Unverified candidates cannot have evidence" });
      }
      return;
    }

    if (
      reviewCandidate.evidence?.outcome !== reviewCandidate.status ||
      reviewCandidate.evidence.candidateId !== reviewCandidate.candidate.id ||
      !isCurrentEvidence(reviewCandidate.candidate, reviewCandidate.evidence)
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidence"],
        message: "Current evidence must match the structured candidate and outcome",
      });
    }
  });

const currentExerciseReviewBatchSchema = z
  .object({
    eligibility: z.literal("current"),
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
        reviewCandidate.status === "unique_answer" &&
        reviewCandidate.evidence?.outcome === "unique_answer" &&
        isCurrentBoundSuccess(reviewCandidate.candidate, reviewCandidate.evidence)
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

const referenceOnlyExerciseCandidateSchema = z
  .object({
    candidate: exerciseCandidateSchema.omit({ arithmeticStructure: true }).strict(),
    status: z.literal("unverified"),
  })
  .strict();

const referenceOnlyExerciseReviewBatchSchema = z
  .object({
    eligibility: z.literal("reference-only"),
    requestedCount: z.literal(5),
    validCount: validExerciseCountSchema,
    partial_batch: z.literal(true).optional(),
    candidates: z.array(referenceOnlyExerciseCandidateSchema).min(1).max(5),
    selectedVerificationIds: z.array(z.uuid()).length(0),
  })
  .strict()
  .superRefine((batch, context) => {
    if (batch.candidates.length !== batch.validCount) {
      context.addIssue({ code: "custom", path: ["validCount"], message: "validCount must match candidates" });
    }
    if (batch.validCount < batch.requestedCount !== (batch.partial_batch === true)) {
      context.addIssue({ code: "custom", path: ["partial_batch"], message: "partial_batch must match validCount" });
    }
  });

const exerciseReviewBatchSchema = z.discriminatedUnion("eligibility", [
  currentExerciseReviewBatchSchema,
  referenceOnlyExerciseReviewBatchSchema,
]);

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
    eligibility: "current",
    requestedCount: batch.requestedCount,
    validCount: batch.validCount,
    ...(batch.partial_batch ? { partial_batch: true as const } : {}),
    candidates: batch.candidates.map((candidate) => ({ candidate, status: "unverified" })),
    selectedVerificationIds: [],
  };
}

type ReferenceOnlyBatchSource = ExerciseGenerationSuccessMetadata & {
  candidates: ExerciseCandidate[];
};

export function createReferenceOnlyExerciseReviewBatch(batch: ReferenceOnlyBatchSource): ExerciseReviewBatch {
  return {
    eligibility: "reference-only",
    requestedCount: batch.requestedCount,
    validCount: batch.validCount,
    ...(batch.partial_batch ? { partial_batch: true } : {}),
    candidates: batch.candidates.map((candidate) => {
      const referenceCandidate = { ...candidate };
      delete referenceCandidate.arithmeticStructure;
      return { candidate: referenceCandidate, status: "unverified" };
    }),
    selectedVerificationIds: [],
  };
}

function migrateLegacyExerciseReviewBatch(
  batch: Pick<z.infer<typeof legacyExerciseReviewBatchSchema>, "requestedCount" | "validCount" | "partial_batch"> & {
    candidates: { candidate: ExerciseCandidate }[];
  },
): ExerciseReviewBatch {
  return createReferenceOnlyExerciseReviewBatch({
    requestedCount: batch.requestedCount,
    validCount: batch.validCount,
    ...(batch.partial_batch ? { partial_batch: true } : {}),
    candidates: batch.candidates.map(({ candidate }) => candidate),
  });
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
      const parsedLegacyBatch = legacyGenerationBatchSchema.safeParse(parsedValue.batch);
      if (!parsedLegacyBatch.success) {
        clearSessionExerciseBatch(storage);
        return null;
      }
      const migratedBatch = createReferenceOnlyExerciseReviewBatch(parsedLegacyBatch.data);
      storeSessionExerciseBatch(storage, migratedBatch);
      return migratedBatch;
    }

    if (parsedValue.version === 2) {
      const parsedLegacyBatch = legacyExerciseReviewBatchSchema.safeParse(parsedValue.batch);
      if (!parsedLegacyBatch.success) {
        clearSessionExerciseBatch(storage);
        return null;
      }
      const migratedBatch = migrateLegacyExerciseReviewBatch(parsedLegacyBatch.data);
      storeSessionExerciseBatch(storage, migratedBatch);
      return migratedBatch;
    }

    if (parsedValue.version === 3) {
      const parsedLegacyBatch = versionThreeExerciseReviewBatchSchema.safeParse(parsedValue.batch);
      if (!parsedLegacyBatch.success) {
        clearSessionExerciseBatch(storage);
        return null;
      }
      const migratedBatch = migrateLegacyExerciseReviewBatch(parsedLegacyBatch.data);
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
  if (batch.eligibility !== "current") return batch;

  const resultByCandidateId = new Map(results.map((result) => [result.candidateId, result]));
  const candidateIds = new Set(batch.candidates.map(({ candidate }) => candidate.id));
  if (resultByCandidateId.size !== results.length || results.some((result) => !candidateIds.has(result.candidateId))) {
    return batch;
  }

  const candidates: ExerciseReviewCandidate[] = batch.candidates.map((reviewCandidate): ExerciseReviewCandidate => {
    const result = resultByCandidateId.get(reviewCandidate.candidate.id);
    if (reviewCandidate.status !== "unverified" && reviewCandidate.status !== "indeterminate") {
      return reviewCandidate;
    }
    if (!result) return reviewCandidate;
    if (result.outcome === "indeterminate") {
      return { candidate: reviewCandidate.candidate, status: "indeterminate", evidence: result };
    }
    if (
      (result.outcome === "unique_answer" && !isCurrentBoundSuccess(reviewCandidate.candidate, result)) ||
      (result.outcome === "answer_mismatch" && !isCurrentBoundMismatch(reviewCandidate.candidate, result)) ||
      (result.outcome === "unsupported_evidence" && !isCurrentUnsupportedEvidence(reviewCandidate.candidate, result)) ||
      result.outcome === "not_unique_answer"
    ) {
      return reviewCandidate;
    }
    return { candidate: reviewCandidate.candidate, status: result.outcome, evidence: result };
  });
  const successfulVerificationIds = new Set(
    candidates.flatMap((reviewCandidate) =>
      reviewCandidate.status === "unique_answer" &&
      reviewCandidate.evidence.outcome === "unique_answer" &&
      isCurrentBoundSuccess(reviewCandidate.candidate, reviewCandidate.evidence)
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
  if (batch.eligibility !== "current") return batch;

  const isSuccessful = batch.candidates.some(
    (reviewCandidate) =>
      reviewCandidate.status === "unique_answer" &&
      reviewCandidate.evidence.outcome === "unique_answer" &&
      isCurrentBoundSuccess(reviewCandidate.candidate, reviewCandidate.evidence) &&
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
  if (batch.eligibility !== "current") return batch;

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
