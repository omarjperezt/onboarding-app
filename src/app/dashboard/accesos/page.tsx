import { prisma } from "@/lib/prisma";
import { CreditCard } from "lucide-react";
import { AccessCardGrid } from "@/components/journey/access-list";
import type { AccessItem } from "@/components/journey/access-list";

export const dynamic = "force-dynamic";

async function getAccesosData() {
  const user = await prisma.user.findFirst({
    where: { personalEmail: "josmar.rodriguez@gmail.com" },
    select: {
      id: true,
      fullName: true,
      corporateEmail: true,
      accessProvisionings: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return user;
}

export default async function AccesosPage() {
  const user = await getAccesosData();

  if (!user) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          Sin datos disponibles. Ejecuta el seed.
        </p>
      </div>
    );
  }

  const accesses: AccessItem[] = user.accessProvisionings.map((a) => ({
    id: a.id,
    systemName: a.systemName,
    status: a.status,
    jiraTicketId: a.jiraTicketId,
    createdAt: a.createdAt.toISOString(),
  }));

  const provisionedCount = accesses.filter(
    (a) => a.status === "PROVISIONED"
  ).length;
  const requestedCount = accesses.filter(
    (a) => a.status === "REQUESTED"
  ).length;
  const revokedCount = accesses.filter(
    (a) => a.status === "REVOKED"
  ).length;

  return (
    <>
      {/* ── Page Header ── */}
      <div className="bg-white px-5 pt-6 pb-5 border-b border-gray-100">
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold text-[#1a1a2e]">Tus Accesos</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Credenciales y sistemas asignados
          </p>

          {/* Summary pills */}
          {accesses.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {provisionedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {provisionedCount} Activo{provisionedCount !== 1 ? "s" : ""}
                  </span>
                </span>
              )}
              {requestedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="text-[11px] font-semibold text-amber-700">
                    {requestedCount} Pendiente{requestedCount !== 1 ? "s" : ""}
                  </span>
                </span>
              )}
              {revokedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="text-[11px] font-semibold text-red-700">
                    {revokedCount} Revocado{revokedCount !== 1 ? "s" : ""}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Access Cards ── */}
      <div className="mx-auto max-w-lg px-5 pt-5 pb-4">
        {accesses.length > 0 ? (
          <AccessCardGrid accesses={accesses} />
        ) : (
          <div className="mt-8 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 mb-4">
              <CreditCard className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">
              Aún no tienes accesos asignados.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Tus credenciales aparecerán aquí cuando TI las aprovisione.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
