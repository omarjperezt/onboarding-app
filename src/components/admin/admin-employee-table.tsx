"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, AlertTriangle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeDetailSheet } from "./employee-detail-sheet";

// Serializable type matching the Prisma query shape
export interface EmployeeRow {
  id: string;
  fullName: string;
  personalEmail: string;
  corporateEmail: string | null;
  status: string;
  position: string | null;
  cluster: { name: string; country: string };
  journeys: {
    progressPercentage: number;
    steps: {
      id: string;
      status: string;
      completedAt: string | null;
      templateStep: {
        orderIndex: number;
        title: string;
        description: string | null;
        stepType: string;
      };
    }[];
  }[];
  accessProvisionings: {
    id: string;
    systemName: string;
    status: string;
    jiraTicketId: string | null;
  }[];
}

const statusBadge: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  PRE_HIRE: { label: "Pre-ingreso", variant: "secondary" },
  ACTIVE: { label: "Activo", variant: "default" },
  SUSPENDED: { label: "Suspendido", variant: "destructive" },
};

const countryLabels: Record<string, string> = {
  VE: "Venezuela",
  CO: "Colombia",
  AR: "Argentina",
};

export function AdminEmployeeTable({ users }: { users: EmployeeRow[] }) {
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function openDetail(employee: EmployeeRow) {
    setSelectedEmployee(employee);
    setSheetOpen(true);
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Cluster</TableHead>
            <TableHead>Pais</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Progreso</TableHead>
            <TableHead>Accesos</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const journey = user.journeys[0];
            const progress = journey?.progressPercentage ?? 0;
            const completedSteps =
              journey?.steps.filter((s) => s.status === "COMPLETED").length ??
              0;
            const totalSteps = journey?.steps.length ?? 0;
            const badge = statusBadge[user.status] ?? statusBadge.PRE_HIRE;

            const provisionedCount = user.accessProvisionings.filter(
              (a) => a.status === "PROVISIONED"
            ).length;
            const requestedCount = user.accessProvisionings.filter(
              (a) => a.status === "REQUESTED"
            ).length;

            return (
              <TableRow
                key={user.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => openDetail(user)}
              >
                {/* Employee */}
                <TableCell>
                  <div>
                    <p className="text-sm font-medium">{user.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.corporateEmail ?? user.personalEmail}
                    </p>
                  </div>
                </TableCell>

                {/* Cluster */}
                <TableCell>
                  <span className="text-sm">{user.cluster.name}</span>
                </TableCell>

                {/* Country */}
                <TableCell>
                  <span className="text-sm">
                    {countryLabels[user.cluster.country]}
                  </span>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge variant={badge.variant} className="text-[10px]">
                    {badge.label}
                  </Badge>
                </TableCell>

                {/* Progress */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Progress value={progress} className="h-2 w-20" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {completedSteps}/{totalSteps}
                    </span>
                  </div>
                </TableCell>

                {/* Access */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    {provisionedCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        {provisionedCount}
                      </span>
                    )}
                    {requestedCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        {requestedCount}
                      </span>
                    )}
                    {provisionedCount === 0 && requestedCount === 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        —
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Action */}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetail(user);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <EmployeeDetailSheet
        employee={selectedEmployee}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
