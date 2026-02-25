import { prisma } from "@/lib/prisma";
import { Map } from "lucide-react";
import { JourneyStepCard } from "@/components/journey/journey-step-card";
import { StepDetailSheet } from "@/components/journey/step-detail-sheet";
import type { ContentPayload } from "@/lib/journey-engine/types";
import type { ChecklistState } from "@/app/actions/update-checklist";

export const dynamic = "force-dynamic";

async function getRutaData() {
  const user = await prisma.user.findFirst({
    where: { personalEmail: "josmar.rodriguez@gmail.com" },
    include: {
      cluster: true,
      journeys: {
        include: {
          journeyTemplate: true,
          steps: {
            include: {
              templateStep: true,
            },
            orderBy: [
              { resolvedOrder: "asc" },
              { templateStep: { orderIndex: "asc" } },
            ],
          },
        },
      },
    },
  });

  return user;
}

export default async function RutaPage() {
  const user = await getRutaData();

  if (!user) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          Sin datos disponibles. Ejecuta el seed.
        </p>
      </div>
    );
  }

  const journey = user.journeys[0];

  if (!journey) {
    return (
      <div className="px-5 pt-8">
        <h1 className="text-xl font-bold text-[#1a1a2e]">Tu Ruta</h1>
        <div className="mt-8 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 mb-4">
            <Map className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-500">
            Aún no tienes un journey asignado.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Tu equipo de RRHH está preparando tu ruta de onboarding.
          </p>
        </div>
      </div>
    );
  }

  const hasCorporateEmail = !!user.corporateEmail;
  const hardGateActive = hasCorporateEmail && !user.ssoAuthenticatedAt;

  const totalSteps = journey.steps.length;
  const completedSteps = journey.steps.filter(
    (s) => s.status === "COMPLETED"
  ).length;
  const progressPercentage =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const userVariables = {
    firstName: user.fullName.split(" ")[0],
    fullName: user.fullName,
    corporateEmail: user.corporateEmail ?? undefined,
    personalEmail: user.personalEmail,
    clusterName: user.cluster?.name ?? undefined,
    countryName: user.cluster?.country ?? undefined,
    position: user.position ?? undefined,
  };

  return (
    <>
      {/* ── Page Header ── */}
      <div className="bg-white px-5 pt-6 pb-5 border-b border-gray-100">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#1a1a2e]">Tu Ruta</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {journey.journeyTemplate.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#0F4C81]">
                {progressPercentage}%
              </span>
              <div className="h-2.5 w-20 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {completedSteps} de {totalSteps} misiones completadas
          </p>
        </div>
      </div>

      {/* ── Journey Timeline ── */}
      <div className="mx-auto max-w-lg px-5 pt-5 pb-4">
        {journey.steps.map((step, index) => {
          const isLast = index === journey.steps.length - 1;
          const orderIndex =
            step.resolvedOrder ?? step.templateStep.orderIndex;
          const conditions = step.templateStep.conditions as
            | { requiresCorporateEmail?: boolean }
            | null;
          const requiresCorporateEmail =
            conditions?.requiresCorporateEmail ??
            step.templateStep.requiresCorporateEmail;
          const isIdentityStep =
            step.templateStep.stepType === "APPROVAL" &&
            requiresCorporateEmail;
          const contentPayload =
            (step.templateStep.contentPayload as ContentPayload | null) ??
            null;
          const checklistState =
            (step.checklistState as ChecklistState) ?? {};

          const card = (
            <JourneyStepCard
              key={step.id}
              orderIndex={orderIndex}
              title={step.templateStep.title}
              description={step.templateStep.description}
              contentUrl={step.templateStep.contentUrl}
              stepType={step.templateStep.stepType}
              status={step.status}
              requiresCorporateEmail={requiresCorporateEmail}
              completedAt={step.completedAt}
              isLast={isLast}
              isIdentityStep={isIdentityStep}
              hardGateActive={hardGateActive}
              contentPayload={contentPayload}
              userVariables={userVariables}
              userJourneyStepId={step.id}
              checklistState={checklistState}
              lastNudgedAt={step.lastNudgedAt}
            />
          );

          // PENDING steps are tappable — open StepDetailSheet
          if (step.status === "PENDING") {
            return (
              <StepDetailSheet
                key={step.id}
                stepTitle={step.templateStep.title}
                stepDescription={step.templateStep.description}
                stepType={step.templateStep.stepType}
                orderIndex={orderIndex}
                contentPayload={contentPayload}
                userJourneyStepId={step.id}
                checklistState={checklistState}
                userVariables={userVariables}
                isIdentityStep={isIdentityStep}
                lastNudgedAt={step.lastNudgedAt?.toISOString() ?? null}
              >
                {card}
              </StepDetailSheet>
            );
          }

          return card;
        })}
      </div>
    </>
  );
}
