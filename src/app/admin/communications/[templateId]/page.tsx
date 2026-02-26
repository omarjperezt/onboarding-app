import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { TemplateBuilder } from "@/components/admin/communications/template-builder";
import type { StepConditions } from "@/lib/journey-engine/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ templateId: string }>;
}

export default async function CommunicationTemplatePage({ params }: Props) {
  const { templateId } = await params;

  const isNew = templateId === "new";

  const template = isNew
    ? null
    : await prisma.communicationTemplate.findUnique({
        where: { id: templateId },
      });

  if (!isNew && !template) notFound();

  // Serialize JSONB at server level before passing to client
  const serialized = template
    ? {
        id: template.id,
        name: template.name,
        channel: template.channel,
        trigger: template.trigger,
        subject: template.subject,
        bodyContent: template.bodyContent,
        isActive: template.isActive,
        conditions: (template.conditions as StepConditions | null) ?? null,
      }
    : null;

  return (
    <div className="space-y-4">
      <TemplateBuilder template={serialized} />
    </div>
  );
}
