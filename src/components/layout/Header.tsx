"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Bell,
  Plus,
  Calendar,
  UserPlus,
  FileText,
  ChevronDown,
  Package,
  ShoppingCart,
  Receipt,
  Users,
  Clipboard,
  Scissors,
  ShoppingBag,
  AlertTriangle,
  CreditCard,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useHeaderAction, type HeaderButton } from "@/components/layout/HeaderActionContext";
import { Wallet } from "lucide-react";
import type { Role } from "@/types";

// Page Titles
const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard":   { title: "Dashboard",   subtitle: "Welcome back" },
  "/appointments":{ title: "Appointments",subtitle: "Manage bookings" },
  "/customers":   { title: "Customers",   subtitle: "Customer profiles & history" },
  "/billing":     { title: "Billing & Invoices", subtitle: "GST-compliant invoices · CGST · SGST" },
  "/products":    { title: "Products",    subtitle: "Product catalogue" },
  "/services":    { title: "Services",    subtitle: "Service menu & pricing" },
  "/inventory":   { title: "Inventory",   subtitle: "Stock management" },
  "/purchases":   { title: "Purchases",   subtitle: "Supplier invoices" },
  "/expenses":    { title: "Expenses",    subtitle: "Expense tracking" },
  "/petty-cash":  { title: "Petty Cash Book", subtitle: "Track day-to-day small cash receipts and payments" },
  "/memberships": { title: "Memberships",     subtitle: "Silver, Gold & Platinum plans · active members" },
  "/packages":    { title: "Service Packages", subtitle: "Pre-paid bundles · customers redeem over time" },
  "/staff":       { title: "Staff",       subtitle: "Team management" },
  "/attendance":  { title: "Attendance",  subtitle: "Clock in / out" },
  "/commission":  { title: "Commission",  subtitle: "Staff earnings" },
  "/reports":     { title: "Reports",     subtitle: "Business analytics" },
  "/analytics":   { title: "Analytics",   subtitle: "Insights & trends" },
  "/settings":    { title: "Settings",    subtitle: "Salon configuration" },
};

// Quick Actions
const QUICK_ACTIONS = [
  { label: "New Appointment", href: "/appointments", icon: Calendar,     group: "Bookings" },
  { label: "Add Customer",    href: "/customers",    icon: UserPlus,     group: "Bookings" },
  { label: "Create Invoice",  href: "/billing",      icon: FileText,     group: "Finance"  },
  { label: "Add Expense",     href: "/expenses",     icon: Receipt,      group: "Finance"  },
  { label: "Stock Entry",     href: "/inventory",    icon: ShoppingCart, group: "Stock"    },
  { label: "New Purchase",    href: "/purchases",    icon: Package,      group: "Stock"    },
  { label: "Add Staff",       href: "/staff",        icon: Users,        group: "Team"     },
  { label: "Mark Attendance", href: "/attendance",   icon: Clipboard,    group: "Team"     },
];

const ACTION_GROUPS = ["Bookings","Finance","Stock","Team"] as const;

// Notifications — operational alerts surfaced from across the app
const NOTIFICATIONS = [
  { icon: AlertTriangle, color: "#EF4444", title: "Low stock: Lakme Eyeconic Kajal", desc: "Only 3 left (min 10). Reorder soon.", href: "/inventory" },
  { icon: Receipt,       color: "#F59E0B", title: "3 invoices pending payment", desc: "₹10,000 outstanding across customers.", href: "/billing" },
  { icon: CreditCard,    color: "#111111", title: "Membership expiring soon", desc: "Anjali Mehta's Gold plan expires in 18 days.", href: "/memberships" },
];

type SearchResult = {
  label: string;
  sub: string;
  href: string;
  kind: string;
};

interface HeaderProps {
  userRole: Role;
  userName: string;
}

