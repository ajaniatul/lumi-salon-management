"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Receipt,
  ShoppingBag,
  Scissors,
  Package,
  ShoppingCart,
  TrendingDown,
  UserCheck,
  Clock,
  Award,
  CreditCard,
  BarChart3,
  PieChart,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Menu,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";
import toast from "react-hot-toast";
import { BeauveMark, BeauveFullLogo } from "@/components/BeauveLogo";

// ─── Navigation Definition ───────────────────────────────
const NAV_SECTIONS = [
  {
    label: "Core",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN","MANAGER","RECEPTIONIST","STYLIST"] },
      { label: "Appointments", href: "/appointments", icon: Calendar, roles: ["ADMIN","MANAGER","RECEPTIONIST","STYLIST"] },
      { label: "Customers", href: "/customers", icon: Users, roles: ["ADMIN","MANAGER","RECEPTIONIST"] },
      { label: "Billing", href: "/billing", icon: Receipt, roles: ["ADMIN","MANAGER","RECEPTIONIST"] },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Products", href: "/products", icon: ShoppingBag, roles: ["ADMIN","MANAGER"] },
      { label: "Services", href: "/services", icon: Scissors, roles: ["ADMIN","MANAGER","RECEPTIONIST"] },
      { label: "Inventory", href: "/inventory", icon: Package, roles: ["ADMIN","MANAGER"] },
      { label: "Purchases", href: "/purchases", icon: ShoppingCart, roles: ["ADMIN","MANAGER"] },
      { label: "Expenses", href: "/expenses", icon: TrendingDown, roles: ["ADMIN","MANAGER"] },
      { label: "Petty Cash", href: "/petty-cash", icon: BookOpen, roles: ["ADMIN","MANAGER"] },
    ],
  },
  {
    label: "Staff",
    items: [
      { label: "Staff", href: "/staff", icon: UserCheck, roles: ["ADMIN","MANAGER"] },
      { label: "Attendance", href: "/attendance", icon: Clock, roles: ["ADMIN","MANAGER","STYLIST"] },
      { label: "Commission", href: "/commission", icon: Award, roles: ["ADMIN","MANAGER"] },
    ],
  },
  {
    label: "Loyalty",
    items: [
      { label: "Memberships", href: "/memberships", icon: CreditCard, roles: ["ADMIN","MANAGER","RECEPTIONIST"] },
      { label: "Packages", href: "/packages", icon: Sparkles, roles: ["ADMIN","MANAGER","RECEPTIONIST"] },
    ],
  },
  {
    label: "Analytics",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3, roles: ["ADMIN","MANAGER"] },
      { label: "Analytics", href: "/analytics", icon: PieChart, roles: ["ADMIN","MANAGER"] },
    ],
  },
];

// ─── Props ───────────────────────────────────────────────
interface SidebarProps {
  userRole: Role;
  userName: string;
  userAvatar?: string;
  brandLogo?: string | null;
  brandName?: string;
  brandTagline?: string;
}

export function Sidebar({ userRole, userName, userAvatar, brandLogo, brandName, brandTagline }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Signed out successfully");
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  const canSee = (roles: string[]) => roles.includes(userRole);

  return (
    <aside
      className={cn(
        "flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out flex-shrink-0",
        "border-r border-white/5",
        collapsed ? "w-[70px]" : "w-[240px]"
      )}
      style={{
        background: "linear-gradient(180deg, #2D1B1F 0%, #1A0F12 100%)",
      }}
    >
      {/* ── Logo ── */}
      <div className={cn(
        "flex items-center h-16 border-b border-white/5 flex-shrink-0 relative",
        collapsed ? "justify-center px-0" : "px-4 justify-between"
      )}>
        <div className="flex items-center gap-2.5">
          <BeauveMark size={36} />
          {!collapsed && (
            <div>
              <p className="text-white font-display font-bold text-sm leading-none tracking-wide">{brandName || "Lumi"}</p>
              <p className="text-[9px] font-semibold mt-0.5 tracking-widest uppercase" style={{ color:"#C4956A" }}>{brandTagline || "Beauty Lounge"}</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center justify-center transition-all z-50",
            collapsed
              ? "absolute -right-3 top-5 w-6 h-6 rounded-full border border-white/10 bg-[#2D1B1F] shadow-lg hover:bg-[#3d252a] text-white"
              : "p-1 rounded-lg hover:bg-white/5 text-[#5A3A40]"
          )}
          style={collapsed ? {} : { color: "#5A3A40" }}
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" style={{ color: "#C4956A" }} />
            : <ChevronLeft className="w-4 h-4" />
          }
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-5 px-2 scrollbar-none">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => canSee(item.roles));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label}>
              {!collapsed && (
                <p className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-1.5"
                  style={{ color: "#4A2D33" }}>
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center transition-all duration-150 rounded-xl",
                          collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
                          active
                            ? "text-white"
                            : "hover:bg-white/5"
                        )}
                        style={{
                          background: active
                            ? "linear-gradient(135deg, rgba(183,110,121,0.25), rgba(196,149,106,0.15))"
                            : undefined,
                          color: active ? "#fff" : "#7A5560",
                        }}
                        title={collapsed ? item.label : undefined}
                      >
                        <item.icon
                          className={cn("flex-shrink-0", collapsed ? "w-5 h-5" : "w-4 h-4")}
                          style={{ color: active ? "#D4A0A7" : "#6A4550" }}
                        />
                        {!collapsed && (
                          <span className="text-sm font-medium">
                            {item.label}
                          </span>
                        )}
                        {active && !collapsed && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full"
                            style={{ background: "#B76E79" }} />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* ── Bottom: Settings + User ── */}
      <div className="border-t border-white/5 p-2 space-y-1 flex-shrink-0">
        {userRole === "ADMIN" && (
          <Link
            href="/settings"
            className={cn(
              "flex items-center transition-all duration-150 rounded-xl",
              collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
              "hover:bg-white/5"
            )}
            style={{ color: "#7A5560" }}
          >
            <Settings className={cn("flex-shrink-0", collapsed ? "w-5 h-5" : "w-4 h-4")} style={{ color: "#6A4550" }} />
            {!collapsed && <span className="text-sm font-medium">Settings</span>}
          </Link>
        )}



        {/* User Card */}
        <div className={cn(
          "flex items-center border border-white/5 rounded-xl mt-1",
          collapsed ? "justify-center p-2" : "gap-3 px-3 py-3"
        )} style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #B76E79, #C4956A)" }}>
            {userAvatar
              ? <img src={userAvatar} className="w-8 h-8 rounded-lg object-cover" alt={userName} />
              : userName.charAt(0).toUpperCase()
            }
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{userName}</p>
              <p className="text-xs" style={{ color: "#5A3A40" }}>{userRole}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: "#5A3A40" }}
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
