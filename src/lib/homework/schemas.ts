import { z } from "zod";

import {
  EXERCISE_DIFFICULTIES,
  EXERCISE_TOPIC_SLUGS,
  HOMEWORK_API_ERROR_CODES,
  type HomeworkApiErrorCode,
} from "@/types";

const uuidSchema = z.uuid();
const nonEmptyStringSchema = z.string().trim().min(1);
const exerciseCountSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const homeworkTopicSchema = z.enum(EXERCISE_TOPIC_SLUGS);
export const homeworkDifficultySchema = z.enum(EXERCISE_DIFFICULTIES);
export const homeworkClassIdSchema = uuidSchema;

export const homeworkAssignmentRequestSchema = z
  .object({
    classId: uuidSchema,
    studentIds: z.array(uuidSchema).min(1),
    title: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((title) => (title === "" ? undefined : title)),
    topic: homeworkTopicSchema,
    difficulty: homeworkDifficultySchema,
    exerciseCount: exerciseCountSchema,
    idempotencyKey: uuidSchema,
  })
  .strict()
  .superRefine(({ studentIds }, context) => {
    if (new Set(studentIds).size !== studentIds.length) {
      context.addIssue({
        code: "custom",
        path: ["studentIds"],
        message: "Selected students must be distinct",
      });
    }
  });

export const homeworkRosterRpcRowSchema = z
  .object({
    student_id: uuidSchema,
    student_email: z.string().trim().toLowerCase().pipe(z.email()),
    joined_at: z.iso.datetime({ offset: true }),
  })
  .strict();

export const homeworkRosterMemberSchema = z
  .object({
    studentId: uuidSchema,
    email: z.string().trim().toLowerCase().pipe(z.email()),
    joinedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const homeworkRosterSuccessSchema = z
  .object({ members: homeworkRosterMemberSchema.array() })
  .strict()
  .superRefine(({ members }, context) => {
    if (new Set(members.map(({ studentId }) => studentId)).size !== members.length) {
      context.addIssue({ code: "custom", path: ["members"], message: "Roster student IDs must be distinct" });
    }
  });

export const homeworkAssignmentRpcRowSchema = z
  .object({
    assignment_id: uuidSchema,
    assignment_title: nonEmptyStringSchema.nullable(),
    assigned_student_ids: uuidSchema.array().min(1),
    excluded_student_ids: uuidSchema.array(),
    created_at: z.iso.datetime({ offset: true }),
    replayed: z.boolean(),
  })
  .strict()
  .superRefine(({ assigned_student_ids: assignedStudentIds, excluded_student_ids: excludedStudentIds }, context) => {
    if (new Set(assignedStudentIds).size !== assignedStudentIds.length) {
      context.addIssue({ code: "custom", path: ["assigned_student_ids"], message: "Assigned IDs must be distinct" });
    }
    if (new Set(excludedStudentIds).size !== excludedStudentIds.length) {
      context.addIssue({ code: "custom", path: ["excluded_student_ids"], message: "Excluded IDs must be distinct" });
    }
    if (assignedStudentIds.some((studentId) => excludedStudentIds.includes(studentId))) {
      context.addIssue({
        code: "custom",
        path: ["excluded_student_ids"],
        message: "Assigned and excluded IDs must differ",
      });
    }
  });

export const homeworkAssignmentSuccessSchema = z
  .object({
    assignmentId: uuidSchema,
    title: nonEmptyStringSchema.nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    assignedCount: z.number().int().min(1),
    excludedStudentIds: uuidSchema.array(),
    excludedCount: z.number().int().min(0),
    replayed: z.boolean(),
  })
  .strict()
  .superRefine(({ excludedStudentIds, excludedCount }, context) => {
    if (excludedStudentIds.length !== excludedCount || new Set(excludedStudentIds).size !== excludedCount) {
      context.addIssue({ code: "custom", path: ["excludedCount"], message: "Excluded count must match excluded IDs" });
    }
  });

export const homeworkApiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.enum(HOMEWORK_API_ERROR_CODES),
        message: nonEmptyStringSchema,
        requiredExerciseCount: z.number().int().min(1).optional(),
        availableExerciseCount: z.number().int().min(0).optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine(({ error }, context) => {
    const hasCapacityDetails = error.requiredExerciseCount !== undefined && error.availableExerciseCount !== undefined;
    if ((error.code === "INSUFFICIENT_POOL") !== hasCapacityDetails) {
      context.addIssue({ code: "custom", path: ["error"], message: "Capacity details must match error code" });
    }
  });

export const homeworkApiErrorCodeSchema = z.enum(HOMEWORK_API_ERROR_CODES);

export function isHomeworkApiErrorCode(value: string): value is HomeworkApiErrorCode {
  return homeworkApiErrorCodeSchema.safeParse(value).success;
}
