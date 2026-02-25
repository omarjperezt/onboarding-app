import { prisma } from "@/lib/prisma";
import {
  User,
  Mail,
  Building2,
  Globe,
  Shield,
  LogOut,
} from "lucide-react";
import type { UserStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const statusConfig: Record<
  UserStatus,
  { label: string; dotColor: string; textColor: string; bgColor: string }
> = {
  PRE_HIRE: {
    label: "Pre-ingreso",
    dotColor: "bg-amber-400",
    textColor: "text-amber-700",
    bgColor: "bg-amber-50",
  },
  ACTIVE: {
    label: "Activo",
    dotColor: "bg-emerald-400",
    textColor: "text-emerald-700",
    bgColor: "bg-emerald-50",
  },
  SUSPENDED: {
    label: "Suspendido",
    dotColor: "bg-red-400",
    textColor: "text-red-700",
    bgColor: "bg-red-50",
  },
};

async function getPerfilData() {
  const user = await prisma.user.findFirst({
    where: { personalEmail: "josmar.rodriguez@gmail.com" },
    include: { cluster: true },
  });

  return user;
}

export default async function PerfilPage() {
  const user = await getPerfilData();

  if (!user) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          Sin datos disponibles. Ejecuta el seed.
        </p>
      </div>
    );
  }

  const config = statusConfig[user.status];
  const initials = user.fullName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      {/* ── Profile Header ── */}
      <div className="bg-white px-5 pt-8 pb-6 border-b border-gray-100">
        <div className="mx-auto max-w-lg flex flex-col items-center text-center">
          {/* Avatar */}
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#0F4C81] to-[#0b3d6e] text-white text-2xl font-bold shadow-lg">
              {initials}
            </div>
            <span
              className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white ${config.dotColor}`}
            />
          </div>

          {/* Name + Status */}
          <h1 className="mt-4 text-xl font-bold text-[#1a1a2e]">
            {user.fullName}
          </h1>
          <div
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${config.bgColor}`}
          >
            <span className={`h-2 w-2 rounded-full ${config.dotColor}`} />
            <span className={`text-[11px] font-semibold ${config.textColor}`}>
              {config.label}
            </span>
          </div>
        </div>
      </div>

      {/* ── Info Cards ── */}
      <div className="mx-auto max-w-lg px-5 pt-5 pb-4 space-y-3">
        <ProfileRow
          icon={Mail}
          label="Correo personal"
          value={user.personalEmail}
        />
        {user.corporateEmail && (
          <ProfileRow
            icon={Shield}
            label="Correo corporativo"
            value={user.corporateEmail}
          />
        )}
        {user.cluster && (
          <ProfileRow
            icon={Building2}
            label="Cluster"
            value={user.cluster.name}
          />
        )}
        {user.cluster && (
          <ProfileRow
            icon={Globe}
            label="País"
            value={user.cluster.country}
          />
        )}
        {user.position && (
          <ProfileRow
            icon={User}
            label="Cargo"
            value={user.position}
          />
        )}

        {/* Cerrar Sesión placeholder */}
        <div className="pt-4">
          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-6 py-4 text-[15px] font-semibold text-gray-400 shadow-sm cursor-not-allowed"
          >
            <LogOut className="h-5 w-5" />
            Cerrar Sesión
          </button>
          <p className="mt-2 text-center text-[10px] text-gray-400">
            Disponible cuando se configure la autenticación
          </p>
        </div>
      </div>
    </>
  );
}

function ProfileRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50">
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-[15px] font-semibold text-[#1a1a2e] truncate">
          {value}
        </p>
      </div>
    </div>
  );
}
