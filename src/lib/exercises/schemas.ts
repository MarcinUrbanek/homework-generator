import { z } from "zod";

import {
  EXERCISE_APPROVAL_ERROR_CODES,
  EXERCISE_DIFFICULTIES,
  EXERCISE_GENERATION_ERROR_CODES,
  EXERCISE_TOPIC_SLUGS,
  EXERCISE_VERIFICATION_ERROR_CODES,
  EXERCISE_VERIFICATION_PROVIDER_ERROR_CODES,
  SAVED_EXERCISE_ERROR_CODES,
  SUPPORTED_ARITHMETIC_TOPIC_SLUGS,
} from "@/types";
import { arithmeticStructureSchema } from "@/lib/exercises/arithmetic-authority";

export const exerciseTopicSlugSchema = z.enum(EXERCISE_TOPIC_SLUGS);
export const supportedArithmeticTopicSchema = z.enum(SUPPORTED_ARITHMETIC_TOPIC_SLUGS);
export const exerciseDifficultySchema = z.enum(EXERCISE_DIFFICULTIES);
const validExerciseCountSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const exerciseGenerationRequestSchema = z
  .object({
    grade: z.literal(4),
    topic: exerciseTopicSlugSchema,
    difficulty: exerciseDifficultySchema,
  })
  .strict();

export const exerciseCandidateSchema = exerciseGenerationRequestSchema.extend({
  id: z.string().trim().min(1),
  text: z
    .string()
    .min(1)
    .refine((value) => value.trim().length > 0),
  proposedCanonicalAnswer: z
    .string()
    .min(1)
    .refine((value) => value.trim().length > 0),
  approvalStatus: z.literal("unverified"),
  arithmeticStructure: z.unknown().optional(),
});

export const generatedExerciseCandidateSchema = exerciseCandidateSchema
  .extend({
    topic: supportedArithmeticTopicSchema,
    arithmeticStructure: arithmeticStructureSchema,
  })
  .strict();

export const exerciseGenerationSuccessMetadataSchema = z
  .object({
    requestedCount: z.literal(5),
    validCount: validExerciseCountSchema,
    partial_batch: z.literal(true).optional(),
  })
  .strict()
  .superRefine((metadata, context) => {
    const isPartial = metadata.validCount < metadata.requestedCount;

    if (isPartial !== (metadata.partial_batch === true)) {
      context.addIssue({
        code: "custom",
        path: ["partial_batch"],
        message: "partial_batch must be present only for an incomplete batch",
      });
    }
  });

export const exerciseGenerationSuccessSchema = z
  .object({
    requestedCount: z.literal(5),
    validCount: validExerciseCountSchema,
    partial_batch: z.literal(true).optional(),
    candidates: z.array(generatedExerciseCandidateSchema).min(1).max(5),
  })
  .strict()
  .superRefine((response, context) => {
    if (response.candidates.length !== response.validCount) {
      context.addIssue({
        code: "custom",
        path: ["validCount"],
        message: "validCount must match the number of candidates",
      });
    }

    const isPartial = response.validCount < response.requestedCount;

    if (isPartial !== (response.partial_batch === true)) {
      context.addIssue({
        code: "custom",
        path: ["partial_batch"],
        message: "partial_batch must be present only for an incomplete batch",
      });
    }
  });

export const exerciseGenerationErrorSchema = z
  .object({
    error: z
      .object({
        code: z.enum(EXERCISE_GENERATION_ERROR_CODES),
        message: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict();

export const exerciseGenerationAdmissionResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("admitted"),
      reservation_id: z.uuid(),
    })
    .strict(),
  z
    .object({
      status: z.literal("quota-exceeded"),
      retry_after_seconds: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      status: z.literal("in-progress"),
      retry_after_seconds: z.number().int().positive(),
    })
    .strict(),
]);

export const exerciseGenerationReleaseResultSchema = z.boolean();

const uuidSchema = z.uuid();
const nonEmptyStringSchema = z.string().trim().min(1);

export const exerciseVerificationRequestSchema = z
  .object({
    candidates: z.array(exerciseCandidateSchema).min(1).max(5),
  })
  .strict()
  .superRefine(({ candidates }, context) => {
    const candidateIds = candidates.map(({ id }) => id);
    if (new Set(candidateIds).size !== candidateIds.length) {
      context.addIssue({
        code: "custom",
        path: ["candidates"],
        message: "Candidate IDs must be distinct",
      });
    }
  });

const persistedExerciseVerificationBaseSchema = z.object({
  verificationId: uuidSchema,
  candidateId: nonEmptyStringSchema,
  rationale: nonEmptyStringSchema,
  verifierIdentity: nonEmptyStringSchema,
  verifierVersion: nonEmptyStringSchema,
  verifiedAt: z.iso.datetime({ offset: true }),
  arithmeticStructure: z.unknown().nullable(),
  authorityVersion: z.number().int().positive().nullable(),
});

export const persistedExerciseVerificationSchema = z.discriminatedUnion("outcome", [
  persistedExerciseVerificationBaseSchema
    .extend({
      outcome: z.literal("unique_answer"),
      verifiedAnswer: nonEmptyStringSchema,
    })
    .strict(),
  persistedExerciseVerificationBaseSchema
    .extend({
      outcome: z.literal("answer_mismatch"),
      verifiedAnswer: nonEmptyStringSchema,
    })
    .strict(),
  persistedExerciseVerificationBaseSchema
    .extend({
      outcome: z.literal("not_unique_answer"),
      verifiedAnswer: z.null(),
    })
    .strict(),
  persistedExerciseVerificationBaseSchema
    .extend({
      outcome: z.literal("unsupported_evidence"),
      verifiedAnswer: z.null(),
    })
    .strict(),
]);

