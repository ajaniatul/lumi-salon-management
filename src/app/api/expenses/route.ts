import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const expenses = await prisma.expense.findMany({
      orderBy: { date: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: expenses.map(e => ({
        id:       e.id,
        date:     e.date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        category: e.category,
        name:     e.description,
        vendor:   e.vendor ?? "—",
        amount:   Number(e.amount),
        gst:      e.gstAmount ? Number(e.gstAmount) : 0,
        total:    Number(e.amount) + (e.gstAmount ? Number(e.gstAmount) : 0),
        paidBy:   e.paymentMethod ?? "Cash",
        notes:    e.notes ?? "",
      })),
    });
  } catch (e) {
    console.error("[EXPENSES GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load expenses." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { name, category, vendor, amount, gst, paidBy, notes, date } = await req.json();

    if (!name?.trim() || !category || !amount) {
      return NextResponse.json({ success: false, error: "Name, category and amount are required." }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        description:   name.trim(),
        category,
        amount:        Number(amount),
        gstAmount:     gst ? Number(gst) : null,
        date:          date ? new Date(date) : new Date(),
        vendor:        vendor?.trim() || null,
        paymentMethod: paidBy || "Cash",
        notes:         notes?.trim() || null,
        createdBy:     session.userId,
      },
    });

    return NextResponse.json({ success: true, data: { id: expense.id } });
  } catch (e) {
    console.error("[EXPENSES POST]", e);
    return NextResponse.json({ success: false, error: "Failed to create expense." }, { status: 500 });
  }
}
