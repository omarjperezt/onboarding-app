"use server";

import { revalidatePath } from "next/cache";
import { processIdentityFlip } from "@/lib/journey-engine/process-identity-flip";

export async function simulateIdentityFlip(userId: string) {
  await processIdentityFlip(userId, "josmar.rodriguez@farmatodo.com");
  revalidatePath("/dashboard", "layout");
}
