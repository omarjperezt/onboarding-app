import { LayoutDashboard, Users, Route, Zap, Mail } from "lucide-react";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight">
              Onboarding<span className="text-primary">OS</span>
            </span>
            <span className="rounded-md border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Admin
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Torre de Control
            </Link>
            <Link
              href="/admin/journeys"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <Route className="h-3.5 w-3.5" />
              Journeys
            </Link>
            <Link
              href="/admin/communications"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <Mail className="h-3.5 w-3.5" />
              Comunicaciones
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <Users className="h-3.5 w-3.5" />
              Vista Empleado
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
