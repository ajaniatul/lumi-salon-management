import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const fmtDateLong = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

// Customer.loyaltyPoints can include an "opening balance" earned before the
// LoyaltyTransaction ledger existed (e.g. seed data). Reconciling that gap as
// an implicit opening entry keeps the ledger's running balance honest without
// a schema change or backfill.
function withRunningBalance(currentPoints: number, txns: { points: number }[]) {
  const openingBalance = currentPoints - txns.reduce((s, t) => s + t.points, 0);
  let running = openingBalance;
  return txns.map(t => {
    running += t.points;
    return running;
  });
}

// GET /api/loyalty — customers with loyalty activity, plus recent transaction ledger
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const customers = await prisma.customer.findMany({
      where: { OR: [{ loyaltyPoints: { gt: 0 } }, { loyaltyTransactions: { some: {} } }] },
      orderBy: { loyaltyPoints: "desc" },
      include: {
        membership: { include: { membership: { select: { tier: true } } } },
        loyaltyTransactions: { orderBy: { createdAt: "asc" } },
      },
    });

    const allTxnRows: { date: Date; customer: string; type: "EARN" | "REDEEM"; pts: number; reason: string; balance: number }[] = [];

    const customerRows = customers.map(c => {
      const txns = c.loyaltyTransactions;
      const balances = withRunningBalance(c.loyaltyPoints, txns);
      const earned = txns.filter(t => t.points > 0).reduce((s, t) => s + t.points, 0);
      const redeemed = txns.filter(t => t.points < 0).reduce((s, t) => s + Math.abs(t.points), 0);

      txns.forEach((t, i) => {
        allTxnRows.push({
          date: t.createdAt,
          customer: c.name,
          type: t.points > 0 ? "EARN" : "REDEEM",
          pts: Math.abs(t.points),
          reason: t.description ?? "Manual adjustment",
          balance: balances[i],
        });
      });

      const last = txns[txns.length - 1];
      const upcomingExpiry = txns
        .filter(t => t.expiresAt && t.expiresAt.getTime() > Date.now())
        .sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime())[0]?.expiresAt;

      return {
        id: c.customerId,
        name: c.name,
        phone: c.phone,
        tier: c.membership?.membership?.tier ?? null,
        points: c.loyaltyPoints,
        earned,
        redeemed,
        expiry: upcomingExpiry ? fmtDateLong(upcomingExpiry) : "—",
        lastTxn: last ? `${fmtDate(last.createdAt)} — ${last.points > 0 ? "Earned" : "Redeemed"} ${Math.abs(last.points)} pts (${last.description ?? "Manual adjustment"})` : "No activity yet",
      };
    });

    const transactions = allTxnRows
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 100)
      .map(t => ({ ...t, date: fmtDate(t.date) }));

    return NextResponse.json({ success: true, data: { customers: customerRows, transactions } });
  } catch (e) {
    console.error("[LOYALTY GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load loyalty data." }, { status: 500 });
  }
}

// POST /api/loyalty — adjust a customer's points (earn or redeem), logged to the ledger
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { customerId, type, points, reason } = await req.json();

    if (!customerId || !["EARN", "REDEEM"].includes(type) || !points || Number(points) <= 0) {
      return NextResponse.json({ success: false, error: "customerId, type and a positive points value are required." }, { status: 400 });
    }
    const pts = Math.round(Number(points));

    const customer = await prisma.customer.findFirst({ where: { customerId } });
    if (!customer) return NextResponse.json({ success: false, error: "Customer not found." }, { status: 404 });

    if (type === "REDEEM" && pts > customer.loyaltyPoints) {
      return NextResponse.json({ success: false, error: `Customer only has ${customer.loyaltyPoints} points.` }, { status: 400 });
    }

    const delta = type === "EARN" ? pts : -pts;
    const [, updated] = await prisma.$transaction([
      prisma.loyaltyTransaction.create({
        data: {
          customerId: customer.id,
          points: delta,
          type,
          description: reason?.trim() || "Manual adjustment",
        },
      }),
      prisma.customer.update({
        where: { id: customer.id },
        data: { loyaltyPoints: { increment: delta } },
      }),
    ]);

    return NextResponse.json({ success: true, data: { points: updated.loyaltyPoints } });
  } catch (e) {
    console.error("[LOYALTY POST]", e);
    return NextResponse.json({ success: false, error: "Failed to adjust points." }, { status: 500 });
  }
}
