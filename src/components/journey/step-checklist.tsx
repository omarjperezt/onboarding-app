"use client";

import { useState, useTransition } from "react";
import { updateChecklist, type ChecklistState } from "@/app/actions/update-checklist";

interface StepChecklistProps {
  label?: string;
  items: string[];
  userJourneyStepId: string;
  initialState: ChecklistState;
}

export function StepChecklist({
  label,
  items,
  userJourneyStepId,
  initialState,
}: StepChecklistProps) {
  const [state, setState] = useState<ChecklistState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleToggle(item: string) {
    const newState = { ...state, [item]: !state[item] };
    setState(newState);

    startTransition(async () => {
      await updateChecklist(userJourneyStepId, newState);
    });
  }

  const completedCount = items.filter((item) => state[item]).length;

  return (
    <div className="space-y-2">
      {label && (
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      )}
      <div className="space-y-1.5">
        {items.map((item) => {
          const checked = !!state[item];
          return (
            <label
              key={item}
              className="flex items-start gap-2.5 rounded-lg border bg-muted/30 px-3 py-2 cursor-pointer transition-colors hover:bg-muted/60"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => handleToggle(item)}
                disabled={isPending}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-primary accent-primary"
              />
              <span
                className={`text-xs leading-relaxed ${
                  checked
                    ? "text-muted-foreground line-through"
                    : "text-foreground"
                }`}
              >
                {item}
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {completedCount} de {items.length} completados
      </p>
    </div>
  );
}
