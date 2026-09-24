import { z } from "zod";

import { EXERCISE_DIFFICULTIES, EXERCISE_GENERATION_ERROR_CODES, EXERCISE_TOPIC_SLUGS } from "@/types";

export const exerciseTopicSlugSchema = z.enum(EXERCISE_TOPIC_SLUGS);
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
  text: z.string().trim().min(1),
  proposedCanonicalAnswer: z.string().trim().min(1),
  approvalStatus: z.literal("unverified"),
});

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
    candidates: z.array(exerciseCandidateSchema).min(1).max(5),
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
