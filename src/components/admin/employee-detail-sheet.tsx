"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  Clock,
  Lock,
  XCircle,
  Mail,
  RefreshCw,
  Building2,
  MapPin,
  User,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import type { EmployeeRow } from "./admin-employee-table";

interface EmployeeDetailSheetProps {
  employee: EmployeeRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusBadge: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  PRE_HIRE: { label: "Pre-ingreso", variant: "secondary" },
  ACTIVE: { label: "Activo", variant: "default" },
  SUSPENDED: { label: "Suspendido", variant: "destructive" },
};

const stepStatusConfig: Record<
  string,
  { icon: typeof CheckCircle2; label: string; color: string }
> = {
  COMPLETED: {
    icon: CheckCircle2,
    label: "Completado",
    color: "text-emerald-600",
  },
  PENDING: { icon: Clock, label: "Pendiente", color: "text-amber-600" },
  LOCKED: { icon: Lock, label: "Bloqueado", color: "text-zinc-400" },
};

const accessStatusConfig: Record<
  string,
  {
    icon: typeof CheckCircle2;
    label: string;
    variant: "default" | "secondary" | "destructive";
  }
> = {
  PROVISIONED: {
    icon: CheckCircle2,
    label: "Habilitado",
    variant: "default",
  },
  REQUESTED: { icon: Clock, label: "Solicitado", variant: "secondary" },
  REVOKED: { icon: XCircle, label: "Revocado", variant: "destructive" },
};

const countryLabels: Record<string, string> = {
  VE: "Venezuela",
  CO: "Colombia",
  AR: "Argentina",
};

export function EmployeeDetailSheet({
  employee,
  open,
  onOpenChange,
}: EmployeeDetailSheetProps) {
  if (!employee) return null;

  const badge = statusBadge[employee.status] ?? statusBadge.PRE_HIRE;
  const journey = employee.journeys[0];
  const progress = journey?.progressPercentage ?? 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <SheetTitle className="text-lg">{employee.fullName}</SheetTitle>
            <Badge variant={badge.variant} className="text-[10px]">
              {badge.label}
            </Badge>
          </div>
          <SheetDescription className="sr-only">
            Detalle del empleado {employee.fullName}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-4 px-1">
          {/* ─── Info del Empleado ─── */}
          <div className="grid grid-cols-2 gap-3">
            <InfoItem
              icon={Briefcase}
              label="Cargo"
              value={employee.position ?? "—"}
            />
            <InfoItem
              icon={Building2}
              label="Cluster"
              value={employee.cluster.name}
            />
            <InfoItem
              icon={MapPin}
              label="Pais"
              value={countryLabels[employee.cluster.country]}
            />
            <InfoItem
              icon={User}
              label="Email"
              value={employee.corporateEmail ?? employee.personalEmail}
            />
          </div>

          <Separator />

          {/* ─── Progreso del Journey ─── */}
          <section>
            <h3 className="mb-3 text-sm font-semibold">
              Progreso del Journey
            </h3>

            {journey ? (
              <>
                <div className="mb-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {
                        journey.steps.filter((s) => s.status === "COMPLETED")
                          .length
                      }{" "}
                      de {journey.steps.length} pasos
                    </span>
                    <span className="font-bold text-primary">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                <div className="space-y-2">
                  {journey.steps.map((step) => {
                    const config =
                      stepStatusConfig[step.status] ??
                      stepStatusConfig.LOCKED;
                    const StepIcon = config.icon;

                    return (
                      <div
                        key={step.id}
                        className="flex items-center gap-3 rounded-lg border bg-card p-2.5"
                      >
                        <StepIcon
                          className={`h-4 w-4 shrink-0 ${config.color}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">
                            {step.templateStep.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Paso {step.templateStep.orderIndex} &middot;{" "}
                            {config.label}
                          </p>
                        </div>
                        {step.completedAt && (
                          <span className="text-[10px] text-emerald-600 whitespace-nowrap">
                            {new Date(step.completedAt).toLocaleDateString(
                              "es-VE",
                              { day: "numeric", month: "short" }
                            )}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin journey asignado
              </p>
            )}
          </section>

          <Separator />

          {/* ─── Matriz de Accesos ─── */}
          <section>
            <h3 className="mb-3 text-sm font-semibold">Matriz de Accesos</h3>

            {employee.accessProvisionings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Sistema</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-xs">Ticket Jira</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.accessProvisionings.map((access) => {
                    const config =
                      accessStatusConfig[access.status] ??
                      accessStatusConfig.REQUESTED;

                    return (
                      <TableRow key={access.id}>
                        <TableCell className="text-xs font-medium">
                          {access.systemName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={config.variant}
                            className={`text-[10px] ${
                              access.status === "PROVISIONED"
                                ? "bg-emerald-600 hover:bg-emerald-600"
                                : ""
                            }`}
                          >
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {access.jiraTicketId ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin accesos registrados
              </p>
            )}
          </section>

          <Separator />

          {/* ─── Acciones Administrativas ─── */}
          <section>
            <h3 className="mb-3 text-sm font-semibold">
              Acciones Administrativas
            </h3>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 text-xs"
                onClick={() => {
                  toast.success("Correo de bienvenida reenviado", {
                    description: `Se envio a ${employee.corporateEmail ?? employee.personalEmail}`,
                  });
                }}
              >
                <Mail className="h-3.5 w-3.5" />
                Reenviar correo de bienvenida
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 text-xs"
                onClick={() => {
                  toast.success("Sincronizacion con Jira iniciada", {
                    description: `Actualizando datos de ${employee.fullName}`,
                  });
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Forzar sincronizacion con Jira
              </Button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="truncate text-xs font-medium">{value}</p>
      </div>
    </div>
  );
}
