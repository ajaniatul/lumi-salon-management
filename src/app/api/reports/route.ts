import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

function paymentLabel(method: string) {
  switch (method) {
    case "CASH": return "Cash";
    case "UPI":  return "UPI";
    case "CARD": return "Card";
    case "SPLIT": return "Mixed";
    default:     return method;
  }
}

function catLabel(s: string) {
  // Convert HAIR_CARE → "Hair Care" etc.
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const year  = parseInt(url.searchParams.get("year")  ?? String(new Date().getFullYear()));
  const month = parseInt(url.searchParams.get("month") ?? String(new Date().getMonth() + 1));

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999);
  const yearStart  = new Date(year, 0, 1);
  const yearEnd    = new Date(year, 11, 31, 23, 59, 59, 999);

  try {
    const [monthInvoices, yearInvoices, allInvoices] = await Promise.all([
      // Full detail for daily / weekly / service / product tabs
      prisma.invoice.findMany({
        where: { createdAt: { gte: monthStart, lte: monthEnd } },
        include: {
          items: { include: { service: true, product: true } },
          payments: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      // Year invoices for monthly tab
      prisma.invoice.findMany({
        where: { createdAt: { gte: yearStart, lte: yearEnd } },
        include: { items: true },
        orderBy: { createdAt: "asc" },
      }),
      // All invoices for yearly tab
      prisma.invoice.findMany({
        include: { items: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // ── Daily ──────────────────────────────────────────────
    const daysInMonth = new Date(year, month, 0).getDate();
    const daily = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayInvs = monthInvoices.filter(inv => new Date(inv.createdAt).getDate() === d);
      let svc = 0, prd = 0;
      const custs = new Set<string>();
      const methods: Record<string, number> = {};

      for (const inv of dayInvs) {
        custs.add(inv.customerId);
        for (const item of inv.items) {
          const amt = Number(item.total);
          if (item.itemType === "PRODUCT") prd += amt;
          else svc += amt;
        }
        for (const pay of inv.payments) {
          const lbl = paymentLabel(pay.method);
          methods[lbl] = (methods[lbl] ?? 0) + 1;
        }
      }
      const topMethod = Object.entries(methods).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
      const date = new Date(year, month - 1, d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      daily.push({ day: d, date, services: svc, products: prd, customers: custs.size, method: topMethod });
    }

    // ── Weekly ─────────────────────────────────────────────
    const weekly = [];
    const MSHORT = new Date(year, month - 1, 1).toLocaleString("en-GB", { month: "short" });
    let weekNum = 1;
    let ws = 1;
    while (ws <= daysInMonth) {
      const we  = Math.min(ws + 6, daysInMonth);
      const seg = daily.slice(ws - 1, we);
      const services  = seg.reduce((s, d) => s + d.services, 0);
      const products  = seg.reduce((s, d) => s + d.products, 0);
      const customers = seg.reduce((s, d) => s + d.customers, 0);
      const total = services + products;
      const avgTicket = customers > 0 ? Math.round(total / customers) : 0;
      const label = `Week ${weekNum} (${String(ws).padStart(2, "0")}–${String(we).padStart(2, "0")} ${MSHORT})`;
      weekly.push({ week: label, services, products, customers, avgTicket });
      ws += 7; weekNum++;
    }

    // ── Monthly ────────────────────────────────────────────
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const nowMonth = new Date().getMonth() + 1;
    const nowYear  = new Date().getFullYear();
    const monthly = [];
    for (let m = 1; m <= 12; m++) {
      if (year === nowYear && m > nowMonth) break;
      const mInvs = yearInvoices.filter(inv => new Date(inv.createdAt).getMonth() + 1 === m);
      let svc = 0, prd = 0;
      const custs = new Set<string>();
      for (const inv of mInvs) {
        custs.add(inv.customerId);
        for (const item of inv.items) {
          const amt = Number(item.total);
          if (item.itemType === "PRODUCT") prd += amt;
          else svc += amt;
        }
      }
      const total = svc + prd;
      const customers = custs.size;
      monthly.push({ month: `${MONTHS[m - 1]} ${year}`, services: svc, products: prd, customers, avgTicket: customers > 0 ? Math.round(total / customers) : 0 });
    }

    // ── Yearly ─────────────────────────────────────────────
    const yMap: Record<string, { svc: number; prd: number; custs: Set<string> }> = {};
    for (const inv of allInvoices) {
      const y = String(new Date(inv.createdAt).getFullYear());
      if (!yMap[y]) yMap[y] = { svc: 0, prd: 0, custs: new Set() };
      yMap[y].custs.add(inv.customerId);
      for (const item of inv.items) {
        const amt = Number(item.total);
        if (item.itemType === "PRODUCT") yMap[y].prd += amt;
        else yMap[y].svc += amt;
      }
    }
    const thisYear = new Date().getFullYear();
    const yearly = Object.entries(yMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([y, d]) => {
        const total = d.svc + d.prd;
        const customers = d.custs.size;
        return {
          year:     Number(y) === thisYear ? `${y} (YTD)` : y,
          services: d.svc, products: d.prd, customers,
          avgTicket: customers > 0 ? Math.round(total / customers) : 0,
        };
      });

    // ── Service-wise ───────────────────────────────────────
    const sMap: Record<string, { category: string; bookings: number; revenue: number; gst: number }> = {};
    for (const inv of monthInvoices) {
      for (const item of inv.items) {
        if (item.itemType === "PRODUCT") continue;
        const name = item.name;
        if (!sMap[name]) {
          sMap[name] = {
            category: catLabel(item.service?.category ?? "SERVICE"),
            bookings: 0, revenue: 0,
            gst: Number(item.gstRate),
          };
        }
        sMap[name].bookings += item.quantity;
        sMap[name].revenue  += Number(item.total);
      }
    }
    const service = Object.entries(sMap)
      .map(([name, d]) => ({
        service: name, category: d.category, bookings: d.bookings, revenue: d.revenue,
        avgTicket: d.bookings > 0 ? Math.round(d.revenue / d.bookings) : 0,
        gst: d.gst,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // ── Product-wise ───────────────────────────────────────
    const pMap: Record<string, { category: string; unitsSold: number; revenue: number; gst: number; hsnCode: string | null }> = {};
    for (const inv of monthInvoices) {
      for (const item of inv.items) {
        if (item.itemType !== "PRODUCT") continue;
        const name = item.name;
        if (!pMap[name]) {
          pMap[name] = {
            category: catLabel(item.product?.category ?? "PRODUCT"),
            unitsSold: 0, revenue: 0,
            gst: Number(item.gstRate),
            hsnCode: item.product?.hsnCode ?? null,
          };
        }
        pMap[name].unitsSold += item.quantity;
        pMap[name].revenue   += Number(item.total);
      }
    }
    const product = Object.entries(pMap)
      .map(([name, d]) => ({
        product: name, category: d.category, unitsSold: d.unitsSold, revenue: d.revenue,
        avgPrice: d.unitsSold > 0 ? Math.round(d.revenue / d.unitsSold) : 0,
        gst: d.gst, hsnCode: d.hsnCode,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({ success: true, data: { daily, weekly, monthly, yearly, service, product } });
  } catch (e) {
    console.error("[REPORTS GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load reports." }, { status: 500 });
  }
}
