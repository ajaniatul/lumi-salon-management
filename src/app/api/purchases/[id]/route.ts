import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// PATCH /api/purchases/[id] — record payment
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { amount } = await req.json();
    const purchase = await prisma.purchase.findUnique({ where: { id: params.id } });
    if (!purchase) return NextResponse.json({ success: false, error: "Purchase not found." }, { status: 404 });

    const newPaid = Math.min(
      Number(purchase.totalAmount),
      Number(purchase.paidAmount) + Number(amount)
    );

    const updated = await prisma.purchase.update({
      where: { id: params.id },
      data:  { paidAmount: newPaid },
    });

    return NextResponse.json({ success: true, data: { paidAmount: Number(updated.paidAmount) } });
  } catch (e) {
    console.error("[PURCHASES PATCH]", e);
    return NextResponse.json({ success: false, error: "Failed to record payment." }, { status: 500 });
  }
}
