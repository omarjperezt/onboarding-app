"use client";

import { useState } from "react";
import { ArrowRight, X, Clock, ChevronLeft } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ContentBlockRenderer } from "./content-block-renderer";
import type { ContentPayload } from "@/lib/journey-engine/types";
import type { StepType } from "@prisma/client";
import type { ChecklistState } from "@/app/actions/update-checklist";

interface UserVariables {
  firstName?: string;
  fullName?: string;
  corporateEmail?: string;
  personalEmail?: string;
  clusterName?: string;
  countryName?: string;
  position?: string;
}

interface StepDetailSheetProps {
  stepTitle: string;
  stepDescription: string | null;
  stepType: StepType;
  orderIndex: number;
  contentPayload: ContentPayload | null;
  userJourneyStepId: string;
  checklistState: ChecklistState;
  userVariables: UserVariables;
  isIdentityStep: boolean;
  lastNudgedAt: string | null;
  children?: React.ReactNode;
}

const stepTypeLabels: Record<StepType, string> = {
  INFO: "Informativo",
  ACTION: "Acción requerida",
  APPROVAL: "Aprobación externa",
};

export function StepDetailSheet({
  stepTitle,
  stepDescription,
  stepType,
  orderIndex,
  contentPayload,
  userJourneyStepId,
  checklistState,
  userVariables,
  isIdentityStep,
  lastNudgedAt,
  children,
}: StepDetailSheetProps) {
  const [open, setOpen] = useState(false);

  const hasContent = contentPayload && contentPayload.blocks.length > 0;

  return (
    <>
      {/* Trigger: custom children or default CTA button */}
      {children ? (
        <div role="button" tabIndex={0} onClick={() => setOpen(true)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen(true); }}>
          {children}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F4C81] px-6 py-4 text-[15px] font-semibold text-white shadow-md transition-colors hover:bg-[#0d4070] active:bg-[#0a3560]"
        >
          Comenzar Misión
          <ArrowRight className="h-5 w-5" />
        </button>
      )}

      {/* Full-screen Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="h-[92vh] rounded-t-3xl p-0 overflow-hidden [&>button]:hidden"
        >
          {/* Custom header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
            <div className="flex items-center justify-between px-5 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                <ChevronLeft className="h-5 w-5" />
                Volver
              </button>
              <Badge variant="outline" className="text-[11px]">
                {stepTypeLabels[stepType]}
              </Badge>
            </div>
            <SheetHeader className="px-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0F4C81]/70 uppercase tracking-wider">
                  <Clock className="h-3.5 w-3.5" />
                  Día {orderIndex}
                </span>
              </div>
              <SheetTitle className="text-xl font-bold text-[#1a1a2e] leading-snug text-left">
                {stepTitle}
              </SheetTitle>
              {stepDescription && (
                <p className="text-sm text-gray-500 leading-relaxed mt-1 text-left">
                  {stepDescription}
                </p>
              )}
            </SheetHeader>
          </div>

          {/* Content blocks */}
          <div className="overflow-y-auto px-5 py-5 pb-24" style={{ maxHeight: "calc(92vh - 160px)" }}>
            {hasContent ? (
              <div className="space-y-5">
                {contentPayload.blocks.map((block) => (
                  <ContentBlockRenderer
                    key={block.id}
                    block={block}
                    userVariables={userVariables}
                    userJourneyStepId={userJourneyStepId}
                    checklistState={checklistState}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 mb-4">
                  <Clock className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-500">
                  El contenido de esta misión se cargará pronto.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Tu equipo de RRHH está preparando los materiales.
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
