import { prisma } from "@/lib/prisma";
import type { StepConditions } from "./types";

interface IdentityFlipResult {
  userId: string;
  corporateEmail: string;
  journeyId: string;
  completedStepId: string | null;
  unlockedStepCount: number;
  newProgress: number;
}

// Mock omnichannel dispatchers — replace with real integrations in production
function dispatchEmailNotification(
  userFullName: string,
  corporateEmail: string
) {
  console.log(
    `[Email] Identity flip completed for ${userFullName}. Corporate email: ${corporateEmail}`
  );
}

function dispatchSmsNotification(
  userFullName: string,
  phoneNumber: string | null
) {
  if (!phoneNumber) {
    console.log(
      `[SMS] Skipped for ${userFullName} — no phone number on file`
    );
    return;
  }
  console.log(
    `[SMS] Identity flip notification sent to ${userFullName} at ${phoneNumber}`
  );
}

function dispatchWhatsAppNotification(
  userFullName: string,
  phoneNumber: string | null
) {
  if (!phoneNumber) {
    console.log(
      `[WhatsApp] Skipped for ${userFullName} — no phone number on file`
    );
    return;
  }
  console.log(
    `[WhatsApp] Identity flip notification sent to ${userFullName} at ${phoneNumber}`
  );
}

/**
 * Core identity flip logic extracted from simulate-identity-flip.
 * Called by both the dev simulator and the provisioning webhook.
 *
 * Transaction flow:
 * 1. Assign corporate email and flip user status to ACTIVE
 * 2. Complete the identity (APPROVAL) step
 * 3. Unlock all LOCKED steps → PENDING
 * 4. Recalculate journey progress
 * 5. Provision Google Workspace access
 * 6. Dispatch omnichannel notifications (mock)
 */
export async function processIdentityFlip(
  userId: string,
  corporateEmail: string
): Promise<IdentityFlipResult> {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Assign corporate email and flip user status to ACTIVE
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        corporateEmail,
        status: "ACTIVE",
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

    if (!journey) throw new Error("Journey not found for user: " + userId);

    // 3. Complete the identity step (APPROVAL type, resolvedOrder=2 or orderIndex=2)
    const identityStep = journey.steps.find(
      (s) =>
        s.templateStep.stepType === "APPROVAL" &&
        (s.resolvedOrder === 2 || s.templateStep.orderIndex === 2)
    );

    let completedStepId: string | null = null;
    if (identityStep) {
      await tx.userJourneyStep.update({
        where: { id: identityStep.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      completedStepId = identityStep.id;
    }

    // 4. Unlock steps that are currently LOCKED → PENDING
    const lockedSteps = journey.steps.filter((s) => s.status === "LOCKED");
    for (const step of lockedSteps) {
      await tx.userJourneyStep.update({
        where: { id: step.id },
        data: { status: "PENDING" },
      });
    }

    // 5. Recalculate journey progress
    const completedCount =
      journey.steps.filter((s) => s.status === "COMPLETED").length +
      (completedStepId ? 1 : 0);
    const totalSteps = journey.steps.length;
    const newProgress = Math.round((completedCount / totalSteps) * 100);

    await tx.userJourney.update({
      where: { id: journey.id },
      data: { progressPercentage: newProgress },
    });

    // 6. Provision Google Workspace access
    await tx.accessProvisioning.updateMany({
      where: { userId, systemName: "Google Workspace" },
      data: { status: "PROVISIONED" },
    });

    return {
      userId,
      corporateEmail,
      journeyId: journey.id,
      completedStepId,
      unlockedStepCount: lockedSteps.length,
      newProgress,
      userFullName: user.fullName,
      phoneNumber: user.phoneNumber,
    };
  });

  // 7. Dispatch omnichannel notifications (outside transaction)
  dispatchEmailNotification(result.userFullName, corporateEmail);
  dispatchSmsNotification(result.userFullName, result.phoneNumber);
  dispatchWhatsAppNotification(result.userFullName, result.phoneNumber);

  return {
    userId: result.userId,
    corporateEmail: result.corporateEmail,
    journeyId: result.journeyId,
    completedStepId: result.completedStepId,
    unlockedStepCount: result.unlockedStepCount,
    newProgress: result.newProgress,
  };
}
