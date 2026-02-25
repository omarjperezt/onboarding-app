"use client";

import { useState, useTransition } from "react";
import { simulateIdentityFlip } from "@/app/actions/simulate-identity-flip";
import { rollbackIdentityFlip } from "@/app/actions/rollback-identity-flip";
import { simulateSsoLogin } from "@/app/actions/simulate-sso-login";
import {
  Bug,
  Loader2,
  Zap,
  Undo2,
  LogIn,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type ActionLabel = "flip" | "rollback" | "sso";

const feedbackMessages: Record<ActionLabel, { text: string; style: string }> = {
  flip: {
    text: "Flip ejecutado — UI actualizada",
    style: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  rollback: {
    text: "Rollback completado — estado inicial",
    style: "border-zinc-200 bg-zinc-50 text-zinc-600",
  },
  sso: {
    text: "SSO autenticado — Hard Gate removido",
    style: "border-blue-200 bg-blue-50 text-blue-700",
  },
};

export function DevSimulator({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [lastAction, setLastAction] = useState<ActionLabel | null>(null);

  function run(action: ActionLabel) {
    startTransition(async () => {
      if (action === "flip") await simulateIdentityFlip(userId);
      else if (action === "rollback") await rollbackIdentityFlip(userId);
      else if (action === "sso") await simulateSsoLogin(userId);
      setLastAction(action);
    });
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-xs">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="ml-auto flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 shadow-lg transition-colors hover:bg-orange-100"
      >
        <Bug className="h-3.5 w-3.5" />
        Dev Simulator
        {isOpen ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronUp className="h-3 w-3" />
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="mt-2 rounded-xl border border-orange-200 bg-white p-4 shadow-xl">
          <p className="mb-1 text-xs font-semibold text-zinc-700">
            Simular Webhook Jira
          </p>
          <p className="mb-3 text-[11px] text-zinc-500 leading-relaxed">
            Controla el ciclo de vida completo del Flip de Identidad: webhook
            Jira, login SSO y rollback.
          </p>

          {/* Status feedback */}
          {lastAction && (
            <div
              className={`mb-3 flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium ${feedbackMessages[lastAction].style}`}
            >
              {lastAction === "flip" ? (
                <Zap className="h-3.5 w-3.5" />
              ) : lastAction === "sso" ? (
                <LogIn className="h-3.5 w-3.5" />
              ) : (
                <Undo2 className="h-3.5 w-3.5" />
              )}
              {feedbackMessages[lastAction].text}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => run("flip")}
              disabled={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              Simular Webhook Jira: Aprobar Identidad
            </button>

            <button
              onClick={() => run("sso")}
              disabled={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LogIn className="h-3.5 w-3.5" />
              )}
              Simular Login SSO Google
            </button>

            <button
              onClick={() => run("rollback")}
              disabled={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo2 className="h-3.5 w-3.5" />
              )}
              Revertir Webhook (Demo)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
