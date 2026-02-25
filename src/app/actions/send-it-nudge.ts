"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

export interface NudgeResult {
  success: boolean;
  message: string;
  nextAvailableAt?: string;
}

export async function sendItNudge(
  userJourneyStepId: string
): Promise<NudgeResult> {
  // 1. Fetch the step with user and template step details
  const step = await prisma.userJourneyStep.findUniqueOrThrow({
    where: { id: userJourneyStepId },
    include: {
      templateStep: true,
      userJourney: {
        include: {
          user: {
            include: { cluster: true },
          },
        },
      },
    },
  });

  const user = step.userJourney.user;

  // 2. Enforce 4-hour cooldown based on lastNudgedAt
  if (step.lastNudgedAt) {
    const elapsed = Date.now() - step.lastNudgedAt.getTime();
    if (elapsed < COOLDOWN_MS) {
      const nextAvailable = new Date(
        step.lastNudgedAt.getTime() + COOLDOWN_MS
      );
      return {
        success: false,
        message: "Notificacion enviada recientemente. Intenta de nuevo en unas horas.",
        nextAvailableAt: nextAvailable.toISOString(),
      };
    }
  }

  // 3. Build the Slack message payload
  const slackMessage = {
    text: `Solicitud de atencion — Onboarding OS`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Solicitud de atencion — Onboarding OS",
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Empleado:*\n${user.fullName}`,
          },
          {
            type: "mrkdwn",
            text: `*Cluster:*\n${user.cluster.name} (${user.cluster.country})`,
          },
          {
            type: "mrkdwn",
            text: `*Paso pendiente:*\n${step.templateStep.title}`,
          },
          {
            type: "mrkdwn",
            text: `*Email personal:*\n${user.personalEmail}`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Enviado desde Onboarding OS — ${new Date().toLocaleString("es-VE")}`,
          },
        ],
      },
    ],
  };

  // 4. Send to Slack webhook
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackWebhookUrl) {
    try {
      const response = await fetch(slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackMessage),
      });

      if (!response.ok) {
        console.error(
          `[Nudge] Slack webhook returned ${response.status}: ${await response.text()}`
        );
      } else {
        console.log(
          `[Nudge] Slack notification sent for ${user.fullName} — step: ${step.templateStep.title}`
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[Nudge] Slack webhook failed: ${message}`);
    }
  } else {
    // Development fallback: log to console
    console.log(
      `[Nudge] SLACK_WEBHOOK_URL not configured. Would send:\n`,
      JSON.stringify(slackMessage, null, 2)
    );
  }

  // 5. Update lastNudgedAt in the database
  await prisma.userJourneyStep.update({
    where: { id: userJourneyStepId },
    data: { lastNudgedAt: new Date() },
  });

  revalidatePath("/dashboard", "layout");

  return {
    success: true,
    message: "Equipo de TI notificado exitosamente.",
  };
}
