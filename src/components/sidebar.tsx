"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, ClipboardList, RefreshCw, ShoppingCart,
  Upload, Users, ScrollText, Database, LogOut, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/generated/prisma/client";

const navItems = [
  { href: "/dashboard",    label: "Dashboard",   icon: LayoutDashboard, roles: ["ADMIN","PRODUCTION","PLANNER","TECHNICAL","PROCUREMENT","SALES"] },
  { href: "/orders",       label: "Orders",      icon: ClipboardList,   roles: ["ADMIN","PRODUCTION","PLANNER","TECHNICAL","PROCUREMENT","SALES"] },
  { href: "/update",       label: "Update",      icon: RefreshCw,       roles: ["ADMIN","PRODUCTION","PLANNER","TECHNICAL","PROCUREMENT"] },
  { href: "/stages",       label: "Stages",      icon: Layers,          roles: ["ADMIN","PRODUCTION","PLANNER","TECHNICAL","PROCUREMENT"] },
  { href: "/procurement",  label: "Procurement", icon: ShoppingCart,    roles: ["ADMIN","TECHNICAL","PROCUREMENT"] },
  { href: "/import",       label: "Import",      icon: Upload,          roles: ["ADMIN","PRODUCTION","PLANNER","TECHNICAL","PROCUREMENT"] },
  { href: "/admin/data",   label: "Data",        icon: Database,        roles: ["ADMIN"] },
  { href: "/admin/users",  label: "Users",       icon: Users,           roles: ["ADMIN"] },
  { href: "/admin/audit",  label: "Audit Log",   icon: ScrollText,      roles: ["ADMIN"] },
] as const;

const roleColors: Record<Role, string> = {
  ADMIN:       "bg-red-100 text-red-700",
  PRODUCTION:  "bg-blue-100 text-blue-700",
  PLANNER:     "bg-purple-100 text-purple-700",
  TECHNICAL:   "bg-amber-100 text-amber-700",
  PROCUREMENT: "bg-green-100 text-green-700",
  SALES:       "bg-gray-100 text-gray-600",
};

interface SidebarProps { role: Role; displayName: string; }

export function Sidebar({ role, displayName }: SidebarProps) {
  const pathname = usePathname();
  const visible = navItems.filter(item => (item.roles as readonly string[]).includes(role));

  const initials = displayName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-gray-900 text-gray-100">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-700">
        <p className="font-bold text-white text-sm tracking-wide">Production Dashboard</p>
        <p className="text-gray-400 text-xs mt-0.5">Batal Furniture</p>
      </div>

      {/* User card */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{displayName}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleColors[role]}`}>{role}</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visible.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-gray-700" : "")} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white w-full transition-all"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
