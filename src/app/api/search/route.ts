import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Page Titles for search fallback
const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard":   { title: "Dashboard",   subtitle: "Welcome back" },
  "/appointments":{ title: "Appointments",subtitle: "Manage bookings" },
  "/customers":   { title: "Customers",   subtitle: "Customer profiles & history" },
  "/billing":     { title: "Billing & Invoices", subtitle: "GST-compliant invoices" },
  "/products":    { title: "Products",    subtitle: "Product catalogue" },
  "/services":    { title: "Services",    subtitle: "Service menu & pricing" },
  "/inventory":   { title: "Inventory",   subtitle: "Stock management" },
  "/purchases":   { title: "Purchases",   subtitle: "Supplier invoices" },
  "/expenses":    { title: "Expenses",    subtitle: "Expense tracking" },
  "/petty-cash":  { title: "Petty Cash Book", subtitle: "Track small cash transactions" },
  "/memberships": { title: "Memberships",     subtitle: "Silver, Gold & Platinum plans" },
  "/packages":    { title: "Service Packages", subtitle: "Pre-paid bundles" },
  "/staff":       { title: "Staff",       subtitle: "Team management" },
  "/attendance":  { title: "Attendance",  subtitle: "Clock in / out" },
  "/commission":  { title: "Commission",  subtitle: "Staff earnings" },
  "/reports":     { title: "Reports",     subtitle: "Business analytics" },
  "/analytics":   { title: "Analytics",   subtitle: "Insights & trends" },
  "/settings":    { title: "Settings",    subtitle: "Salon configuration" },
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    if (!q) return NextResponse.json({ success: true, data: [] });

    // Query in parallel
    const [dbCustomers, dbServices, dbProducts] = await Promise.all([
      prisma.customer.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } }
          ]
        },
        select: { id: true, name: true, phone: true, membership: { include: { membership: true } } },
        take: 5
      }),
      prisma.service.findMany({
        where: {
          isActive: true,
          name: { contains: q, mode: "insensitive" }
        },
        select: { name: true, category: true, price: true },
        take: 5
      }),
      prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } }
          ]
        },
        select: { name: true, brand: true, price: true },
        take: 5
      })
    ]);

    const out: any[] = [];

    // Map customers
    dbCustomers.forEach(c => {
      const activeMember = c.membership;
      const tier = activeMember ? activeMember.membership.name : null;
      out.push({
        label: c.name,
        sub: `${c.phone}${tier ? ` · ${tier}` : ""}`,
        href: `/customers/${c.id}`,
        kind: "Customer"
      });
    });

    // Map services
    dbServices.forEach(s => {
      out.push({
        label: s.name,
        sub: `${s.category.charAt(0) + s.category.slice(1).toLowerCase()} · ₹${Number(s.price).toLocaleString("en-IN")}`,
        href: "/services",
        kind: "Service"
      });
    });

    // Map products
    dbProducts.forEach(p => {
      out.push({
        label: p.name,
        sub: `${p.brand} · ₹${Number(p.price).toLocaleString("en-IN")}`,
        href: "/products",
        kind: "Product"
      });
    });

    // Match static pages
    for (const [href, info] of Object.entries(PAGE_TITLES)) {
      if (info.title.toLowerCase().includes(q.toLowerCase())) {
        out.push({
          label: info.title,
          sub: info.subtitle ?? "Go to page",
          href,
          kind: "Page"
        });
      }
    }

    return NextResponse.json({ success: true, data: out.slice(0, 12) });
  } catch (e) {
    console.error("[SEARCH GET]", e);
    return NextResponse.json({ success: false, error: "Search failed." }, { status: 500 });
  }
}
