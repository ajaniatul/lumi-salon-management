import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const CAT_LABEL: Record<string, string> = {
  HAIR_CARE: "Hair Care", SKIN_CARE: "Skin Care", NAIL_CARE: "Nail Care",
  MAKEUP: "Makeup", TOOLS: "Tools", ACCESSORIES: "Accessories", CONSUMABLES: "Consumables",
};

// GET /api/products — slim (billing picker) or full (?full=true for management page)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const full = new URL(req.url).searchParams.get("full") === "true";

  try {
    const products = await prisma.product.findMany({
      where: full ? { isActive: true } : { isActive: true, isForSale: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: products.map(p => ({
        id:            p.id,
        sku:           p.sku,
        name:          p.name,
        brand:         p.brand ?? "",
        category:      p.category,
        categoryLabel: CAT_LABEL[p.category] ?? p.category,
        price:         Number(p.price),
        costPrice:     Number(p.costPrice),
        mrp:           p.mrp ? Number(p.mrp) : null,
        gst:           Number(p.gstRate),
        hsn:           p.hsnCode ?? "3305",
        stock:         p.stockQuantity,
        minStock:      p.minStockLevel,
        unit:          p.unit,
        mfgDate:       p.manufacturingDate ? p.manufacturingDate.toISOString().slice(0, 7) : null,
        expiry:        p.expiryDate ? p.expiryDate.toISOString().slice(0, 7) : null,
        isForSale:     p.isForSale,
        isForUse:      p.isForUse,
        isActive:      p.isActive,
      })),
    });
  } catch (e) {
    console.error("[PRODUCTS GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load products" }, { status: 500 });
  }
}

// POST /api/products — create product
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, brand, category, price, costPrice, mrp, stock, minStock, unit, mfgDate, expiry, isForSale, gst, hsn } = body;

    if (!name?.trim() || !category || price == null) {
      return NextResponse.json({ success: false, error: "Name, category and price are required." }, { status: 400 });
    }

    const count = await prisma.product.count();
    const sku   = `PRD-${String(count + 1).padStart(4, "0")}`;

    const product = await prisma.product.create({
      data: {
        sku,
        name:          name.trim(),
        brand:         brand?.trim() || null,
        category,
        price:         Number(price),
        costPrice:     Number(costPrice) || 0,
        mrp:           mrp ? Number(mrp) : null,
        gstRate:       Number(gst) || 18,
        hsnCode:       hsn || "3305",
        stockQuantity: Number(stock) || 0,
        minStockLevel: Number(minStock) || 5,
        unit:          unit || "piece",
        manufacturingDate: mfgDate ? new Date(mfgDate + "-01") : null,
        expiryDate:    expiry ? new Date(expiry + "-01") : null,
        isForSale:     isForSale !== false,
        isForUse:      true,
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: product.id, sku: product.sku, name: product.name },
    });
  } catch (e: any) {
    console.error("[PRODUCTS POST]", e);
    if (e.code === "P2002") return NextResponse.json({ success: false, error: "SKU already exists." }, { status: 409 });
    return NextResponse.json({ success: false, error: "Failed to create product." }, { status: 500 });
  }
}
