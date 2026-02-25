import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { TemplateInfoForm } from "@/components/admin/journey-builder/template-info-form";
import { StepList } from "@/components/admin/journey-builder/step-list";
import { JourneyPreview } from "@/components/admin/journey-builder/journey-preview";
import type { StepConditions, ContentPayload } from "@/lib/journey-engine/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ templateId: string }>;
}

async function getTemplateWithSteps(templateId: string) {
  const template = await prisma.journeyTemplate.findUnique({
    where: { id: templateId },
    include: {
      cluster: true,
      steps: { orderBy: { orderIndex: "asc" } },
    },
  });

  if (!template) return null;
  return template;
}

export default async function TemplateBuilderPage({ params }: PageProps) {
  const { templateId } = await params;
  const [template, clusters] = await Promise.all([
    getTemplateWithSteps(templateId),
    prisma.cluster.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!template) notFound();

  const serializedSteps = template.steps.map((step) => ({
    id: step.id,
    orderIndex: step.orderIndex,
    title: step.title,
    description: step.description,
    stepType: step.stepType,
    isOptional: step.isOptional,
    estimatedMinutes: step.estimatedMinutes,
    iconName: step.iconName,
    conditions: (step.conditions as StepConditions | null) ?? null,
    contentPayload:
      (step.contentPayload as ContentPayload | null) ?? null,
  }));

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Simulate button */}
      <div className="flex items-center justify-between">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground">
          <Link
            href="/admin/journeys"
            className="hover:text-foreground transition-colors"
          >
            Journeys
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-foreground">{template.name}</span>
        </nav>
        <JourneyPreview templateId={template.id} clusters={clusters} />
      </div>

      {/* Template Info */}
      <TemplateInfoForm
        template={{
          id: template.id,
          name: template.name,
          description: template.description,
          clusterId: template.clusterId,
          isActive: template.isActive,
          version: template.version,
        }}
        clusters={clusters}
      />

      <Separator />

      {/* Steps */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">
          Pasos ({template.steps.length})
        </h2>
        <StepList
          templateId={template.id}
          steps={serializedSteps}
          clusters={clusters}
        />
      </div>

      <p className="pb-8 text-center text-[10px] text-muted-foreground">
        Farmatodo Onboarding OS &middot; Journey Builder &middot;{" "}
        {new Date().getFullYear()}
      </p>
    </div>
  );
}
