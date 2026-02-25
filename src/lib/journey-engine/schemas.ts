import { z } from "zod";

export const stepConditionsSchema = z
  .object({
    country: z.array(z.enum(["VE", "CO", "AR"])).optional(),
    cluster: z.array(z.string().min(1)).optional(),
    position: z.array(z.string().min(1)).optional(),
    userStatus: z
      .array(z.enum(["PRE_HIRE", "ACTIVE", "SUSPENDED"]))
      .optional(),
    requiresCorporateEmail: z.boolean().optional(),
    requiresSsoAuth: z.boolean().optional(),
    hiredAfter: z.string().datetime().optional(),
    hiredBefore: z.string().datetime().optional(),
    tags: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const contentBlockSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["RICH_TEXT", "VIDEO_EMBED", "PDF_LINK", "CHECKLIST", "FORM_LINK"]),
  value: z.string(),
  meta: z
    .object({
      label: z.string().optional(),
      thumbnailUrl: z.string().url().optional(),
      fileName: z.string().optional(),
      checklistItems: z.array(z.string()).optional(),
    })
    .optional(),
});

export const contentPayloadSchema = z.object({
  blocks: z.array(contentBlockSchema).min(1),
});

export type StepConditionsInput = z.infer<typeof stepConditionsSchema>;
export type ContentPayloadInput = z.infer<typeof contentPayloadSchema>;
