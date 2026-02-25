"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Upload } from "lucide-react";
import {
  updateTemplate,
  toggleTemplateActive,
  publishNewVersion,
} from "@/app/actions/journey-templates";
import { toast } from "sonner";

interface TemplateInfoFormProps {
  template: {
    id: string;
    name: string;
    description: string | null;
    clusterId: string | null;
    isActive: boolean;
    version: number;
  };
  clusters: { id: string; name: string; country: string }[];
}

export function TemplateInfoForm({
  template,
  clusters,
}: TemplateInfoFormProps) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [clusterId, setClusterId] = useState(template.clusterId ?? "none");
  const [isSaving, startSaveTransition] = useTransition();
  const [isToggling, startToggleTransition] = useTransition();
  const [isPublishing, startPublishTransition] = useTransition();

  function handleSave() {
    startSaveTransition(async () => {
      await updateTemplate(template.id, {
        name,
        description: description || null,
        clusterId: clusterId === "none" ? null : clusterId,
      });
      toast.success("Plantilla actualizada");
    });
  }

  function handleToggleActive() {
    startToggleTransition(async () => {
      await toggleTemplateActive(template.id);
      toast.success(
        template.isActive ? "Plantilla desactivada" : "Plantilla activada"
      );
    });
  }

  function handlePublish() {
    startPublishTransition(async () => {
      const result = await publishNewVersion(template.id);
      toast.success(`Versión ${result.version} publicada`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={template.isActive ? "default" : "secondary"}>
            {template.isActive ? "Activa" : "Borrador"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            v{template.version}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Activa</Label>
            <Switch
              checked={template.isActive}
              onCheckedChange={handleToggleActive}
              disabled={isToggling}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs">Nombre</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Cluster (opcional)</Label>
          <Select value={clusterId} onValueChange={setClusterId}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                Sin asignar (global)
              </SelectItem>
              {clusters.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.name} ({c.country})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Descripción</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe el propósito de esta plantilla..."
          className="text-sm"
          rows={2}
        />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          size="sm"
          className="gap-1.5 text-xs"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Guardar
        </Button>
        <Button
          onClick={handlePublish}
          disabled={isPublishing}
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
        >
          {isPublishing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Publicar v{template.version + 1}
        </Button>
      </div>
    </div>
  );
}
