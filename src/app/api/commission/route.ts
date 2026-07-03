import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/commission?month=6&year=2026
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now   = new Date();
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));
  const year  = parseInt(searchParams.get("year")  ?? String(now.getFullYear()));

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59);

  try {
    const staff = await prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { employeeId: "asc" },
      include: {
        commissionSettings: { where: { isActive: true }, take: 1 },
        commissions: {
          where: { month, year },
          take: 1,
        },
        appointments: {
          where: { startTime: { gte: monthStart, lte: monthEnd }, status: "COMPLETED" },
          include: { services: { select: { price: true, service: { select: { name: true } } } } },
        },
      },
    });

    const data = staff.map(s => {
      const rate          = s.commissionSettings[0] ? Number(s.commissionSettings[0].rate) : 0;
      const existing      = s.commissions[0];
      const svcRevenue    = s.appointments.reduce((sum, a) =>
        sum + a.services.reduce((s2, si) => s2 + Number(si.price), 0), 0);
      const commAmt       = existing ? Number(existing.commissionAmount) : Math.round(svcRevenue * rate / 100);
      const bonusAmt      = existing ? Number(existing.bonusAmount) : 0;
      const totalAmt      = existing ? Number(existing.totalAmount) : commAmt + bonusAmt;

      // Top service by revenue
      const svcMap: Record<string, number> = {};
      for (const a of s.appointments) {
        for (const si of a.services) {
          const name = si.service?.name ?? "Unknown";
          svcMap[name] = (svcMap[name] || 0) + Number(si.price);
        }
      }
      const topService = Object.entries(svcMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      return {
        id:              s.employeeId,
        dbId:            s.id,
        name:            s.name,
        designation:     s.designation,
        salary:          Number(s.salary),
        commissionRate:  rate,
        svcRevenue,
        commissionAmt:   commAmt,
        bonusAmt,
        totalVariable:   totalAmt,
        grossPay:        Number(s.salary) + totalAmt,
        isPaid:          existing?.isPaid ?? false,
        commissionDbId:  existing?.id ?? null,
        appointments:    s.appointments.length,
        topService,
      };
    });

    const totalCommission = data.reduce((s, c) => s + c.totalVariable, 0);
    const totalGross      = data.reduce((s, c) => s + c.grossPay, 0);
    const totalPending    = data.filter(c => !c.isPaid).reduce((s, c) => s + c.grossPay, 0);
    const topEarner       = [...data].sort((a, b) => b.totalVariable - a.totalVariable)[0];

    return NextResponse.json({
      success: true, month, year, data,
      summary: { totalCommission, totalGross, totalPending, topEarner: topEarner?.name ?? null, topEarnerAmt: topEarner?.totalVariable ?? 0 },
    });
  } catch (e) {
    console.error("[COMMISSION GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load commissions." }, { status: 500 });
  }
}

// POST /api/commission — mark payout complete (upsert Commission record)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  try {
    const { staffDbId, month, year, svcRevenue, commissionAmt, bonusAmt, totalAmt } = await req.json();

    const record = await prisma.commission.upsert({
      where:  { staffId_month_year: { staffId: staffDbId, month, year } },
      create: { staffId: staffDbId, month, year, serviceRevenue: svcRevenue, productRevenue: 0, commissionAmount: commissionAmt, bonusAmount: bonusAmt, totalAmount: totalAmt, isPaid: true },
      update: { isPaid: true },
    });

    return NextResponse.json({ success: true, data: { id: record.id, isPaid: record.isPaid } });
  } catch (e) {
    console.error("[COMMISSION POST]", e);
    return NextResponse.json({ success: false, error: "Failed to update commission." }, { status: 500 });
  }
}
