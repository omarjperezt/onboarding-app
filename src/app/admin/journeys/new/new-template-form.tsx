"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createTemplate } from "@/app/actions/journey-templates";

interface NewTemplateFormProps {
  clusters: { id: string; name: string; country: string }[];
}

export function NewTemplateForm({ clusters }: NewTemplateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clusterId, setClusterId] = useState("none");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createTemplate({
        name,
        description: description || undefined,
        clusterId: clusterId === "none" ? null : clusterId,
      });
      router.push(`/admin/journeys/${result.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la plantilla</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Nombre *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Onboarding General"
              required
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el propósito de esta plantilla..."
              rows={3}
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
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            type="submit"
            disabled={isPending || !name.trim()}
            size="sm"
            className="gap-1.5 text-xs"
          >
            {isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            Crear plantilla
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => router.push("/admin/journeys")}
          >
            Cancelar
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
