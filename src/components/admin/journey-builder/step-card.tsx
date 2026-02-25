"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Globe,
  Filter,
  Clock,
  Info,
  Zap,
  ShieldCheck,
} from "lucide-react";
import type { StepConditions } from "@/lib/journey-engine/types";

const STEP_TYPE_CONFIG = {
  INFO: { label: "Info", icon: Info, variant: "secondary" as const },
  ACTION: { label: "Acción", icon: Zap, variant: "default" as const },
  APPROVAL: {
    label: "Aprobación",
    icon: ShieldCheck,
    variant: "outline" as const,
  },
};

interface StepCardProps {
  step: {
    id: string;
    orderIndex: number;
    title: string;
    stepType: "INFO" | "ACTION" | "APPROVAL";
    isOptional: boolean;
    estimatedMinutes: number | null;
    conditions: StepConditions | null;
  };
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function StepCard({
  step,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: StepCardProps) {
  const typeConfig = STEP_TYPE_CONFIG[step.stepType];
  const TypeIcon = typeConfig.icon;
  const conditionCount = countConditions(step.conditions);

  return (
    <div className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
        {step.orderIndex}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{step.title}</span>
          {step.isOptional && (
            <Badge variant="outline" className="text-[10px]">
              Opcional
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <Badge variant={typeConfig.variant} className="gap-1 text-[10px]">
            <TypeIcon className="h-3 w-3" />
            {typeConfig.label}
          </Badge>
          {conditionCount > 0 ? (
            <span className="flex items-center gap-1 text-[10px] text-amber-600">
              <Filter className="h-3 w-3" />
              {conditionCount} condición{conditionCount > 1 ? "es" : ""}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Globe className="h-3 w-3" />
              Universal
            </span>
          )}
          {step.estimatedMinutes && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {step.estimatedMinutes} min
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={isFirst}
          onClick={onMoveUp}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={isLast}
          onClick={onMoveDown}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function countConditions(conditions: StepConditions | null): number {
  if (!conditions) return 0;
  let count = 0;
  if (conditions.country && conditions.country.length > 0) count++;
  if (conditions.cluster && conditions.cluster.length > 0) count++;
  if (conditions.position && conditions.position.length > 0) count++;
  if (conditions.userStatus && conditions.userStatus.length > 0) count++;
  if (conditions.requiresCorporateEmail) count++;
  if (conditions.requiresSsoAuth) count++;
  if (conditions.hiredAfter) count++;
  if (conditions.hiredBefore) count++;
  if (conditions.tags && conditions.tags.length > 0) count++;
  return count;
}
