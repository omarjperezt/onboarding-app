import { prisma } from "@/lib/prisma";
import { BottomNav } from "@/components/dashboard/bottom-nav";
import { DevSimulator } from "@/components/dev/dev-simulator";

export const dynamic = "force-dynamic";

async function getDashboardUserId() {
  const user = await prisma.user.findFirst({
    where: { personalEmail: "josmar.rodriguez@gmail.com" },
    select: { id: true },
  });
  return user?.id ?? null;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getDashboardUserId();

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-24">
      {children}

      <BottomNav />

      {process.env.NODE_ENV === "development" && userId && (
        <DevSimulator userId={userId} />
      )}
    </div>
  );
}
