"use client";

import { useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContentBlockEditor } from "./content-block-editor";
import { ConditionEditor } from "./condition-editor";
import { Loader2 } from "lucide-react";
import { updateStep, createStep } from "@/app/actions/template-steps";
import type { StepConditions, ContentBlock } from "@/lib/journey-engine/types";

const STEP_TYPES = [
  { value: "INFO", label: "Informativo" },
  { value: "ACTION", label: "Acción" },
  { value: "APPROVAL", label: "Aprobación" },
] as const;

interface StepData {
  id: string;
  title: string;
  description: string | null;
  stepType: "INFO" | "ACTION" | "APPROVAL";
  isOptional: boolean;
  estimatedMinutes: number | null;
  iconName: string | null;
  conditions: StepConditions | null;
  contentPayload: { blocks: ContentBlock[] } | null;
}

interface StepEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: StepData | null;
  templateId: string;
  clusters: { id: string; name: string; country: string }[];
}

export function StepEditorSheet({
  open,
  onOpenChange,
  step,
  templateId,
  clusters,
}: StepEditorSheetProps) {
  const isNew = step === null;
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(step?.title ?? "");
  const [description, setDescription] = useState(step?.description ?? "");
  const [stepType, setStepType] = useState<"INFO" | "ACTION" | "APPROVAL">(
    step?.stepType ?? "INFO"
  );
  const [isOptional, setIsOptional] = useState(step?.isOptional ?? false);
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>(
    step?.estimatedMinutes?.toString() ?? ""
  );
  const [conditions, setConditions] = useState<StepConditions | null>(
    step?.conditions ?? null
  );
  const [blocks, setBlocks] = useState<ContentBlock[]>(
    step?.contentPayload?.blocks ?? []
  );

  function resetForm(s: StepData | null) {
    setTitle(s?.title ?? "");
    setDescription(s?.description ?? "");
    setStepType(s?.stepType ?? "INFO");
    setIsOptional(s?.isOptional ?? false);
    setEstimatedMinutes(s?.estimatedMinutes?.toString() ?? "");
    setConditions(s?.conditions ?? null);
    setBlocks(s?.contentPayload?.blocks ?? []);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      resetForm(step);
    }
    onOpenChange(nextOpen);
  }

  function handleSave() {
    const minutes = estimatedMinutes ? parseInt(estimatedMinutes, 10) : null;
    const payload =
      blocks.length > 0 ? { blocks } : null;

    startTransition(async () => {
      if (isNew) {
        await createStep({
          journeyTemplateId: templateId,
          title,
          stepType,
          description: description || null,
          isOptional,
          estimatedMinutes: minutes,
          conditions,
          contentPayload: payload,
        });
      } else {
        await updateStep(step.id, {
          title,
          stepType,
          description: description || null,
          isOptional,
          estimatedMinutes: minutes,
          conditions,
          contentPayload: payload,
        });
      }
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-base">
            {isNew ? "Nuevo paso" : "Editar paso"}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {isNew
              ? "Configura el nuevo paso del journey"
              : `Editando: ${step.title}`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="general" className="flex-1 text-xs">
                General
              </TabsTrigger>
              <TabsTrigger value="content" className="flex-1 text-xs">
                Contenido
              </TabsTrigger>
              <TabsTrigger value="conditions" className="flex-1 text-xs">
                Condiciones
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-xs">Título</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nombre del paso"
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Descripción</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción breve del paso..."
                  className="text-sm"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={stepType}
                    onValueChange={(v) =>
                      setStepType(v as "INFO" | "ACTION" | "APPROVAL")
                    }
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STEP_TYPES.map((t) => (
                        <SelectItem
                          key={t.value}
                          value={t.value}
                          className="text-xs"
                        >
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Duración (min)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(e.target.value)}
                    placeholder="—"
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Paso opcional</Label>
                <Switch
                  checked={isOptional}
                  onCheckedChange={setIsOptional}
                />
              </div>
            </TabsContent>

            <TabsContent value="content" className="pt-4">
              <ContentBlockEditor blocks={blocks} onChange={setBlocks} />
            </TabsContent>

            <TabsContent value="conditions" className="pt-4">
              <ConditionEditor
                conditions={conditions}
                onChange={setConditions}
                clusters={clusters}
              />
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex gap-2">
            <Button
              onClick={handleSave}
              disabled={isPending || !title.trim()}
              className="flex-1 text-xs"
            >
              {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {isNew ? "Crear paso" : "Guardar cambios"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
