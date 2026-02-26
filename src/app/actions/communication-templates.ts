"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toJsonField(
  value: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  if (typeof value === "object" && Object.keys(value).length === 0)
    return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(
    /\{\{(\w+(?:\.\w+)*)\}\}/g,
    (_match, key: string) => vars[key] ?? `{{${key}}}`
  );
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const saveTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  channel: z.enum(["EMAIL", "SMS", "WHATSAPP"]),
  trigger: z.enum([
    "JOURNEY_ASSIGNED",
    "IDENTITY_FLIP",
    "SSO_AUTHENTICATED",
    "MANUAL_TEST",
  ]),
  subject: z.string().nullable().optional(),
  bodyContent: z.string().min(1),
  isActive: z.boolean().optional(),
  conditions: z.record(z.string(), z.unknown()).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function saveCommunicationTemplate(
  data: z.infer<typeof saveTemplateSchema>
) {
  const parsed = saveTemplateSchema.parse(data);

  if (parsed.id) {
    // Update existing
    await prisma.communicationTemplate.update({
      where: { id: parsed.id },
      data: {
        name: parsed.name,
        channel: parsed.channel,
        trigger: parsed.trigger,
        subject: parsed.channel === "EMAIL" ? (parsed.subject ?? null) : null,
        bodyContent: parsed.bodyContent,
        isActive: parsed.isActive ?? true,
        ...(parsed.conditions !== undefined && {
          conditions: toJsonField(parsed.conditions) ?? Prisma.JsonNull,
        }),
      },
    });

    revalidatePath("/admin/communications");
    revalidatePath(`/admin/communications/${parsed.id}`);
    return { id: parsed.id };
  }

  // Create new
  const template = await prisma.communicationTemplate.create({
    data: {
      name: parsed.name,
      channel: parsed.channel,
      trigger: parsed.trigger,
      subject: parsed.channel === "EMAIL" ? (parsed.subject ?? null) : null,
      bodyContent: parsed.bodyContent,
      isActive: parsed.isActive ?? false,
      conditions: toJsonField(parsed.conditions) ?? Prisma.JsonNull,
    },
  });

  revalidatePath("/admin/communications");
  return { id: template.id };
}

export async function deleteCommunicationTemplate(id: string) {
  // Hard delete — also cascades any logs if FK allows, otherwise delete logs first
  await prisma.communicationLog.deleteMany({
    where: { templateId: id },
  });
  await prisma.communicationTemplate.delete({
    where: { id },
  });

  revalidatePath("/admin/communications");
}

export async function testCommunicationTemplate(
  templateId: string,
  testRecipient: string
) {
  const template = await prisma.communicationTemplate.findUniqueOrThrow({
    where: { id: templateId },
  });

  // Build mock variables for test preview
  const vars: Record<string, string> = {
    "user.firstName": "Juan",
    "user.lastName": "Pérez",
    "user.email": testRecipient,
    "user.corporateEmail": "juan.perez@farmatodo.com",
  };

  const subject = template.subject ? interpolate(template.subject, vars) : null;
  const body = interpolate(template.bodyContent, vars);

  // Mock dispatch — real SendGrid comes later
  console.log(
    `[TEST ${template.channel}] to ${testRecipient}:`,
    { subject, body }
  );

  return {
    channel: template.channel,
    recipient: testRecipient,
    subject,
    body,
  };
}
