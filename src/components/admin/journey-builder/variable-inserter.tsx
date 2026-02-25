"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Braces } from "lucide-react";

const VARIABLE_GROUPS = [
  {
    label: "Usuario",
    variables: [
      { token: "{{user.fullName}}", label: "Nombre completo" },
      { token: "{{user.firstName}}", label: "Nombre" },
      { token: "{{user.personalEmail}}", label: "Email personal" },
      { token: "{{user.corporateEmail}}", label: "Email corporativo" },
      { token: "{{user.position}}", label: "Cargo" },
    ],
  },
  {
    label: "Organización",
    variables: [
      { token: "{{org.clusterName}}", label: "Cluster" },
      { token: "{{org.countryName}}", label: "País" },
    ],
  },
  {
    label: "Journey",
    variables: [
      { token: "{{journey.templateName}}", label: "Nombre del journey" },
      { token: "{{journey.progress}}", label: "Progreso (%)" },
    ],
  },
];

interface VariableInserterProps {
  onInsert: (variable: string) => void;
}

export function VariableInserter({ onInsert }: VariableInserterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
        >
          <Braces className="h-3.5 w-3.5" />
          Variables
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {VARIABLE_GROUPS.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {group.label}
            </DropdownMenuLabel>
            {group.variables.map((v) => (
              <DropdownMenuItem
                key={v.token}
                onClick={() => onInsert(v.token)}
                className="text-xs"
              >
                <code className="mr-2 rounded bg-muted px-1 py-0.5 text-[10px]">
                  {v.token}
                </code>
                {v.label}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
