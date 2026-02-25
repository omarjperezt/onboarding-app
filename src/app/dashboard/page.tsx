import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid,
  AlertTriangle,
  Users,
  IdCard,
  BookOpen,
  Headphones,
  Home,
  Map,
  CreditCard,
  User,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { DevSimulator } from "@/components/dev/dev-simulator";

// Force dynamic rendering (requires DB at runtime, not build time)
export const dynamic = "force-dynamic";

// In production, this would come from the auth session.
// For now, we fetch the first PRE_HIRE user for demo purposes.
async function getDashboardData() {
  const user = await prisma.user.findFirst({
    where: { personalEmail: "josmar.rodriguez@gmail.com" },
    include: {
      cluster: true,
      journeys: {
        include: {
          journeyTemplate: true,
          steps: {
            include: {
              templateStep: true,
            },
            orderBy: [
              { resolvedOrder: "asc" },
              { templateStep: { orderIndex: "asc" } },
            ],
          },
        },
      },
      accessProvisionings: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return user;
}

export default async function DashboardPage() {
  const user = await getDashboardData();

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Sin datos disponibles</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ejecuta el seed para cargar datos de prueba:
              <code className="mt-2 block rounded bg-muted p-2 text-xs font-mono">
                npm run db:seed
              </code>
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const journey = user.journeys[0];
  const hasCorporateEmail = !!user.corporateEmail;
  const firstName = user.fullName.split(" ")[0];
  const initials = user.fullName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Calculate progress from actual step data
  const totalSteps = journey?.steps.length ?? 0;
  const completedSteps =
    journey?.steps.filter((s) => s.status === "COMPLETED").length ?? 0;
  const progressPercentage =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Find first PENDING step for the "next action" card
  const nextPendingStep = journey?.steps.find((s) => s.status === "PENDING");
  const nextStepDescription = nextPendingStep?.templateStep.description ?? null;

  // Determine the display order for the step label (e.g. "Día 1")
  const nextStepOrder =
    nextPendingStep?.resolvedOrder ??
    nextPendingStep?.templateStep.orderIndex ??
    1;

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-24">
      {/* ── Deep Blue Header ── */}
      <header className="relative bg-[#0F4C81] px-6 pt-6 pb-16">
        {/* Gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#124e82] to-[#0b3d6e]" />

        <div className="relative z-10 mx-auto max-w-lg">
          {/* Top row: logo + avatar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-white/90">
              <LayoutGrid className="h-5 w-5" />
              <span className="text-sm font-bold tracking-wider uppercase">
                Farmatodo OS
              </span>
            </div>
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-400 ring-2 ring-white/40 text-white text-sm font-bold shadow-lg">
                {initials}
              </div>
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#0F4C81] bg-emerald-400" />
            </div>
          </div>

          {/* Identity warning pill */}
          {!hasCorporateEmail && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-500/25 px-4 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-300" />
              <span className="text-[13px] font-semibold text-amber-100">
                Identidad Digital Pendiente
              </span>
            </div>
          )}

          {/* Greeting */}
          <h1 className="mt-5 text-[32px] font-extrabold text-white leading-tight tracking-tight">
            ¡Hola, {firstName}!
          </h1>

          {/* Progress section */}
          <div className="mt-6">
            <div className="flex items-baseline justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-widest text-white/60">
                Tu Progreso
              </span>
              <span className="text-base font-bold text-white">
                {progressPercentage}%
              </span>
            </div>
            {/* Custom progress bar for dark background */}
            <div className="h-3 w-full rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content (overlaps header via negative margin) ── */}
      <main className="mx-auto max-w-lg px-5 -mt-10 relative z-20 space-y-6">
        {/* ── Next Action Focus Card ── */}
        {nextPendingStep && (
          <div className="rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            {/* Top: label + icon */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#0F4C81]/70">
                  Siguiente Misión
                </p>
                <h2 className="mt-2.5 text-xl font-bold text-[#1a1a2e] leading-snug">
                  Día {nextStepOrder}: {nextPendingStep.templateStep.title}
                </h2>
              </div>
              <div className="ml-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#0F4C81]/8">
                <ClipboardList className="h-7 w-7 text-[#0F4C81]" />
              </div>
            </div>

            {/* Description */}
            {nextStepDescription && (
              <p className="mt-3 text-[15px] leading-relaxed text-gray-500">
                {nextStepDescription}
              </p>
            )}

            {/* CTA Button */}
            <button
              type="button"
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F4C81] px-6 py-4 text-[15px] font-semibold text-white shadow-md transition-colors hover:bg-[#0d4070] active:bg-[#0a3560]"
            >
              Comenzar Misión
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* All steps completed state */}
        {journey && !nextPendingStep && (
          <div className="rounded-2xl bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.12)] text-center">
            <p className="text-lg font-bold text-[#1a1a2e]">
              ¡Todo completado!
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Has finalizado todas las misiones de tu journey.
            </p>
          </div>
        )}

        {/* ── Quick Access Grid ── */}
        <section>
          <h2 className="text-[18px] font-bold text-[#1a1a2e] mb-4">
            Acceso Rápido
          </h2>
          <div className="grid grid-cols-2 gap-3.5">
            <QuickAccessCard
              icon={Users}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
              label="Mi Equipo"
              subtitle="5 miembros"
            />
            <QuickAccessCard
              icon={IdCard}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              label="Credenciales"
              subtitle="Acceso activo"
              statusDot
            />
            <QuickAccessCard
              icon={BookOpen}
              iconBg="bg-orange-50"
              iconColor="text-orange-500"
              label="Wiki"
              subtitle="Manuales y guías"
            />
            <QuickAccessCard
              icon={Headphones}
              iconBg="bg-teal-50"
              iconColor="text-teal-600"
              label="Soporte TI"
              subtitle="Ayuda 24/7"
            />
          </div>
        </section>

        {/* Footer */}
        <p className="pb-2 text-center text-[10px] text-gray-400">
          Farmatodo Onboarding OS &middot; {new Date().getFullYear()}
        </p>
      </main>

      {/* ── Fixed Bottom Navigation ── */}
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-lg flex items-center justify-around px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <BottomNavItem icon={Home} label="Inicio" active />
          <BottomNavItem icon={Map} label="Ruta" />
          <BottomNavItem icon={CreditCard} label="Accesos" />
          <BottomNavItem icon={User} label="Perfil" />
        </div>
      </nav>

      {/* Dev-only simulator — stripped in production builds */}
      {process.env.NODE_ENV === "development" && (
        <DevSimulator userId={user.id} />
      )}
    </div>
  );
}

/* ── Helper Components ── */

function QuickAccessCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  subtitle,
  statusDot = false,
}: {
  icon: typeof Users;
  iconBg: string;
  iconColor: string;
  label: string;
  subtitle: string;
  statusDot?: boolean;
}) {
  return (
    <button
      type="button"
      className="flex flex-col items-start gap-4 rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
    >
      <div className="relative">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconBg}`}
        >
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        {statusDot && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
        )}
      </div>
      <div>
        <p className="text-[15px] font-bold text-[#1a1a2e]">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
    </button>
  );
}

function BottomNavItem({
  icon: Icon,
  label,
  active = false,
}: {
  icon: typeof Home;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className="flex flex-col items-center gap-1 min-w-[56px]"
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          active ? "bg-[#0F4C81]" : ""
        }`}
      >
        <Icon
          className={`h-5 w-5 ${active ? "text-white" : "text-gray-400"}`}
        />
      </div>
      <span
        className={`text-[11px] ${
          active
            ? "font-bold text-[#0F4C81]"
            : "font-medium text-gray-400"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
