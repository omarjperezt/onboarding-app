"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { evaluateConditions } from "@/lib/journey-engine/evaluate-conditions";
import { compileJourney } from "@/lib/journey-engine/compile-journey";
import type { UserProfile } from "@/lib/journey-engine/types";

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

export async function compileForUser(userId: string) {
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
  const existingTemplateIds = new Set(
    existing.map((e) => e.journeyTemplateId)
  );

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
