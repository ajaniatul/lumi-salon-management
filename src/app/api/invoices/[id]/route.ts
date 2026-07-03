import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/invoices/[id]/payment — record a payment against an unpaid invoice
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { amount, methodLabel } = await request.json();
    const pay = Math.max(0, Number(amount) || 0);
    if (pay <= 0) return NextResponse.json({ success: false, error: "Amount must be positive." }, { status: 400 });

    const inv = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: { id: true, dueAmount: true, paidAmount: true, totalAmount: true },
    });
    if (!inv) return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });

    const actualPay = Math.min(pay, Number(inv.dueAmount));
    const newPaid   = Number(inv.paidAmount) + actualPay;
    const newDue    = Math.max(0, Number(inv.dueAmount) - actualPay);
    const newStatus = newDue === 0 ? "PAID" : "PARTIAL";

    const mapMethod = (label: string) => {
      const l = label.toLowerCase();
      if (l.includes("cash")) return "CASH";
      if (l.includes("upi"))  return "UPI";
      if (l.includes("card")) return "CARD";
      return "CASH";
    };

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          invoiceId: inv.id,
          method:    mapMethod(methodLabel ?? "Cash"),
          amount:    actualPay,
          notes:     methodLabel ?? "Cash",
        },
      }),
      prisma.invoice.update({
        where: { id: inv.id },
        data:  { paidAmount: newPaid, dueAmount: newDue, paymentStatus: newStatus as any },
      }),
    ]);

    return NextResponse.json({ success: true, paid: newPaid, due: newDue, status: newStatus });
  } catch (e) {
    console.error("[INVOICE PAYMENT POST]", e);
    return NextResponse.json({ success: false, error: "Failed to record payment" }, { status: 500 });
  }
}
