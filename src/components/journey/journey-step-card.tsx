"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Clock,
  Lock,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  LogIn,
  KeyRound,
  Smartphone,
  ArrowRight,
  BellRing,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { StepStatus, StepType } from "@prisma/client";
import type { ContentPayload } from "@/lib/journey-engine/types";
import type { ChecklistState } from "@/app/actions/update-checklist";
import { sendItNudge } from "@/app/actions/send-it-nudge";
import { ContentBlockRenderer } from "./content-block-renderer";
import { toast } from "sonner";

interface UserVariables {
  firstName?: string;
  fullName?: string;
  corporateEmail?: string;
  personalEmail?: string;
  clusterName?: string;
  countryName?: string;
  position?: string;
}

interface JourneyStepCardProps {
  orderIndex: number;
  title: string;
  description: string | null;
  contentUrl: string | null;
  stepType: StepType;
  status: StepStatus;
  requiresCorporateEmail: boolean;
  completedAt: Date | null;
  isLast: boolean;
  isIdentityStep?: boolean;
  hardGateActive?: boolean;
  contentPayload?: ContentPayload | null;
  userVariables?: UserVariables;
  userJourneyStepId?: string;
  checklistState?: ChecklistState;
  lastNudgedAt?: Date | null;
}

const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

function isWithinCooldown(lastNudgedAt: Date | null | undefined): boolean {
  if (!lastNudgedAt) return false;
  return Date.now() - new Date(lastNudgedAt).getTime() < COOLDOWN_MS;
}

const statusConfig: Record<
  StepStatus,
  { icon: typeof CheckCircle2; label: string; color: string; bg: string }
> = {
  COMPLETED: {
    icon: CheckCircle2,
    label: "Completado",
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
  },
  PENDING: {
    icon: Clock,
    label: "Pendiente",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
  },
  LOCKED: {
    icon: Lock,
    label: "Bloqueado",
    color: "text-zinc-400",
    bg: "bg-zinc-50 border-zinc-200",
  },
};

const stepTypeLabels: Record<StepType, string> = {
  INFO: "Informativo",
  ACTION: "Accion requerida",
  APPROVAL: "Aprobacion externa",
};

