import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Plus, Mail, MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

const TRIGGER_LABELS: Record<string, string> = {
  JOURNEY_ASSIGNED: "Journey Asignado",
  IDENTITY_FLIP: "Identity Flip",
  SSO_AUTHENTICATED: "SSO Autenticado",
  MANUAL_TEST: "Test Manual",
};

async function getTemplates() {
  return prisma.communicationTemplate.findMany({
    include: {
      communicationLogs: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export default async function CommunicationsPage() {
  const templates = await getTemplates();

  const emailTemplates = templates.filter((t) => t.channel === "EMAIL");
  const messagingTemplates = templates.filter(
    (t) => t.channel === "SMS" || t.channel === "WHATSAPP"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Centro de Comunicaciones
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestiona plantillas de correo electrónico, SMS y WhatsApp
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5 text-xs">
          <Link href="/admin/communications/new">
            <Plus className="h-3.5 w-3.5" />
            Crear Plantilla
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="email">
        <TabsList>
          <TabsTrigger value="email" className="gap-1.5 text-xs">
            <Mail className="h-3.5 w-3.5" />
            Correos Electrónicos
            {emailTemplates.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {emailTemplates.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="messaging" className="gap-1.5 text-xs">
            <MessageSquare className="h-3.5 w-3.5" />
            Mensajería (SMS/WA)
            {messagingTemplates.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {messagingTemplates.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4">
          {emailTemplates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Sin plantillas de correo
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Crea tu primera plantilla con editor HTML y vista previa en
                  tiempo real.
                </p>
                <Button asChild size="sm" className="mt-4 gap-1.5 text-xs">
                  <Link href="/admin/communications/new">
                    <Plus className="h-3.5 w-3.5" />
                    Crear plantilla de correo
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {emailTemplates.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/communications/${t.id}`}
                  className="block"
                >
                  <TemplateCard template={t} />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="messaging" className="mt-4">
          {messagingTemplates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Sin plantillas de mensajería
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Crea tu primera plantilla de SMS o WhatsApp con texto plano.
                </p>
                <Button asChild size="sm" className="mt-4 gap-1.5 text-xs">
                  <Link href="/admin/communications/new">
                    <Plus className="h-3.5 w-3.5" />
                    Crear plantilla de mensajería
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {messagingTemplates.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/communications/${t.id}`}
                  className="block"
                >
                  <TemplateCard template={t} />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <p className="pb-8 text-center text-[10px] text-muted-foreground">
        Farmatodo Onboarding OS &middot; Centro de Comunicaciones &middot;{" "}
        {new Date().getFullYear()}
      </p>
    </div>
  );
}

function TemplateCard({
  template,
}: {
  template: Awaited<ReturnType<typeof getTemplates>>[number];
}) {
  return (
    <Card className="transition-colors hover:bg-muted/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Badge
            variant={template.isActive ? "default" : "secondary"}
            className="text-[10px]"
          >
            {template.isActive ? "Activa" : "Borrador"}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {template.channel}
          </Badge>
        </div>
        <CardTitle className="text-sm">{template.name}</CardTitle>
        {template.subject && (
          <CardDescription className="line-clamp-1 text-xs">
            Asunto: {template.subject}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{TRIGGER_LABELS[template.trigger] ?? template.trigger}</span>
          <span>
            {template.communicationLogs.length} envío
            {template.communicationLogs.length !== 1 ? "s" : ""}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