export const indeterminateExerciseVerificationSchema = z
  .object({
    candidateId: nonEmptyStringSchema,
    outcome: z.literal("indeterminate"),
    error: z
      .object({
        code: z.enum(EXERCISE_VERIFICATION_PROVIDER_ERROR_CODES),
        message: nonEmptyStringSchema,
      })
      .strict(),
  })
  .strict();

export const exerciseVerificationResultSchema = z.discriminatedUnion("outcome", [
  ...persistedExerciseVerificationSchema.options,
  indeterminateExerciseVerificationSchema,
]);

export const exerciseVerificationSuccessSchema = z
  .object({
    results: z.array(exerciseVerificationResultSchema).min(1).max(5),
  })
  .strict()
  .superRefine(({ results }, context) => {
    const candidateIds = results.map(({ candidateId }) => candidateId);
    if (new Set(candidateIds).size !== candidateIds.length) {
      context.addIssue({
        code: "custom",
        path: ["results"],
        message: "Verification result candidate IDs must be distinct",
      });
    }
    results.forEach((result, index) => {
      if (
        (result.outcome === "unique_answer" || result.outcome === "answer_mismatch") &&
        (result.authorityVersion !== 1 || !arithmeticStructureSchema.safeParse(result.arithmeticStructure).success)
      ) {
        context.addIssue({
          code: "custom",
          path: ["results", index],
          message: "Settled arithmetic evidence must carry the current supported structure",
        });
      }
    });
  });

export const exerciseVerificationErrorSchema = z
  .object({
    error: z
      .object({
        code: z.enum(EXERCISE_VERIFICATION_ERROR_CODES),
        message: nonEmptyStringSchema,
      })
      .strict(),
  })
  .strict();

export const exerciseApprovalRequestSchema = z
  .object({
    verificationIds: z.array(uuidSchema).min(1).max(5),
  })
  .strict()
  .superRefine(({ verificationIds }, context) => {
    if (new Set(verificationIds).size !== verificationIds.length) {
      context.addIssue({
        code: "custom",
        path: ["verificationIds"],
        message: "Verification IDs must be distinct",
      });
    }
  });

export const exerciseApprovalMappingSchema = z
  .object({
    verificationId: uuidSchema,
    exerciseId: uuidSchema,
    created: z.boolean(),
  })
  .strict();

export const exerciseApprovalSuccessSchema = z
  .object({
    mappings: z.array(exerciseApprovalMappingSchema).min(1).max(5),
  })
  .strict();

export const exerciseApprovalErrorSchema = z
  .object({
    error: z
      .object({
        code: z.enum(EXERCISE_APPROVAL_ERROR_CODES),
        message: nonEmptyStringSchema,
      })
      .strict(),
  })
  .strict();

export const exerciseVerificationLedgerRowSchema = z
  .object({
    id: uuidSchema,
    teacher_id: uuidSchema,
    candidate_id: nonEmptyStringSchema,
    candidate_text: nonEmptyStringSchema,
    proposed_canonical_answer: nonEmptyStringSchema,
    grade: z.literal("4"),
    topic: exerciseTopicSlugSchema,
    difficulty: exerciseDifficultySchema,
    outcome: z.enum(["unique_answer", "answer_mismatch", "not_unique_answer", "unsupported_evidence"]),
    verified_answer: nonEmptyStringSchema.nullable(),
    arithmetic_structure: z.unknown().nullable(),
    authority_version: z.number().int().positive().nullable(),
    verifier_identity: nonEmptyStringSchema,
    verifier_version: nonEmptyStringSchema,
    verified_at: z.iso.datetime({ offset: true }),
    rationale: nonEmptyStringSchema,
  })
  .strict()
  .superRefine((row, context) => {
    const requiresAnswer = row.outcome === "unique_answer" || row.outcome === "answer_mismatch";
    if (requiresAnswer !== (row.verified_answer !== null)) {
      context.addIssue({
        code: "custom",
        path: ["verified_answer"],
        message: "Verified answer must match the verification outcome",
      });
    }
  });

export const exerciseApprovalRpcRowSchema = z
  .object({
    verification_id: uuidSchema,
    exercise_id: uuidSchema,
    created: z.boolean(),
  })
  .strict();

export const savedExerciseFiltersSchema = z
  .object({
    grade: z.literal(4),
    topic: exerciseTopicSlugSchema,
    difficulty: exerciseDifficultySchema.optional(),
  })
  .strict();

export const savedExerciseCursorSchema = savedExerciseFiltersSchema
  .extend({
    approvedAt: z.iso.datetime({ offset: true }),
    id: uuidSchema,
  })
  .strict();

export const savedExerciseRetrievalRowSchema = z
  .object({
    id: uuidSchema,
    exercise_text: nonEmptyStringSchema,
    canonical_answer: nonEmptyStringSchema,
    grade: z.literal("4"),
    topic: exerciseTopicSlugSchema,
    difficulty: exerciseDifficultySchema,
    approved_at: z.iso.datetime({ offset: true }),
  })
  .strict();

export const savedExerciseSuccessSchema = z
  .object({
    exercises: z
      .array(
        savedExerciseFiltersSchema.extend({
          difficulty: exerciseDifficultySchema,
          id: uuidSchema,
          text: nonEmptyStringSchema,
          canonicalAnswer: nonEmptyStringSchema,
          approvedAt: z.iso.datetime({ offset: true }),
        }),
      )
      .max(20),
    nextCursor: nonEmptyStringSchema.nullable(),
  })
  .strict();

export const savedExerciseErrorSchema = z
  .object({
    error: z
      .object({
        code: z.enum(SAVED_EXERCISE_ERROR_CODES),
        message: nonEmptyStringSchema,
      })
      .strict(),
  })
  .strict();
