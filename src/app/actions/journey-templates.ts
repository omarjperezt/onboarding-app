"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  clusterId: z.string().uuid().nullable().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  clusterId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function createTemplate(
  data: z.infer<typeof createTemplateSchema>
) {
  const parsed = createTemplateSchema.parse(data);

  const template = await prisma.journeyTemplate.create({
    data: {
      name: parsed.name,
      description: parsed.description ?? null,
      clusterId: parsed.clusterId ?? null,
      version: 1,
      isActive: false,
    },
  });

  revalidatePath("/admin/journeys");
  return { id: template.id };
}

export async function updateTemplate(
  templateId: string,
  data: z.infer<typeof updateTemplateSchema>
) {
  const parsed = updateTemplateSchema.parse(data);

  await prisma.journeyTemplate.update({
    where: { id: templateId },
    data: parsed,
  });

  revalidatePath("/admin/journeys");
  revalidatePath(`/admin/journeys/${templateId}`);
}

export async function toggleTemplateActive(templateId: string) {
  const template = await prisma.journeyTemplate.findUniqueOrThrow({
    where: { id: templateId },
  });

  await prisma.journeyTemplate.update({
    where: { id: templateId },
    data: { isActive: !template.isActive },
  });

  revalidatePath("/admin/journeys");
  revalidatePath(`/admin/journeys/${templateId}`);
}

export async function publishNewVersion(templateId: string) {
  const template = await prisma.journeyTemplate.update({
    where: { id: templateId },
    data: { version: { increment: 1 } },
  });

  revalidatePath("/admin/journeys");
  revalidatePath(`/admin/journeys/${templateId}`);
  return { version: template.version };
}