export function Header({ userRole, userName }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { action } = useHeaderAction();
  const headerButtons: HeaderButton[] = action ? (Array.isArray(action) ? action : [action]) : [];
  const [showActions, setShowActions] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const pageInfo = Object.entries(PAGE_TITLES).find(([key]) =>
    pathname.startsWith(key)
  )?.[1] ?? { title: "Salon" };

  const today = formatDate(new Date(), "EEEE, dd MMMM yyyy");
  const canBook = userRole !== "STYLIST";

  // Close the search palette on Escape
  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSearchOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  // Reset the query whenever the palette closes
  useEffect(() => { if (!searchOpen) setQuery(""); }, [searchOpen]);

  // Global search across the shared reference data + pages
  // Dynamic search results from database
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (json.success) {
          setResults(json.data);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const goTo = (href: string) => { setSearchOpen(false); router.push(href); };

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-ivory-300 bg-white flex-shrink-0">

      <div>
        <h1 className="text-lg font-semibold text-foreground leading-none">
          {pageInfo.title}
        </h1>
        {pageInfo.subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{pageInfo.subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">

        <span className="hidden md:block text-xs text-muted-foreground">
          {today}
        </span>

        <button
          onClick={() => setSearchOpen(true)}
          className="p-2 rounded-xl hover:bg-ivory-200 transition-colors text-muted-foreground hover:text-foreground"
          title="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-xl hover:bg-ivory-200 transition-colors text-muted-foreground hover:text-foreground"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {NOTIFICATIONS.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary-500" />
            )}
          </button>

          {showNotifs && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifs(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-luxury border border-ivory-300 z-20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-ivory-200">
                  <p className="text-sm font-semibold text-foreground">Notifications</p>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700">{NOTIFICATIONS.length} new</span>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-ivory-100">
                  {NOTIFICATIONS.map((n, i) => (
                    <Link
                      key={i}
                      href={n.href}
                      onClick={() => setShowNotifs(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-ivory-100 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${n.color}18` }}>
                        <n.icon className="w-4 h-4" style={{ color: n.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{n.desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {headerButtons.length > 0 ? (
          <div className="flex items-center gap-2">
            {headerButtons.map((btn, i) => (
              btn.variant === "outline" ? (
                <button key={i} onClick={btn.onClick}
                  className="flex items-center gap-1.5 btn-outline text-sm px-3.5 py-2">
                  {btn.icon === "wallet" && <Wallet className="w-4 h-4" />}
                  <span>{btn.label}</span>
                </button>
              ) : (
                <button key={i} onClick={btn.onClick}
                  className="flex items-center gap-1.5 btn-primary text-sm px-3.5 py-2">
                  <Plus className="w-4 h-4" />
                  <span>{btn.label}</span>
                </button>
              )
            ))}
          </div>
        ) : null}
      </div>

      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center"
          style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(4px)", paddingTop: "15vh" }}
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-2xl shadow-luxury border border-ivory-300 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-ivory-300">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search customers, services, products, pages..."
                className="flex-1 outline-none text-sm text-foreground placeholder:text-muted-foreground bg-transparent"
              />
              <kbd className="text-xs text-muted-foreground border border-ivory-300 rounded px-1.5 py-0.5">
                ESC
              </kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              {!query.trim() ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Start typing to search across customers, services, products and pages
                </p>
              ) : results.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No results for <strong>&ldquo;{query}&rdquo;</strong>
                </p>
              ) : (
                <div className="py-2 divide-y divide-ivory-100">
                  {results.map((r, i) => {
                    const Icon = r.kind === "Customer" ? Users : r.kind === "Service" ? Scissors : r.kind === "Product" ? ShoppingBag : FileText;
                    return (
                      <button
                        key={i}
                        onClick={() => goTo(r.href)}
                        className="w-full text-left flex items-center gap-3 px-5 py-2.5 hover:bg-ivory-100 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(183,110,121,0.1)" }}>
                          <Icon className="w-4 h-4" style={{ color: "#111111" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{r.label}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{r.sub}</p>
                        </div>
                        <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground flex-shrink-0">{r.kind}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
