import { z } from "zod";

import { CLASS_API_ERROR_CODES } from "@/types";

const uuidSchema = z.uuid();
const nonEmptyStringSchema = z.string().trim().min(1);
const normalizedEmailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const createClassRequestSchema = z
  .object({
    name: nonEmptyStringSchema,
  })
  .strict();

export const inviteStudentsRequestSchema = z
  .object({
    classId: uuidSchema,
    emails: z.array(normalizedEmailSchema).min(1).max(50),
  })
  .strict()
  .superRefine(({ emails }, context) => {
    if (new Set(emails).size !== emails.length) {
      context.addIssue({
        code: "custom",
        path: ["emails"],
        message: "Invitation emails must be unique",
      });
    }
  });

export const classSummarySchema = z
  .object({
    id: uuidSchema,
    name: nonEmptyStringSchema,
    classCode: z.string().regex(/^[A-Z0-9]{8}$/),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const invitationDeliveryResultSchema = z
  .object({
    email: normalizedEmailSchema,
    status: z.enum(["sent", "refreshed", "failed"]),
  })
  .strict();

export const classApiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.enum(CLASS_API_ERROR_CODES),
        message: nonEmptyStringSchema,
      })
      .strict(),
  })
  .strict();
