import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const monthEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const inRange = (d: Date, from: Date, to: Date) => d >= from && d <= to;

// GET /api/analytics — customer segmentation, retention trend, stylist benchmarks, rule-based insights
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const now = new Date();
    const sixMoAgo = daysAgo(180);

    const [customers, invoices6mo, allInvoices, appointmentsAllCompleted, monthAppointments, staff, products] = await Promise.all([
      prisma.customer.findMany({ where: { isActive: true }, select: { id: true, name: true, phone: true, createdAt: true } }),
      prisma.invoice.findMany({ where: { createdAt: { gte: sixMoAgo } }, select: { customerId: true, totalAmount: true, createdAt: true } }),
      prisma.invoice.findMany({ select: { customerId: true, totalAmount: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
      prisma.appointment.findMany({ where: { status: "COMPLETED" }, select: { staffId: true, customerId: true } }),
      prisma.appointment.findMany({
        where: { status: "COMPLETED", startTime: { gte: monthStart(now), lte: monthEnd(now) } },
        select: { staffId: true, services: { select: { price: true } } },
      }),
      prisma.staff.findMany({ where: { isActive: true }, select: { id: true, name: true, rating: true } }),
      prisma.product.findMany({ where: { isActive: true }, select: { name: true, stockQuantity: true, minStockLevel: true } }),
    ]);
    const appointmentsAllTime = await prisma.appointment.findMany({ select: { startTime: true } });

    // ── Per-customer recency / frequency / monetary (last 6 months) ──
    const custStats = new Map<string, { spend6mo: number; visits6mo: number; lastVisit: Date | null }>();
    for (const c of customers) custStats.set(c.id, { spend6mo: 0, visits6mo: 0, lastVisit: null });
    for (const inv of invoices6mo) {
      const s = custStats.get(inv.customerId);
      if (!s) continue;
      s.spend6mo += Number(inv.totalAmount);
      s.visits6mo += 1;
    }
    // lastVisit across all-time (not just 6mo window) so "at risk" can see truly stale customers
    const lastVisitByCustomer = new Map<string, Date>();
    for (const inv of allInvoices) {
      const prev = lastVisitByCustomer.get(inv.customerId);
      if (!prev || inv.createdAt > prev) lastVisitByCustomer.set(inv.customerId, inv.createdAt);
    }
    for (const [id, s] of custStats) s.lastVisit = lastVisitByCustomer.get(id) ?? null;

    // ── RFM segmentation ──
    const segments = {
      vip: [] as string[], regular: [] as string[], occasional: [] as string[],
      atRisk: [] as string[], newCust: [] as string[],
    };
    for (const c of customers) {
      const s = custStats.get(c.id)!;
      const daysSinceVisit = s.lastVisit ? (now.getTime() - s.lastVisit.getTime()) / DAY_MS : null;
      if (c.createdAt >= daysAgo(30)) segments.newCust.push(c.id);
      else if (daysSinceVisit !== null && daysSinceVisit > 45) segments.atRisk.push(c.id);
      else if (s.spend6mo >= 20000) segments.vip.push(c.id);
      else if (s.visits6mo >= 4) segments.regular.push(c.id);
      else segments.occasional.push(c.id);
    }
    const customerSegments = [
      { label: "VIP / High-Value", count: segments.vip.length, desc: "Spent ₹20,000+ in the last 6 months.", color: "#111111", action: "Send exclusive offer" },
      { label: "Regular Visitors", count: segments.regular.length, desc: "4+ visits in the last 6 months. Core repeat business.", color: "#444444", action: "Loyalty reward" },
      { label: "Occasional Visitors", count: segments.occasional.length, desc: "Visited recently but infrequently. Growth opportunity.", color: "#6366F1", action: "Re-engage campaign" },
      { label: "At Risk / Churning", count: segments.atRisk.length, desc: "Haven't visited in 45+ days despite a booking history. Needs win-back.", color: "#EF4444", action: "Send comeback offer" },
      { label: "New Customers", count: segments.newCust.length, desc: "Signed up in the past 30 days. Critical onboarding window.", color: "#10B981", action: "Follow up for review" },
    ];

    // ── KPI overview ──
    const visited60 = new Set(allInvoices.filter(i => i.createdAt >= daysAgo(60)).map(i => i.customerId));
    const visitedBefore60 = new Set(allInvoices.filter(i => i.createdAt < daysAgo(60)).map(i => i.customerId));
    const returning = [...visited60].filter(id => visitedBefore60.has(id));
    const retentionRate = visited60.size > 0 ? Math.round((returning.length / visited60.size) * 100) : 0;

    const activeSpenders = [...custStats.values()].filter(s => s.visits6mo > 0);
    const avgClv = activeSpenders.length > 0
      ? Math.round(activeSpenders.reduce((sum, s) => sum + s.spend6mo, 0) / activeSpenders.length)
      : 0;

    const newThisMonth = customers.filter(c => inRange(c.createdAt, monthStart(now), monthEnd(now))).length;
    const newLastMonth = customers.filter(c => inRange(c.createdAt, monthStart(addMonths(now, -1)), monthEnd(addMonths(now, -1)))).length;

    const hourCounts = new Array(24).fill(0);
    for (const a of appointmentsAllTime) hourCounts[new Date(a.startTime).getHours()]++;
    let peakHour = 11, peakCount = -1;
    for (let h = 8; h <= 20; h++) {
      const windowCount = hourCounts[h] + (hourCounts[h + 1] ?? 0) + (hourCounts[h + 2] ?? 0);
      if (windowCount > peakCount) { peakCount = windowCount; peakHour = h; }
    }
    const fmtHour = (h: number) => h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
    const peakWindow = peakCount > 0 ? `${fmtHour(peakHour)}–${fmtHour(peakHour + 3)}` : "No data yet";

    // ── Revenue trend (this month vs last month, for insights) ──
    const revThisMonth = allInvoices.filter(i => inRange(i.createdAt, monthStart(now), monthEnd(now))).reduce((s, i) => s + Number(i.totalAmount), 0);
    const revLastMonth = allInvoices.filter(i => inRange(i.createdAt, monthStart(addMonths(now, -1)), monthEnd(addMonths(now, -1)))).reduce((s, i) => s + Number(i.totalAmount), 0);
    const revChangePct = revLastMonth > 0 ? Math.round(((revThisMonth - revLastMonth) / revLastMonth) * 100) : null;

    // ── Rule-based insights (only fire when there's real signal) ──
    const insights: { type: string; icon: string; title: string; desc: string }[] = [];
    const lowStock = products.filter(p => p.stockQuantity <= p.minStockLevel);
    if (lowStock.length > 0) {
      insights.push({
        type: "alert", icon: "⚠️",
        title: `${lowStock.length} Product${lowStock.length > 1 ? "s" : ""} Running Low on Stock`,
        desc: `${lowStock.slice(0, 3).map(p => p.name).join(", ")}${lowStock.length > 3 ? ` and ${lowStock.length - 3} more` : ""} — restock soon to avoid missed retail sales.`,
      });
    }
    const highValueAtRisk = segments.atRisk.filter(id => custStats.get(id)!.spend6mo > 0 || (lastVisitByCustomer.has(id)));
    if (highValueAtRisk.length > 0) {
      insights.push({
        type: "alert", icon: "⚠️",
        title: `${highValueAtRisk.length} Customer${highValueAtRisk.length > 1 ? "s" : ""} Haven't Visited in 45+ Days`,
        desc: "These customers have a booking history but have gone quiet. A personalised outreach or win-back offer could bring them back.",
      });
    }
    if (revChangePct !== null) {
      insights.push({
        type: revChangePct >= 0 ? "trend" : "opportunity", icon: revChangePct >= 0 ? "📈" : "💡",
        title: `Revenue is ${revChangePct >= 0 ? "Up" : "Down"} ${Math.abs(revChangePct)}% vs Last Month`,
        desc: `This month: ₹${revThisMonth.toLocaleString("en-IN")} vs ₹${revLastMonth.toLocaleString("en-IN")} last month.`,
      });
    }
    if (segments.vip.length > 0) {
      insights.push({
        type: "opportunity", icon: "💡",
        title: `${segments.vip.length} VIP Customer${segments.vip.length > 1 ? "s" : ""} Driving High-Value Revenue`,
        desc: "Consider an exclusive loyalty perk or early access offer to keep this segment engaged.",
      });
    }
    if (newThisMonth !== newLastMonth) {
      insights.push({
        type: newThisMonth >= newLastMonth ? "trend" : "opportunity", icon: newThisMonth >= newLastMonth ? "📈" : "💡",
        title: `New Customer Signups ${newThisMonth >= newLastMonth ? "Up" : "Down"} This Month`,
        desc: `${newThisMonth} new customers this month vs ${newLastMonth} last month.`,
      });
    }

    // ── Retention trend (last 6 calendar months) ──
    const invoicesByCustomer = new Map<string, Date[]>();
    for (const inv of allInvoices) {
      const list = invoicesByCustomer.get(inv.customerId) ?? [];
      list.push(inv.createdAt);
      invoicesByCustomer.set(inv.customerId, list);
    }
    const retentionData = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = monthStart(addMonths(now, -i));
      const mEnd = monthEnd(addMonths(now, -i));
      const isPastMonth = mEnd < now;

      let newCount = 0, retainedCount = 0, churnedCount = 0;
      for (const c of customers) {
        if (inRange(c.createdAt, mStart, mEnd)) newCount++;
      }
      for (const [, dates] of invoicesByCustomer) {
        const visitedThisMonth = dates.some(d => inRange(d, mStart, mEnd));
        if (!visitedThisMonth) continue;
        const hadEarlierVisit = dates.some(d => d < mStart);
        if (hadEarlierVisit) retainedCount++;
        if (isPastMonth) {
          const lastVisitOverall = dates.reduce((max, d) => d > max ? d : max, dates[0]);
          if (lastVisitOverall <= mEnd) churnedCount++;
        }
      }
      retentionData.push({
        month: mStart.toLocaleDateString("en-GB", { month: "short" }),
        new: newCount, retained: retainedCount, churned: churnedCount,
      });
    }

    // ── Stylist performance ──
    const repeatMap = new Map<string, Map<string, number>>();
    for (const a of appointmentsAllCompleted) {
      if (!repeatMap.has(a.staffId)) repeatMap.set(a.staffId, new Map());
      const custMap = repeatMap.get(a.staffId)!;
      custMap.set(a.customerId, (custMap.get(a.customerId) ?? 0) + 1);
    }
    const monthByStaff = new Map<string, { appts: number; revenue: number }>();
    for (const a of monthAppointments) {
      const cur = monthByStaff.get(a.staffId) ?? { appts: 0, revenue: 0 };
      cur.appts += 1;
      cur.revenue += a.services.reduce((s, si) => s + Number(si.price), 0);
      monthByStaff.set(a.staffId, cur);
    }
    const stylistPerformance = staff.map(st => {
      const custMap = repeatMap.get(st.id);
      const uniqueClients = custMap ? custMap.size : 0;
      const repeatClients = custMap ? [...custMap.values()].filter(n => n >= 2).length : 0;
      const repeatRate = uniqueClients > 0 ? Math.round((repeatClients / uniqueClients) * 100) : 0;
      const month = monthByStaff.get(st.id) ?? { appts: 0, revenue: 0 };
      return {
        name: st.name,
        appts: month.appts,
        revenue: month.revenue,
        avgRating: st.rating !== null ? Number(st.rating) : null,
        repeatRate,
        retention: repeatRate >= 80 ? "Excellent" : repeatRate >= 60 ? "Good" : "Average",
      };
    }).sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          retentionRate, avgClv, newThisMonth,
          newVsLastMonth: newThisMonth - newLastMonth,
          peakWindow,
        },
        insights,
        customerSegments,
        retentionData,
        stylistPerformance,
      },
    });
  } catch (e) {
    console.error("[ANALYTICS GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load analytics." }, { status: 500 });
  }
}