export function JourneyStepCard({
  orderIndex,
  title,
  description,
  contentUrl,
  stepType,
  status,
  requiresCorporateEmail,
  completedAt,
  isLast,
  isIdentityStep = false,
  hardGateActive = false,
  contentPayload,
  userVariables = {},
  userJourneyStepId,
  checklistState,
  lastNudgedAt,
}: JourneyStepCardProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isLocked = status === "LOCKED";

  const [isNudging, startNudgeTransition] = useTransition();
  const [nudgedLocally, setNudgedLocally] = useState(false);

  // Hard Gate: steps that require corporate email while gate is active
  const isGated =
    hardGateActive && requiresCorporateEmail && status !== "COMPLETED";

  // Dynamic description for identity step when completed
  const displayDescription =
    isIdentityStep && status === "COMPLETED"
      ? "Tu cuenta @farmatodo.com ya esta activa. Sigue las instrucciones debajo para configurarla."
      : description;

  const hasContentPayload =
    contentPayload && contentPayload.blocks.length > 0;

  // Nudge logic
  const showNudgeButton =
    isIdentityStep && status === "PENDING" && userJourneyStepId;
  const onCooldown = nudgedLocally || isWithinCooldown(lastNudgedAt);

  function handleNudge() {
    if (!userJourneyStepId || onCooldown) return;
    startNudgeTransition(async () => {
      const result = await sendItNudge(userJourneyStepId);
      if (result.success) {
        setNudgedLocally(true);
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex gap-4">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
            status === "COMPLETED"
              ? "border-emerald-500 bg-emerald-500 text-white"
              : status === "PENDING"
                ? "border-amber-400 bg-white text-amber-500"
                : "border-zinc-300 bg-zinc-100 text-zinc-400"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        {!isLast && (
          <div
            className={`w-0.5 flex-1 min-h-6 ${
              status === "COMPLETED" ? "bg-emerald-300" : "bg-zinc-200"
            }`}
          />
        )}
      </div>

      {/* Content */}
      <div
        className={`relative flex-1 rounded-xl border p-4 mb-3 transition-all ${config.bg} ${
          isLocked || isGated ? "opacity-60" : ""
        }`}
      >
        {/* Gated overlay for steps blocked by identity re-auth */}
        {isGated && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-white/80 backdrop-blur-[2px]">
            <LogIn className="mb-2 h-6 w-6 text-primary" />
            <p className="px-4 text-center text-xs font-semibold text-zinc-700">
              Inicia sesion con Google para desbloquear
            </p>
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground">
                Paso {orderIndex}
              </span>
              <Badge
                variant={
                  status === "COMPLETED"
                    ? "default"
                    : status === "PENDING"
                      ? "secondary"
                      : "outline"
                }
                className={`text-[10px] ${
                  status === "COMPLETED"
                    ? "bg-emerald-600 hover:bg-emerald-600"
                    : ""
                }`}
              >
                {config.label}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {stepTypeLabels[stepType]}
              </Badge>
            </div>
            <h3
              className={`mt-1.5 font-semibold text-sm leading-tight ${
                isLocked ? "text-zinc-400" : "text-foreground"
              }`}
            >
              {title}
            </h3>

            {/* Rich content blocks or legacy fallback */}
            {!isLocked && !isGated && hasContentPayload ? (
              <div className="mt-3 space-y-3">
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
              /* Legacy fallback: plain description */
              displayDescription &&
              !isLocked && (
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {displayDescription}
                </p>
              )
            )}
          </div>
        </div>

        {/* Nudge button for APPROVAL + PENDING identity steps */}
        {showNudgeButton && (
          <div className="mt-3">
            <Button
              variant={onCooldown ? "outline" : "secondary"}
              size="sm"
              className="w-full gap-2 text-xs"
              disabled={onCooldown || isNudging}
              onClick={handleNudge}
            >
              {isNudging ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : onCooldown ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <BellRing className="h-3.5 w-3.5" />
              )}
              {onCooldown
                ? "TI Notificado (espera 4h)"
                : "¿Tarda mucho? Notificar a TI"}
            </Button>
          </div>
        )}

        {/* Hard Gate: Identity configuration block */}
        {isIdentityStep && status === "COMPLETED" && hardGateActive && (
          <Alert className="mt-4 border-primary/30 bg-primary/5">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <AlertTitle className="text-sm font-bold text-primary">
              Accion Obligatoria: Configura tu Identidad
            </AlertTitle>
            <AlertDescription>
              <ol className="mt-2 space-y-2 text-xs text-zinc-700">
                <li className="flex items-start gap-2">
                  <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                  <span>
                    Ingresa a tu correo corporativo con tu clave temporal
                    (solicitala a tu supervisor).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                  <span>
                    Configura tu doble factor de autenticacion (MFA).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                  <span>
                    Vuelve a esta app e inicia sesion con el boton de Google.
                  </span>
                </li>
              </ol>
              <Button
                className="mt-4 w-full gap-2"
                onClick={() => {
                  window.location.reload();
                }}
              >
                <LogIn className="h-4 w-4" />
                Cerrar sesion y Re-autenticar con Google
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* SSO Completed confirmation */}
        {isIdentityStep && status === "COMPLETED" && !hardGateActive && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Identidad corporativa verificada — sesion activa con Google SSO
          </div>
        )}

        {/* Footer: metadata */}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {requiresCorporateEmail && !isGated && (
            <span className="inline-flex items-center gap-1 text-[10px] text-brand-700 font-medium">
              <ShieldCheck className="h-3 w-3" />
              Requiere correo corporativo
            </span>
          )}
          {/* Legacy contentUrl fallback — only show when no rich content */}
          {contentUrl && !isLocked && !isGated && !hasContentPayload && (
            <a
              href={contentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-primary font-medium hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Ver recurso
            </a>
          )}
          {completedAt && (
            <span className="text-[10px] text-emerald-600">
              {new Date(completedAt).toLocaleDateString("es-VE", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
