"use client";

import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AccessStatus } from "@prisma/client";

interface AccessItem {
  id: string;
  systemName: string;
  status: AccessStatus;
  jiraTicketId: string | null;
}

const accessStatusConfig: Record<
  AccessStatus,
  { icon: typeof CheckCircle2; label: string; badgeVariant: "default" | "secondary" | "destructive" }
> = {
  PROVISIONED: {
    icon: CheckCircle2,
    label: "Habilitado",
    badgeVariant: "default",
  },
  REQUESTED: {
    icon: Clock,
    label: "Solicitado",
    badgeVariant: "secondary",
  },
  REVOKED: {
    icon: XCircle,
    label: "Revocado",
    badgeVariant: "destructive",
  },
};

export function AccessList({ accesses }: { accesses: AccessItem[] }) {
  if (accesses.length === 0) return null;

  return (
    <div className="space-y-2">
      {accesses.map((access) => {
        const config = accessStatusConfig[access.status];
        const Icon = config.icon;
        return (
          <div
            key={access.id}
            className="flex items-center justify-between rounded-lg border bg-card p-3"
          >
            <div className="flex items-center gap-3">
              <Icon
                className={`h-4 w-4 ${
                  access.status === "PROVISIONED"
                    ? "text-emerald-500"
                    : access.status === "REQUESTED"
                      ? "text-amber-500"
                      : "text-red-500"
                }`}
              />
              <div>
                <p className="text-sm font-medium">{access.systemName}</p>
                {access.jiraTicketId && (
                  <p className="text-[10px] text-muted-foreground">
                    {access.jiraTicketId}
                  </p>
                )}
              </div>
            </div>
            <Badge
              variant={config.badgeVariant}
              className={`text-[10px] ${
                access.status === "PROVISIONED"
                  ? "bg-emerald-600 hover:bg-emerald-600"
                  : ""
              }`}
            >
              {config.label}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
