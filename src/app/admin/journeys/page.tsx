import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Route, Users, Layers } from "lucide-react";

export const dynamic = "force-dynamic";

async function getTemplates() {
  return prisma.journeyTemplate.findMany({
    include: {
      cluster: true,
      steps: { select: { id: true } },
      userJourneys: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export default async function JourneysPage() {
  const templates = await getTemplates();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Plantillas de Journey
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestiona las plantillas de onboarding y sus pasos
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5 text-xs">
          <Link href="/admin/journeys/new">
            <Plus className="h-3.5 w-3.5" />
            Nueva plantilla
          </Link>
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Route className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No hay plantillas de journey creadas
            </p>
            <Button asChild size="sm" className="mt-4 gap-1.5 text-xs">
              <Link href="/admin/journeys/new">
                <Plus className="h-3.5 w-3.5" />
                Crear primera plantilla
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Link
              key={template.id}
              href={`/admin/journeys/${template.id}`}
              className="block"
            >
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant={template.isActive ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {template.isActive ? "Activa" : "Borrador"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      v{template.version}
                    </span>
                  </div>
                  <CardTitle className="text-sm">{template.name}</CardTitle>
                  {template.description && (
                    <CardDescription className="line-clamp-2 text-xs">
                      {template.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" />
                      {template.steps.length} paso
                      {template.steps.length !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {template.userJourneys.length} usuario
                      {template.userJourneys.length !== 1 ? "s" : ""}
                    </span>
                    {template.cluster && (
                      <span className="truncate">
                        {template.cluster.name} ({template.cluster.country})
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <p className="pb-8 text-center text-[10px] text-muted-foreground">
        Farmatodo Onboarding OS &middot; Journey Builder &middot;{" "}
        {new Date().getFullYear()}
      </p>
    </div>
  );
}
