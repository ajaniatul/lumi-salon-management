import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { name, category, vendor, amount, gst, paidBy, notes } = await req.json();

    const updated = await prisma.expense.update({
      where: { id: params.id },
      data: {
        ...(name     && { description: name.trim() }),
        ...(category && { category }),
        ...(amount   != null && { amount: Number(amount) }),
        ...(gst      !== undefined && { gstAmount: gst ? Number(gst) : null }),
        ...(vendor   !== undefined && { vendor: vendor?.trim() || null }),
        ...(paidBy   && { paymentMethod: paidBy }),
        ...(notes    !== undefined && { notes: notes?.trim() || null }),
      },
    });

    return NextResponse.json({ success: true, data: { id: updated.id } });
  } catch (e) {
    console.error("[EXPENSES PATCH]", e);
    return NextResponse.json({ success: false, error: "Failed to update expense." }, { status: 500 });
  }
}
