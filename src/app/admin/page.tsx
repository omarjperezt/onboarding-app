import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminFilters } from "@/components/admin/admin-filters";
import { AdminEmployeeTable } from "@/components/admin/admin-employee-table";
import { Users, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

async function getAdminData() {
  const [users, clusters] = await Promise.all([
    prisma.user.findMany({
      include: {
        cluster: true,
        journeys: {
          include: {
            steps: {
              include: { templateStep: true },
              orderBy: { templateStep: { orderIndex: "asc" } },
            },
          },
        },
        accessProvisionings: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.cluster.findMany({ orderBy: { name: "asc" } }),
  ]);

  return { users, clusters };
}

const statusBadge: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  PRE_HIRE: { label: "Pre-ingreso", variant: "secondary" },
  ACTIVE: { label: "Activo", variant: "default" },
  SUSPENDED: { label: "Suspendido", variant: "destructive" },
};

export default async function AdminPage() {
  const { users, clusters } = await getAdminData();

  // KPI calculations
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "ACTIVE").length;
  const preHireUsers = users.filter((u) => u.status === "PRE_HIRE").length;
  const avgProgress =
    totalUsers > 0
      ? Math.round(
          users.reduce((sum, u) => {
            const journey = u.journeys[0];
            return sum + (journey?.progressPercentage ?? 0);
          }, 0) / totalUsers
        )
      : 0;

  // Serialize dates for client component
  const serializedUsers = JSON.parse(JSON.stringify(users));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Torre de Control</h1>
        <p className="text-sm text-muted-foreground">
          Vista general del onboarding de todos los empleados
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Total Empleados"
          value={totalUsers}
          color="text-primary"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Activos"
          value={activeUsers}
          color="text-emerald-600"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Pre-ingreso"
          value={preHireUsers}
          color="text-amber-600"
        />
        <KpiCard
          icon={TrendingUp}
          label="Progreso Prom."
          value={`${avgProgress}%`}
          color="text-blue-600"
        />
      </div>

      {/* Filters */}
      <AdminFilters clusters={clusters} />

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Empleados</CardTitle>
          <CardDescription>
            {totalUsers} empleados registrados en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminEmployeeTable users={serializedUsers} />
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="pb-8 text-center text-[10px] text-muted-foreground">
        Farmatodo Onboarding OS &middot; Admin &middot;{" "}
        {new Date().getFullYear()}
      </p>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted ${color}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
