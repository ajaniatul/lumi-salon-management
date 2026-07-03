import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

function deriveStatus(total: number, paid: number) {
  if (paid <= 0)          return "PENDING";
  if (paid >= total - 0.5) return "PAID";
  return "PARTIAL";
}

// GET /api/purchases
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const purchases = await prisma.purchase.findMany({
      orderBy: { date: "desc" },
      include: {
        supplier: { select: { name: true } },
        items:    true,
      },
    });

    return NextResponse.json({
      success: true,
      data: purchases.map(p => {
        const total = Number(p.totalAmount);
        const paid  = Number(p.paidAmount);
        return {
          id:             p.id,
          purchaseNumber: p.purchaseNumber,
          supplier:       p.supplier?.name ?? p.supplierName ?? "Unknown Supplier",
          invoice:        p.supplierInvoice ?? "—",
          date:           p.date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          subtotal:       Number(p.subtotal),
          gst:            Number(p.gstAmount),
          total,
          paid,
          due:            Math.max(0, total - paid),
          status:         deriveStatus(total, paid),
          notes:          p.notes ?? "",
          items:          p.items.map(it => ({
            id:    it.id,
            name:  it.description ?? "—",
            qty:   it.quantity,
            cost:  Number(it.costPrice),
            gst:   Number(it.gstRate),
            total: Number(it.total),
          })),
        };
      }),
    });
  } catch (e) {
    console.error("[PURCHASES GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load purchases." }, { status: 500 });
  }
}

// POST /api/purchases — create new purchase
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { supplier, invoice, notes, items } = body;

    if (!supplier?.trim()) {
      return NextResponse.json({ success: false, error: "Supplier name is required." }, { status: 400 });
    }
    const validItems = (items as any[]).filter(it => it.name?.trim() && Number(it.qty) > 0);
    if (validItems.length === 0) {
      return NextResponse.json({ success: false, error: "At least one item is required." }, { status: 400 });
    }

    const count          = await prisma.purchase.count();
    const purchaseNumber = `PUR-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

    const mappedItems = validItems.map(it => {
      const qty      = Number(it.qty) || 1;
      const cost     = Number(it.cost) || 0;
      const gstRate  = Number(it.gst) || 18;
      const baseAmt  = qty * cost;
      const gstAmt   = Math.round(baseAmt * gstRate / 100 * 100) / 100;
      const total    = Math.round((baseAmt + gstAmt) * 100) / 100;
      return { description: it.name.trim(), quantity: qty, costPrice: cost, gstRate, gstAmount: gstAmt, total };
    });

    const subtotal  = mappedItems.reduce((s, it) => s + it.quantity * it.costPrice, 0);
    const gstAmount = mappedItems.reduce((s, it) => s + it.gstAmount, 0);
    const total     = mappedItems.reduce((s, it) => s + it.total, 0);

    const purchase = await prisma.purchase.create({
      data: {
        purchaseNumber,
        supplierName:    supplier.trim(),
        supplierInvoice: invoice?.trim() || null,
        date:            new Date(),
        subtotal,
        gstAmount,
        totalAmount:     total,
        paidAmount:      0,
        notes:           notes?.trim() || null,
        items: { create: mappedItems },
      },
      include: { items: true },
    });

    return NextResponse.json({
      success: true,
      data: { id: purchase.id, purchaseNumber: purchase.purchaseNumber },
    });
  } catch (e) {
    console.error("[PURCHASES POST]", e);
    return NextResponse.json({ success: false, error: "Failed to create purchase." }, { status: 500 });
  }
}
