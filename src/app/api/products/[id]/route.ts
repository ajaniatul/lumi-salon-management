import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// PATCH /api/products/[id] — update product fields OR adjust stock
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    // Stock adjustment action
    if (body.action === "adjust_stock") {
      const { qty, type, reason } = body;
      const product = await prisma.product.findUnique({ where: { id: params.id } });
      if (!product) return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });

      const before   = product.stockQuantity;
      const after    = Math.max(0, type === "IN" ? before + Number(qty) : before - Number(qty));
      const movType  = type === "IN" ? "STOCK_IN" : "STOCK_OUT";

      const [updated] = await prisma.$transaction([
        prisma.product.update({
          where: { id: params.id },
          data:  { stockQuantity: after },
        }),
        prisma.stockMovement.create({
          data: {
            productId: params.id,
            type:      movType,
            quantity:  type === "IN" ? Number(qty) : -Number(qty),
            beforeQty: before,
            afterQty:  after,
            reason:    reason || null,
            createdBy: session.userId,
          },
        }),
      ]);

      return NextResponse.json({ success: true, data: { stock: updated.stockQuantity } });
    }

    // General product update
    const { name, brand, barcode, category, price, costPrice, mrp, minStock, unit, mfgDate, expiry, isForSale, gst, hsn } = body;

    const updated = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...(name      && { name: name.trim() }),
        ...(brand     !== undefined && { brand: brand?.trim() || null }),
        ...(barcode   !== undefined && { barcode: barcode?.trim() || null }),
        ...(category  && { category }),
        ...(price     != null && { price: Number(price) }),
        ...(costPrice != null && { costPrice: Number(costPrice) }),
        ...(mrp       !== undefined && { mrp: mrp ? Number(mrp) : null }),
        ...(gst       != null && { gstRate: Number(gst) }),
        ...(hsn       !== undefined && { hsnCode: hsn || null }),
        ...(minStock  != null && { minStockLevel: Number(minStock) }),
        ...(unit      && { unit }),
        ...(mfgDate   !== undefined && { manufacturingDate: mfgDate ? new Date(mfgDate + "-01") : null }),
        ...(expiry    !== undefined && { expiryDate: expiry ? new Date(expiry + "-01") : null }),
        ...(isForSale !== undefined && { isForSale }),
      },
    });

    return NextResponse.json({ success: true, data: { id: updated.id } });
  } catch (e) {
    console.error("[PRODUCTS PATCH]", e);
    return NextResponse.json({ success: false, error: "Failed to update product." }, { status: 500 });
  }
}

// DELETE /api/products/[id] — delete product
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    try {
      // Try hard delete
      await prisma.product.delete({
        where: { id: params.id },
      });
      return NextResponse.json({ success: true, message: "Product deleted successfully from catalog." });
    } catch (dbError) {
      // Soft-deactivate if linked to existing transactions
      await prisma.product.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      return NextResponse.json({
        success: true,
        message: "Product has historic inventory or invoicing logs. It was deactivated instead of hard-deleted."
      });
    }
  } catch (e) {
    console.error("[PRODUCTS DELETE]", e);
    return NextResponse.json({ success: false, error: "Failed to delete product." }, { status: 500 });
  }
}
