"use client";

import { useState, useTransition } from "react";
import {
  previewCompilation,
  type PreviewCompilationResult,
} from "@/app/actions/preview-compilation";
import type { UserProfile } from "@/lib/journey-engine/types";
import type { Country, UserStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CheckCircle2, XCircle, Eye, Loader2 } from "lucide-react";

interface Cluster {
  id: string;
  name: string;
  country: Country;
}

interface JourneyPreviewProps {
  templateId: string;
  clusters: Cluster[];
}

const countryLabels: Record<Country, string> = {
  VE: "Venezuela",
  CO: "Colombia",
  AR: "Argentina",
};

const statusLabels: Record<UserStatus, string> = {
  PRE_HIRE: "Pre-ingreso",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
};

export function JourneyPreview({ templateId, clusters }: JourneyPreviewProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<PreviewCompilationResult | null>(null);

  const [country, setCountry] = useState<Country>("VE");
  const [clusterName, setClusterName] = useState(clusters[0]?.name ?? "");
  const [position, setPosition] = useState("");
  const [status, setStatus] = useState<UserStatus>("PRE_HIRE");
  const [hasCorporateEmail, setHasCorporateEmail] = useState(false);
  const [hasSsoAuth, setHasSsoAuth] = useState(false);

  function handlePreview() {
    const profile: UserProfile = {
      country,
      clusterName,
      position: position || null,
      status,
      hasCorporateEmail,
      hasSsoAuth,
      createdAt: new Date(),
      tags: [],
    };

    startTransition(async () => {
      const data = await previewCompilation(templateId, profile);
      setResult(data);
    });
  }

  const filteredClusters = clusters.filter((c) => c.country === country);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Eye className="h-3.5 w-3.5" />
          Simular Vista de Empleado
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4" />
            Simulador de Reglas
          </SheetTitle>
          <SheetDescription>
            Configura el perfil de un empleado ficticio para verificar que pasos
            del journey le serian asignados segun las reglas definidas.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 pt-4">
          {/* Profile form */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Perfil del empleado
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Pais</Label>
                <Select
                  value={country}
                  onValueChange={(v) => {
                    const newCountry = v as Country;
                    setCountry(newCountry);
                    const firstCluster = clusters.find(
                      (c) => c.country === newCountry
                    );
                    if (firstCluster) setClusterName(firstCluster.name);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["VE", "CO", "AR"] as const).map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">
                        {countryLabels[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Cluster</Label>
                <Select value={clusterName} onValueChange={setClusterName}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredClusters.map((c) => (
                      <SelectItem key={c.id} value={c.name} className="text-xs">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cargo</Label>
                <Input
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Ej: Auxiliar de Punto de Venta"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as UserStatus)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["PRE_HIRE", "ACTIVE", "SUSPENDED"] as const).map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {statusLabels[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="preview-corp-email"
                  checked={hasCorporateEmail}
                  onCheckedChange={setHasCorporateEmail}
                />
                <Label htmlFor="preview-corp-email" className="text-xs">
                  Tiene correo corporativo
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="preview-sso"
                  checked={hasSsoAuth}
                  onCheckedChange={setHasSsoAuth}
                />
                <Label htmlFor="preview-sso" className="text-xs">
                  Autenticado con Google
                </Label>
              </div>
            </div>
          </div>

          <Button
            onClick={handlePreview}
            disabled={isPending}
            size="sm"
            className="w-full gap-2"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            Probar reglas del Journey
          </Button>

          {/* Results */}
          {result && (
            <>
              <Separator />

              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Resultado
                </h3>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="default" className="text-xs">
                    {result.includedCount} de {result.totalSteps} pasos se
                    asignarian
                  </Badge>
                  {result.excludedCount > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {result.excludedCount}{" "}
                      {result.excludedCount === 1
                        ? "no aplica"
                        : "no aplican"}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  {result.steps.map((step) => (
                    <div
                      key={step.stepId}
                      className={`rounded-lg border px-3 py-2.5 text-xs ${
                        step.included
                          ? "border-emerald-200 bg-emerald-50/80"
                          : "border-zinc-200 bg-zinc-50/80"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {step.included ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold leading-snug">
                            Paso {step.orderIndex}: {step.title}
                          </p>
                          <p
                            className={`mt-1 leading-relaxed ${
                              step.included
                                ? "text-emerald-700"
                                : "text-muted-foreground"
                            }`}
                          >
                            {step.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
