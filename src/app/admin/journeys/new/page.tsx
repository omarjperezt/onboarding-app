import { prisma } from "@/lib/prisma";
import { NewTemplateForm } from "./new-template-form";

export const dynamic = "force-dynamic";

export default async function NewJourneyPage() {
  const clusters = await prisma.cluster.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Nueva plantilla de Journey
        </h1>
        <p className="text-sm text-muted-foreground">
          Configura los datos básicos para crear una nueva plantilla de
          onboarding
        </p>
      </div>

      <NewTemplateForm clusters={clusters} />
    </div>
  );
}
