"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TiptapEditor } from "./tiptap-editor";
import {
  FileText,
  Video,
  FileDown,
  CheckSquare,
  ExternalLink,
  Trash2,
  Plus,
  GripVertical,
} from "lucide-react";
import type { ContentBlock } from "@/lib/journey-engine/types";

const BLOCK_TYPE_OPTIONS = [
  { value: "RICH_TEXT", label: "Texto enriquecido", icon: FileText },
  { value: "VIDEO_EMBED", label: "Video (embed)", icon: Video },
  { value: "PDF_LINK", label: "Enlace PDF", icon: FileDown },
  { value: "CHECKLIST", label: "Checklist", icon: CheckSquare },
  { value: "FORM_LINK", label: "Enlace formulario", icon: ExternalLink },
] as const;

interface ContentBlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
}

export function ContentBlockEditor({
  blocks,
  onChange,
}: ContentBlockEditorProps) {
  function addBlock() {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type: "RICH_TEXT",
      value: "",
    };
    onChange([...blocks, newBlock]);
  }

  function updateBlock(index: number, updated: Partial<ContentBlock>) {
    const next = blocks.map((b, i) =>
      i === index ? { ...b, ...updated } : b
    );
    onChange(next);
  }

  function removeBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => (
        <SingleBlockEditor
          key={block.id}
          block={block}
          onUpdate={(updated) => updateBlock(index, updated)}
          onRemove={() => removeBlock(index)}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs"
        onClick={addBlock}
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar bloque
      </Button>
    </div>
  );
}

function SingleBlockEditor({
  block,
  onUpdate,
  onRemove,
}: {
  block: ContentBlock;
  onUpdate: (updated: Partial<ContentBlock>) => void;
  onRemove: () => void;
}) {
  const BlockIcon =
    BLOCK_TYPE_OPTIONS.find((o) => o.value === block.type)?.icon ?? FileText;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        <BlockIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <Select
          value={block.type}
          onValueChange={(value) =>
            onUpdate({
              type: value as ContentBlock["type"],
              value: "",
              meta: undefined,
            })
          }
        >
          <SelectTrigger className="h-7 w-[180px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLOCK_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="p-3">
        {block.type === "RICH_TEXT" && (
          <TiptapEditor
            content={block.value}
            onChange={(html) => onUpdate({ value: html })}
            placeholder="Escribe contenido aquí..."
          />
        )}

        {block.type === "VIDEO_EMBED" && (
          <div className="space-y-2">
            <Label className="text-xs">URL del video</Label>
            <Input
              placeholder="https://www.youtube.com/embed/..."
              value={block.value}
              onChange={(e) => onUpdate({ value: e.target.value })}
              className="text-xs"
            />
          </div>
        )}

        {block.type === "PDF_LINK" && (
          <div className="space-y-2">
            <div>
              <Label className="text-xs">URL del PDF</Label>
              <Input
                placeholder="https://..."
                value={block.value}
                onChange={(e) => onUpdate({ value: e.target.value })}
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Etiqueta</Label>
              <Input
                placeholder="Nombre del documento"
                value={block.meta?.label ?? ""}
                onChange={(e) =>
                  onUpdate({ meta: { ...block.meta, label: e.target.value } })
                }
                className="text-xs"
              />
            </div>
          </div>
        )}

        {block.type === "CHECKLIST" && (
          <ChecklistEditor
            items={block.meta?.checklistItems ?? []}
            onChange={(items) =>
              onUpdate({ meta: { ...block.meta, checklistItems: items } })
            }
          />
        )}

        {block.type === "FORM_LINK" && (
          <div className="space-y-2">
            <div>
              <Label className="text-xs">URL del formulario</Label>
              <Input
                placeholder="https://forms.google.com/..."
                value={block.value}
                onChange={(e) => onUpdate({ value: e.target.value })}
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Etiqueta</Label>
              <Input
                placeholder="Nombre del formulario"
                value={block.meta?.label ?? ""}
                onChange={(e) =>
                  onUpdate({ meta: { ...block.meta, label: e.target.value } })
                }
                className="text-xs"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChecklistEditor({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [newItem, setNewItem] = useState("");

  function addItem() {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setNewItem("");
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Items del checklist</Label>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1 text-xs">{item}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeItem(i)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Nuevo item..."
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          className="text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          className="text-xs"
        >
          Agregar
        </Button>
      </div>
    </div>
  );
}
