"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { evaluateConditions } from "./evaluate-conditions";
import type { UserProfile } from "./types";

function buildUserProfile(
  user: {
    status: "PRE_HIRE" | "ACTIVE" | "SUSPENDED";
    position: string | null;
    corporateEmail: string | null;
    ssoAuthenticatedAt: Date | null;
    tags: string[];
    createdAt: Date;
    cluster: { name: string; country: "VE" | "CO" | "AR" };
  }
): UserProfile {
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

export async function compileJourney(userId: string, templateId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      include: { cluster: true },
    });

    const template = await tx.journeyTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: {
        steps: { orderBy: { orderIndex: "asc" } },
      },
    });

    const profile = buildUserProfile(user);

    const matchingSteps = template.steps.filter((step) =>
      evaluateConditions(step.conditions, profile)
    );

    const journey = await tx.userJourney.create({
      data: {
        userId,
        journeyTemplateId: templateId,
        compiledFromVersion: template.version,
        progressPercentage: 0,
        status: "IN_PROGRESS",
        steps: {
          create: matchingSteps.map((step, index) => ({
            templateStepId: step.id,
            status: index === 0 ? "PENDING" : "LOCKED",
            resolvedOrder: index + 1,
          })),
        },
      },
      include: {
        steps: {
          include: { templateStep: true },
          orderBy: { resolvedOrder: "asc" },
        },
      },
    });

    return journey;
  });
}

export async function compileAllJourneysForUser(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { cluster: true },
  });

  const profile = buildUserProfile(user);

  const activeTemplates = await prisma.journeyTemplate.findMany({
    where: { isActive: true },
  });

  const applicableTemplates = activeTemplates.filter((t) =>
    evaluateConditions(t.applicability, profile)
  );

  const existing = await prisma.userJourney.findMany({
    where: { userId },
    select: { journeyTemplateId: true },
  });
  const existingTemplateIds = new Set(existing.map((e) => e.journeyTemplateId));

  const results = [];
  for (const template of applicableTemplates) {
    if (existingTemplateIds.has(template.id)) continue;
    const journey = await compileJourney(userId, template.id);
    results.push(journey);
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard", "layout");

  return { journeysCreated: results.length, journeys: results };
}
