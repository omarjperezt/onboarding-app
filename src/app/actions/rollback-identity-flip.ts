"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { StepConditions } from "@/lib/journey-engine/types";

export async function rollbackIdentityFlip(userId: string) {
  await prisma.$transaction(async (tx) => {
    // 1. Remove corporate email and revert user status to PRE_HIRE
    await tx.user.update({
      where: { id: userId },
      data: {
        corporateEmail: null,
        status: "PRE_HIRE",
        ssoAuthenticatedAt: null,
      },
    });

    // 2. Find the user's journey and steps
    const journey = await tx.userJourney.findFirst({
      where: { userId },
      include: {
        steps: {
          include: { templateStep: true },
          orderBy: [
            { resolvedOrder: "asc" },
            { templateStep: { orderIndex: "asc" } },
          ],
        },
      },
    });

    if (!journey) throw new Error("Journey not found");

    // 3. Revert identity step (APPROVAL type) back to PENDING
    const identityStep = journey.steps.find(
      (s) =>
        s.templateStep.stepType === "APPROVAL" &&
        (s.resolvedOrder === 2 || s.templateStep.orderIndex === 2)
    );
    if (identityStep) {
      await tx.userJourneyStep.update({
        where: { id: identityStep.id },
        data: { status: "PENDING", completedAt: null },
      });
    }

    // 4. Re-lock steps that require corporate email (from conditions or legacy field)
    const postFlipSteps = journey.steps.filter((s) => {
      const conditions = s.templateStep.conditions as StepConditions | null;
      return (
        conditions?.requiresCorporateEmail === true ||
        s.templateStep.requiresCorporateEmail
      );
    });
    for (const step of postFlipSteps) {
      await tx.userJourneyStep.update({
        where: { id: step.id },
        data: { status: "LOCKED", completedAt: null },
      });
    }

    // 5. Recalculate journey progress after rollback
    // Count steps that will remain completed (first step only in fresh state)
    const firstStep = journey.steps[0];
    const completedCount =
      firstStep && firstStep.status === "COMPLETED" ? 1 : 0;
    const newProgress = Math.round(
      (completedCount / journey.steps.length) * 100
    );

    await tx.userJourney.update({
      where: { id: journey.id },
      data: { progressPercentage: newProgress },
    });

    // 6. Revert Google Workspace back to REQUESTED
    await tx.accessProvisioning.updateMany({
      where: { userId, systemName: "Google Workspace" },
      data: { status: "REQUESTED" },
    });
  });

  revalidatePath("/dashboard");
}
