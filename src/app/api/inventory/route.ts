import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/inventory — stock movement history (last 100)
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const movements = await prisma.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { product: { select: { name: true, sku: true, unit: true } } },
    });

    return NextResponse.json({
      success: true,
      data: movements.map(m => ({
        id:       m.id,
        date:     m.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        product:  m.product.name,
        sku:      m.product.sku,
        unit:     m.product.unit,
        type:     m.type.startsWith("STOCK_IN") || m.type === "PURCHASE_RETURN" || m.type === "SALE_RETURN" ? "IN" : "OUT",
        movType:  m.type,
        qty:      Math.abs(m.quantity),
        before:   m.beforeQty,
        after:    m.afterQty,
        reason:   m.reason ?? m.reference ?? "—",
      })),
    });
  } catch (e) {
    console.error("[INVENTORY GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load movements." }, { status: 500 });
  }
}
