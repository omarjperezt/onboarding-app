import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("📦 Starting data migration...\n");

  // ─────────────────────────────────────────
  // 1. Migrate TemplateStep: contentUrl → contentPayload, requiresCorporateEmail → conditions
  // ─────────────────────────────────────────
  const steps = await prisma.templateStep.findMany();
  let stepsUpdated = 0;

  for (const step of steps) {
    const updates: { contentPayload?: object; conditions?: object } = {};

    // Migrate contentUrl to contentPayload if not already migrated
    if (step.contentUrl && !step.contentPayload) {
      updates.contentPayload = {
        blocks: [
          {
            id: crypto.randomUUID(),
            type: "PDF_LINK",
            value: step.contentUrl,
            meta: { label: step.title },
          },
        ],
      };
    }

    // Migrate requiresCorporateEmail to conditions if not already migrated
    if (step.requiresCorporateEmail && !step.conditions) {
      updates.conditions = { requiresCorporateEmail: true };
    }

    if (Object.keys(updates).length > 0) {
      await prisma.templateStep.update({
        where: { id: step.id },
        data: updates,
      });
      stepsUpdated++;
      console.log(`  ✅ Step "${step.title}" (order ${step.orderIndex}): migrated ${Object.keys(updates).join(", ")}`);
    }
  }

  console.log(`\n📋 TemplateSteps migrated: ${stepsUpdated}/${steps.length}\n`);

  // ─────────────────────────────────────────
  // 2. Migrate UserJourneyStep: set resolvedOrder from templateStep.orderIndex
  // ─────────────────────────────────────────
  const journeySteps = await prisma.userJourneyStep.findMany({
    where: { resolvedOrder: null },
    include: { templateStep: true },
    orderBy: { templateStep: { orderIndex: "asc" } },
  });

  // Group by userJourneyId to assign sequential resolvedOrder
  const grouped = new Map<string, typeof journeySteps>();
  for (const step of journeySteps) {
    const existing = grouped.get(step.userJourneyId) ?? [];
    existing.push(step);
    grouped.set(step.userJourneyId, existing);
  }

  let journeyStepsUpdated = 0;
  for (const [, steps] of grouped) {
    // Sort by templateStep.orderIndex to ensure correct order
    steps.sort((a, b) => a.templateStep.orderIndex - b.templateStep.orderIndex);

    for (let i = 0; i < steps.length; i++) {
      await prisma.userJourneyStep.update({
        where: { id: steps[i].id },
        data: { resolvedOrder: i + 1 },
      });
      journeyStepsUpdated++;
    }
  }

  console.log(`📋 UserJourneySteps with resolvedOrder set: ${journeyStepsUpdated}/${journeySteps.length}\n`);

  // ─────────────────────────────────────────
  // 3. Set compiledFromVersion on existing UserJourneys
  // ─────────────────────────────────────────
  const journeys = await prisma.userJourney.updateMany({
    where: { compiledFromVersion: 1 },
    data: { compiledFromVersion: 1 },
  });

  console.log(`📋 UserJourneys compiledFromVersion set: ${journeys.count}\n`);

  console.log("🎉 Data migration completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
