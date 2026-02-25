"use server";

import { prisma } from "@/lib/prisma";
import { evaluateConditions } from "@/lib/journey-engine/evaluate-conditions";
import type { StepConditions, UserProfile } from "@/lib/journey-engine/types";
import type { StepType } from "@prisma/client";

export interface PreviewStepResult {
  stepId: string;
  orderIndex: number;
  title: string;
  stepType: StepType;
  included: boolean;
  reason: string;
}

export interface PreviewCompilationResult {
  totalSteps: number;
  includedCount: number;
  excludedCount: number;
  steps: PreviewStepResult[];
}

const countryNames: Record<string, string> = {
  VE: "Venezuela",
  CO: "Colombia",
  AR: "Argentina",
};

function formatCountryList(codes: string[]): string {
  return codes.map((c) => countryNames[c] ?? c).join(", ");
}

function buildExclusionReason(
  conditions: StepConditions,
  profile: UserProfile
): string {
  if (conditions.country && conditions.country.length > 0) {
    if (!conditions.country.includes(profile.country)) {
      const expected = formatCountryList(conditions.country);
      const actual = countryNames[profile.country] ?? profile.country;
      return `Excluido: Este paso es solo para empleados en ${expected}. El empleado simulado esta en ${actual}.`;
    }
  }

  if (conditions.cluster && conditions.cluster.length > 0) {
    if (!conditions.cluster.includes(profile.clusterName)) {
      return `Excluido: Este paso es solo para el cluster ${conditions.cluster.join(", ")}. El empleado simulado pertenece a "${profile.clusterName}".`;
    }
  }

  if (conditions.position && conditions.position.length > 0) {
    if (!profile.position) {
      return "Excluido: Este paso requiere un cargo especifico, pero el empleado simulado no tiene cargo definido.";
    }
    return `Excluido: Este paso es para cargos que incluyan "${conditions.position.join(", ")}". El cargo del empleado simulado es "${profile.position}".`;
  }

  if (conditions.userStatus && conditions.userStatus.length > 0) {
    if (!conditions.userStatus.includes(profile.status)) {
      return `Excluido: Este paso requiere estado ${conditions.userStatus.join(" o ")}. El empleado simulado tiene estado diferente.`;
    }
  }

  if (conditions.requiresCorporateEmail !== undefined) {
    if (profile.hasCorporateEmail !== conditions.requiresCorporateEmail) {
      if (conditions.requiresCorporateEmail) {
        return "Excluido temporalmente: Requiere que el empleado ya tenga correo corporativo activo.";
      }
      return "Excluido: Este paso es solo para empleados sin correo corporativo.";
    }
  }

  if (conditions.requiresSsoAuth !== undefined) {
    if (profile.hasSsoAuth !== conditions.requiresSsoAuth) {
      if (conditions.requiresSsoAuth) {
        return "Excluido temporalmente: Requiere que el empleado haya iniciado sesion con Google SSO.";
      }
      return "Excluido: Este paso es solo para empleados que aun no se autentican con SSO.";
    }
  }

  if (conditions.tags && conditions.tags.length > 0) {
    const matched = conditions.tags.some((t) => profile.tags.includes(t));
    if (!matched) {
      return `Excluido: Este paso requiere las etiquetas "${conditions.tags.join(", ")}". El empleado simulado no las tiene.`;
    }
  }

  return "Excluido: Las condiciones de este paso no se cumplen para el perfil simulado.";
}

function buildInclusionReason(conditions: StepConditions): string {
  const parts: string[] = [];

  if (conditions.country && conditions.country.length > 0) {
    parts.push(`pais coincide (${formatCountryList(conditions.country)})`);
  }
  if (conditions.cluster && conditions.cluster.length > 0) {
    parts.push(`cluster coincide (${conditions.cluster.join(", ")})`);
  }
  if (conditions.requiresCorporateEmail !== undefined) {
    parts.push(
      conditions.requiresCorporateEmail
        ? "tiene correo corporativo"
        : "sin correo corporativo"
    );
  }
  if (conditions.requiresSsoAuth !== undefined) {
    parts.push(
      conditions.requiresSsoAuth
        ? "autenticado con SSO"
        : "sin autenticacion SSO"
    );
  }
  if (conditions.tags && conditions.tags.length > 0) {
    parts.push(`etiquetas coinciden (${conditions.tags.join(", ")})`);
  }
  if (conditions.position && conditions.position.length > 0) {
    parts.push(`cargo coincide (${conditions.position.join(", ")})`);
  }

  return parts.length > 0
    ? `Incluido: ${parts.join(", ")}`
    : "Incluido: Paso universal";
}

export async function previewCompilation(
  templateId: string,
  simulatedProfile: UserProfile
): Promise<PreviewCompilationResult> {
  const template = await prisma.journeyTemplate.findUniqueOrThrow({
    where: { id: templateId },
    include: {
      steps: { orderBy: { orderIndex: "asc" } },
    },
  });

  const steps: PreviewStepResult[] = template.steps.map((step) => {
    const conditions = step.conditions as StepConditions | null;
    const included = evaluateConditions(step.conditions, simulatedProfile);

    let reason: string;
    if (!conditions || Object.keys(conditions).length === 0) {
      reason = "Incluido: Paso universal — se muestra a todos los empleados";
    } else if (included) {
      reason = buildInclusionReason(conditions);
    } else {
      reason = buildExclusionReason(conditions, simulatedProfile);
    }

    return {
      stepId: step.id,
      orderIndex: step.orderIndex,
      title: step.title,
      stepType: step.stepType,
      included,
      reason,
    };
  });

  const includedCount = steps.filter((s) => s.included).length;

  return {
    totalSteps: steps.length,
    includedCount,
    excludedCount: steps.length - includedCount,
    steps,
  };
}
