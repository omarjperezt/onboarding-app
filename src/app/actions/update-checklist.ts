"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const checklistStateSchema = z.record(z.string(), z.boolean());

export type ChecklistState = z.infer<typeof checklistStateSchema>;

export async function updateChecklist(
  userJourneyStepId: string,
  state: ChecklistState
) {
  const parsed = checklistStateSchema.safeParse(state);
  if (!parsed.success) {
    throw new Error("Invalid checklist state format");
  }

  await prisma.userJourneyStep.update({
    where: { id: userJourneyStepId },
    data: {
      checklistState: parsed.data,
    },
  });

  revalidatePath("/dashboard");

  return { success: true };
}
