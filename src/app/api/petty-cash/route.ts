import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function nextVoucherNo(): Promise<string> {
  const last = await prisma.pettyCashEntry.findFirst({ orderBy: { createdAt: "desc" } });
  if (!last) return "PCV-001";
  const n = parseInt(last.voucherNo.replace("PCV-", ""), 10) || 0;
  return `PCV-${String(n + 1).padStart(3, "0")}`;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const [entries, settings] = await Promise.all([
      prisma.pettyCashEntry.findMany({ orderBy: { date: "asc" } }),
      prisma.salonSettings.findFirst({ select: { pettyCashOpeningBalance: true } }),
    ]);

    return NextResponse.json({
      success: true,
      openingBalance: settings ? Number(settings.pettyCashOpeningBalance) : 0,
      data: entries.map(e => ({
        id:          e.id,
        date:        e.date.toISOString().slice(0, 10),
        voucherNo:   e.voucherNo,
        description: e.description,
        category:    e.category,
        type:        e.type as "RECEIPT" | "PAYMENT",
        amount:      Number(e.amount),
      })),
    });
  } catch (err) {
    console.error("[PETTY-CASH GET]", err);
    return NextResponse.json({ success: false, error: "Failed to load entries." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    // Opening balance update
    if (body.action === "set_opening_balance") {
      const val = Number(body.amount);
      if (isNaN(val) || val < 0) return NextResponse.json({ success: false, error: "Invalid amount." }, { status: 400 });
      const existing = await prisma.salonSettings.findFirst();
      if (existing) {
        await prisma.salonSettings.update({ where: { id: existing.id }, data: { pettyCashOpeningBalance: val } });
      } else {
        await prisma.salonSettings.create({ data: { pettyCashOpeningBalance: val } });
      }
      return NextResponse.json({ success: true });
    }

    // New entry
    const { date, description, category, type, amount } = body;
    if (!description?.trim() || !type || !amount) {
      return NextResponse.json({ success: false, error: "Description, type and amount are required." }, { status: 400 });
    }
    const voucherNo = await nextVoucherNo();
    const entry = await prisma.pettyCashEntry.create({
      data: {
        date:        date ? new Date(date) : new Date(),
        voucherNo,
        description: description.trim(),
        category:    category || "Miscellaneous",
        type,
        amount:      Number(amount),
      },
    });
    return NextResponse.json({ success: true, data: { id: entry.id, voucherNo: entry.voucherNo } });
  } catch (err) {
    console.error("[PETTY-CASH POST]", err);
    return NextResponse.json({ success: false, error: "Failed to create entry." }, { status: 500 });
  }
}
