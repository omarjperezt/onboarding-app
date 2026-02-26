import { prisma } from "@/lib/prisma";
import { evaluateConditions } from "@/lib/journey-engine/evaluate-conditions";
import type { UserProfile } from "@/lib/journey-engine/types";
import type { TriggerEvent } from "@prisma/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUserProfile(user: {
  status: "PRE_HIRE" | "ACTIVE" | "SUSPENDED";
  position: string | null;
  corporateEmail: string | null;
  ssoAuthenticatedAt: Date | null;
  tags: string[];
  createdAt: Date;
  cluster: { name: string; country: "VE" | "CO" | "AR" };
}): UserProfile {
  return {
    country: user.cluster.country,
    clusterName: user.cluster.name,
    position: user.position,
    status: user.status,
    hasCorporateEmail: !!user.corporateEmail,
    hasSsoAuth: !!user.ssoAuthenticatedAt,
    createdAt: user.createdAt,
    tags: user.tags,
  };
}

function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

function interpolate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, key: string) => {
    return vars[key] ?? `{{${key}}}`;
  });
}

// ---------------------------------------------------------------------------
// Core Dispatcher
// ---------------------------------------------------------------------------

export async function dispatchCommunication(
  userId: string,
  trigger: TriggerEvent,
  isTest = false
): Promise<{ sent: number; skipped: number }> {
  // 1. Fetch the user with cluster
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { cluster: true },
  });

  // 2. Fetch all active templates for this trigger
  const templates = await prisma.communicationTemplate.findMany({
    where: { trigger, isActive: true },
  });

  // 3. Build profile & filter by conditions
  const profile = buildUserProfile(user);
  const matched = templates.filter((t) =>
    evaluateConditions(t.conditions, profile)
  );

  const { firstName, lastName } = splitFullName(user.fullName);

  // Variable map for interpolation
  const vars: Record<string, string> = {
    "user.firstName": firstName,
    "user.lastName": lastName,
    "user.email": user.personalEmail,
    "user.corporateEmail": user.corporateEmail ?? "",
  };

  let sent = 0;
  let skipped = 0;

  // 4. Loop through matched templates
  for (const template of matched) {
    // 5. Idempotency guard — skip in production for non-test dispatches
    if (!isTest && process.env.NODE_ENV !== "development") {
      try {
        await prisma.communicationLog.create({
          data: {
            userId: user.id,
            templateId: template.id,
            trigger,
            status: "PENDING",
          },
        });
      } catch (err: unknown) {
        // P2002 = unique constraint violation → already sent
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          skipped++;
          continue;
        }
        throw err;
      }
    }

    // 6. Interpolate subject & body
    const subject = template.subject
      ? interpolate(template.subject, vars)
      : null;
    const bodyContent = interpolate(template.bodyContent, vars);

    // 7. Mock dispatch (real SendGrid integration comes later)
    console.log(
      `[MOCK ${template.channel}] to ${user.personalEmail}:`,
      { subject, body: bodyContent }
    );

    // 8. Update log status to SENT (only if we created a log above)
    if (!isTest && process.env.NODE_ENV !== "development") {
      await prisma.communicationLog.update({
        where: {
          userId_templateId: {
            userId: user.id,
            templateId: template.id,
          },
        },
        data: { status: "SENT" },
      });
    }

    sent++;
  }

  return { sent, skipped };
}
