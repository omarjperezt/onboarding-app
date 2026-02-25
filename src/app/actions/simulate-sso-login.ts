"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function simulateSsoLogin(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { ssoAuthenticatedAt: new Date() },
  });

  revalidatePath("/dashboard");
}
