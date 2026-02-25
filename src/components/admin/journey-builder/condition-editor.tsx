"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { StepConditions } from "@/lib/journey-engine/types";

const COUNTRY_OPTIONS = [
  { value: "VE" as const, label: "Venezuela" },
  { value: "CO" as const, label: "Colombia" },
  { value: "AR" as const, label: "Argentina" },
];

interface ConditionEditorProps {
  conditions: StepConditions | null;
  onChange: (conditions: StepConditions | null) => void;
  clusters: { id: string; name: string; country: string }[];
}

export function ConditionEditor({
  conditions,
  onChange,
  clusters,
}: ConditionEditorProps) {
  const cond = conditions ?? {};

  function update(partial: Partial<StepConditions>) {
    const merged = { ...cond, ...partial };
    const cleaned = cleanConditions(merged);
    onChange(cleaned);
  }

  function toggleCountry(code: "VE" | "CO" | "AR") {
    const current = cond.country ?? [];
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    update({ country: next.length > 0 ? next : undefined });
  }

  function toggleCluster(name: string) {
    const current = cond.cluster ?? [];
    const next = current.includes(name)
      ? current.filter((c) => c !== name)
      : [...current, name];
    update({ cluster: next.length > 0 ? next : undefined });
  }

  function toggleTag(tag: string) {
    const current = cond.tags ?? [];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    update({ tags: next.length > 0 ? next : undefined });
  }

  const uniqueClusters = Array.from(
    new Map(clusters.map((c) => [c.name, c])).values()
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Si no se define ninguna condición, el paso aplica a todos los usuarios
        (universal).
      </p>

      {/* Country */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">País</Label>
        <div className="flex flex-wrap gap-1.5">
          {COUNTRY_OPTIONS.map((opt) => {
            const selected = cond.country?.includes(opt.value) ?? false;
            return (
              <Badge
                key={opt.value}
                variant={selected ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => toggleCountry(opt.value)}
              >
                {opt.label}
                {selected && <X className="ml-1 h-3 w-3" />}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Cluster */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Cluster</Label>
        <div className="flex flex-wrap gap-1.5">
          {uniqueClusters.map((cluster) => {
            const selected = cond.cluster?.includes(cluster.name) ?? false;
            return (
              <Badge
                key={cluster.id}
                variant={selected ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => toggleCluster(cluster.name)}
              >
                {cluster.name}
                {selected && <X className="ml-1 h-3 w-3" />}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Tags</Label>
        <TagInput
          tags={cond.tags ?? []}
          onAdd={(tag) => toggleTag(tag)}
          onRemove={(tag) => toggleTag(tag)}
        />
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Requiere email corporativo</Label>
          <Switch
            checked={cond.requiresCorporateEmail ?? false}
            onCheckedChange={(checked) =>
              update({
                requiresCorporateEmail: checked || undefined,
              })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Requiere SSO autenticado</Label>
          <Switch
            checked={cond.requiresSsoAuth ?? false}
            onCheckedChange={(checked) =>
              update({ requiresSsoAuth: checked || undefined })
            }
          />
        </div>
      </div>

      {conditions && hasAnyCondition(conditions) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => onChange(null)}
        >
          Limpiar todas las condiciones
        </Button>
      )}
    </div>
  );
}

function TagInput({
  tags,
  onAdd,
  onRemove,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = e.currentTarget.value.trim();
      if (value && !tags.includes(value)) {
        onAdd(value);
        e.currentTarget.value = "";
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="cursor-pointer gap-1 text-xs"
            onClick={() => onRemove(tag)}
          >
            {tag}
            <X className="h-3 w-3" />
          </Badge>
        ))}
      </div>
      <input
        type="text"
        placeholder="Escribe un tag y presiona Enter..."
        onKeyDown={handleKeyDown}
        className="w-full rounded-md border bg-transparent px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

function cleanConditions(cond: StepConditions): StepConditions | null {
  const cleaned: StepConditions = {};
  if (cond.country && cond.country.length > 0) cleaned.country = cond.country;
  if (cond.cluster && cond.cluster.length > 0) cleaned.cluster = cond.cluster;
  if (cond.position && cond.position.length > 0)
    cleaned.position = cond.position;
  if (cond.userStatus && cond.userStatus.length > 0)
    cleaned.userStatus = cond.userStatus;
  if (cond.requiresCorporateEmail) cleaned.requiresCorporateEmail = true;
  if (cond.requiresSsoAuth) cleaned.requiresSsoAuth = true;
  if (cond.hiredAfter) cleaned.hiredAfter = cond.hiredAfter;
  if (cond.hiredBefore) cleaned.hiredBefore = cond.hiredBefore;
  if (cond.tags && cond.tags.length > 0) cleaned.tags = cond.tags;

  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

function hasAnyCondition(cond: StepConditions): boolean {
  return Object.values(cond).some((v) => {
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v.length > 0;
    return false;
  });
}
