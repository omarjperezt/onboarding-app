"use client";

import {
  CheckCircle2,
  Clock,
  XCircle,
  Mail,
  Smartphone,
  Package,
  Bug,
  Server,
  CreditCard,
} from "lucide-react";
import type { AccessStatus } from "@prisma/client";

export interface AccessItem {
  id: string;
  systemName: string;
  status: AccessStatus;
  jiraTicketId: string | null;
  createdAt: string;
}

const statusConfig: Record<
  AccessStatus,
  {
    icon: typeof CheckCircle2;
    label: string;
    dotColor: string;
    textColor: string;
    bgColor: string;
  }
> = {
  PROVISIONED: {
    icon: CheckCircle2,
    label: "Activo",
    dotColor: "bg-emerald-400",
    textColor: "text-emerald-700",
    bgColor: "bg-emerald-50",
  },
  REQUESTED: {
    icon: Clock,
    label: "Pendiente",
    dotColor: "bg-amber-400",
    textColor: "text-amber-700",
    bgColor: "bg-amber-50",
  },
  REVOKED: {
    icon: XCircle,
    label: "Revocado",
    dotColor: "bg-red-400",
    textColor: "text-red-700",
    bgColor: "bg-red-50",
  },
};

const systemIcons: Record<string, typeof Mail> = {
  "Google Workspace": Mail,
  "SuperApp Operativa": Smartphone,
  "SIM (Inventario)": Package,
  "Jira Service Management": Bug,
};

function getSystemIcon(systemName: string) {
  return systemIcons[systemName] ?? Server;
}

const systemIconStyles: Record<string, { bg: string; color: string }> = {
  "Google Workspace": { bg: "bg-blue-50", color: "text-blue-600" },
  "SuperApp Operativa": { bg: "bg-violet-50", color: "text-violet-600" },
  "SIM (Inventario)": { bg: "bg-orange-50", color: "text-orange-500" },
  "Jira Service Management": { bg: "bg-teal-50", color: "text-teal-600" },
};

const defaultIconStyle = { bg: "bg-gray-100", color: "text-gray-500" };

export function AccessCard({ access }: { access: AccessItem }) {
  const config = statusConfig[access.status];
  const Icon = getSystemIcon(access.systemName);
  const iconStyle = systemIconStyles[access.systemName] ?? defaultIconStyle;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      {/* System icon */}
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconStyle.bg}`}
      >
        <Icon className={`h-6 w-6 ${iconStyle.color}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-[#1a1a2e] truncate">
          {access.systemName}
        </p>
        {access.jiraTicketId && (
          <p className="text-xs text-gray-400 mt-0.5">{access.jiraTicketId}</p>
        )}
      </div>

      {/* Status pill */}
      <div
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${config.bgColor}`}
      >
        <span className={`h-2 w-2 rounded-full ${config.dotColor}`} />
        <span className={`text-[11px] font-semibold ${config.textColor}`}>
          {config.label}
        </span>
      </div>
    </div>
  );
}

export function AccessCardGrid({ accesses }: { accesses: AccessItem[] }) {
  return (
    <div className="space-y-3">
      {accesses.map((access) => (
        <AccessCard key={access.id} access={access} />
      ))}
    </div>
  );
}
