"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  stepConditionsSchema,
  contentPayloadSchema,
} from "@/lib/journey-engine/schemas";

const createStepSchema = z.object({
  journeyTemplateId: z.string().uuid(),
  title: z.string().min(1),
  stepType: z.enum(["INFO", "ACTION", "APPROVAL"]),
  description: z.string().nullable().optional(),
  isOptional: z.boolean().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  iconName: z.string().nullable().optional(),
  conditions: stepConditionsSchema.nullable().optional(),
  contentPayload: contentPayloadSchema.nullable().optional(),
});

const updateStepSchema = z.object({
  title: z.string().min(1).optional(),
  stepType: z.enum(["INFO", "ACTION", "APPROVAL"]).optional(),
  description: z.string().nullable().optional(),
  isOptional: z.boolean().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  iconName: z.string().nullable().optional(),
  conditions: stepConditionsSchema.nullable().optional(),
  contentPayload: contentPayloadSchema.nullable().optional(),
});

export async function createStep(
  data: z.infer<typeof createStepSchema>
) {
  const parsed = createStepSchema.parse(data);

  const maxOrder = await prisma.templateStep.aggregate({
    where: { journeyTemplateId: parsed.journeyTemplateId },
    _max: { orderIndex: true },
  });

  const nextOrder = (maxOrder._max.orderIndex ?? 0) + 1;

  const step = await prisma.templateStep.create({
    data: {
      journeyTemplateId: parsed.journeyTemplateId,
      orderIndex: nextOrder,
      title: parsed.title,
      description: parsed.description ?? null,
      stepType: parsed.stepType,
      isOptional: parsed.isOptional ?? false,
      estimatedMinutes: parsed.estimatedMinutes ?? null,
      iconName: parsed.iconName ?? null,
      conditions: parsed.conditions ?? undefined,
      contentPayload: parsed.contentPayload ?? undefined,
    },
  });

  revalidatePath(`/admin/journeys/${parsed.journeyTemplateId}`);
  return { id: step.id };
}

function toJsonField(
  value: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export async function updateStep(
  stepId: string,
  data: z.infer<typeof updateStepSchema>
) {
  const parsed = updateStepSchema.parse(data);

  const step = await prisma.templateStep.update({
    where: { id: stepId },
    data: {
      ...(parsed.title !== undefined && { title: parsed.title }),
      ...(parsed.stepType !== undefined && { stepType: parsed.stepType }),
      ...(parsed.description !== undefined && {
        description: parsed.description,
      }),
      ...(parsed.isOptional !== undefined && {
        isOptional: parsed.isOptional,
      }),
      ...(parsed.estimatedMinutes !== undefined && {
        estimatedMinutes: parsed.estimatedMinutes,
      }),
      ...(parsed.iconName !== undefined && { iconName: parsed.iconName }),
      ...(parsed.conditions !== undefined && {
        conditions: toJsonField(parsed.conditions),
      }),
      ...(parsed.contentPayload !== undefined && {
        contentPayload: toJsonField(parsed.contentPayload),
      }),
    },
  });

  revalidatePath(`/admin/journeys/${step.journeyTemplateId}`);
}

export async function deleteStep(stepId: string) {
  const step = await prisma.templateStep.findUniqueOrThrow({
    where: { id: stepId },
    select: { journeyTemplateId: true, orderIndex: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.templateStep.delete({ where: { id: stepId } });

    await tx.templateStep.updateMany({
      where: {
        journeyTemplateId: step.journeyTemplateId,
        orderIndex: { gt: step.orderIndex },
      },
      data: { orderIndex: { decrement: 1 } },
    });
  });

  revalidatePath(`/admin/journeys/${step.journeyTemplateId}`);
}

export async function reorderSteps(
  templateId: string,
  orderedStepIds: string[]
) {
  const toNegative = orderedStepIds.map((id, index) =>
    prisma.templateStep.update({
      where: { id },
      data: { orderIndex: -(index + 1) },
    })
  );

  const toFinal = orderedStepIds.map((id, index) =>
    prisma.templateStep.update({
      where: { id },
      data: { orderIndex: index + 1 },
    })
  );

  await prisma.$transaction([...toNegative, ...toFinal]);

  revalidatePath(`/admin/journeys/${templateId}`);
}
