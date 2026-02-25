"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { StepCard } from "./step-card";
import { StepEditorSheet } from "./step-editor-sheet";
import { deleteStep, reorderSteps } from "@/app/actions/template-steps";
import type { StepConditions, ContentBlock } from "@/lib/journey-engine/types";

interface StepData {
  id: string;
  orderIndex: number;
  title: string;
  description: string | null;
  stepType: "INFO" | "ACTION" | "APPROVAL";
  isOptional: boolean;
  estimatedMinutes: number | null;
  iconName: string | null;
  conditions: StepConditions | null;
  contentPayload: { blocks: ContentBlock[] } | null;
}

interface StepListProps {
  templateId: string;
  steps: StepData[];
  clusters: { id: string; name: string; country: string }[];
}

export function StepList({ templateId, steps, clusters }: StepListProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<StepData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StepData | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleEdit(step: StepData) {
    setEditingStep(step);
    setEditorOpen(true);
  }

  function handleNew() {
    setEditingStep(null);
    setEditorOpen(true);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    startTransition(async () => {
      await deleteStep(deleteTarget.id);
      setDeleteTarget(null);
    });
  }

  function handleMove(stepIndex: number, direction: "up" | "down") {
    const swapIndex = direction === "up" ? stepIndex - 1 : stepIndex + 1;
    if (swapIndex < 0 || swapIndex >= steps.length) return;

    const reordered = [...steps];
    [reordered[stepIndex], reordered[swapIndex]] = [
      reordered[swapIndex],
      reordered[stepIndex],
    ];

    startTransition(async () => {
      await reorderSteps(
        templateId,
        reordered.map((s) => s.id)
      );
    });
  }

  const sortedSteps = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <>
      <div className="space-y-2">
        {sortedSteps.map((step, index) => (
          <StepCard
            key={step.id}
            step={{
              id: step.id,
              orderIndex: step.orderIndex,
              title: step.title,
              stepType: step.stepType,
              isOptional: step.isOptional,
              estimatedMinutes: step.estimatedMinutes,
              conditions: step.conditions as StepConditions | null,
            }}
            isFirst={index === 0}
            isLast={index === sortedSteps.length - 1}
            onEdit={() => handleEdit(step)}
            onDelete={() => setDeleteTarget(step)}
            onMoveUp={() => handleMove(index, "up")}
            onMoveDown={() => handleMove(index, "down")}
          />
        ))}

        <Button
          variant="outline"
          className="w-full gap-1.5 border-dashed text-xs"
          onClick={handleNew}
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar paso
        </Button>
      </div>

      <StepEditorSheet
        open={editorOpen}
        onOpenChange={setEditorOpen}
        step={editingStep}
        templateId={templateId}
        clusters={clusters}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar paso</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar &quot;{deleteTarget?.title}&quot;? Esta
              acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isPending}
              className="text-xs"
            >
              {isPending && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
