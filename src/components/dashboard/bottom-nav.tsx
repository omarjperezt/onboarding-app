"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, CreditCard, User } from "lucide-react";

const tabs = [
  { href: "/dashboard", icon: Home, label: "Inicio" },
  { href: "/dashboard/ruta", icon: Map, label: "Ruta" },
  { href: "/dashboard/accesos", icon: CreditCard, label: "Accesos" },
  { href: "/dashboard/perfil", icon: User, label: "Perfil" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-lg flex items-center justify-around px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
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
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
