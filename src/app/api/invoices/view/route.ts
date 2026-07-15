import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Public endpoint — no auth required.
// GET /api/invoices/view?num=INV-2026-0049
export async function GET(request: NextRequest) {
  const num = request.nextUrl.searchParams.get("num");
  if (!num) return NextResponse.json({ success: false, error: "Missing invoice number" }, { status: 400 });

  try {
    const inv = await prisma.invoice.findFirst({
      where: { invoiceNumber: num },
      include: {
        customer:    { select: { name: true, phone: true } },
        items:       { include: { product: { select: { hsnCode: true } } } },
        payments:    { select: { method: true, amount: true } },
        appointment: { include: { staff: { select: { name: true, designation: true } } } },
      },
    });
    if (!inv) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });

    let meta: Record<string, any> = {};
    try { meta = JSON.parse(inv.notes || "{}"); } catch {}

    const isInfluencer = meta.isInfluencer === true;
    const methodLabel  = meta.methodLabel ?? (inv.payments?.[0]?.method ?? "-");
    const status = isInfluencer ? "INFLUENCER" : (inv.paymentStatus as string);

    const services = inv.items.filter((it: any) => it.itemType === "SERVICE").map((it: any) => ({ name: it.name, sac: "999721" }));
    const products = inv.items.filter((it: any) => it.itemType !== "SERVICE").map((it: any) => ({ name: it.name, hsn: it.product?.hsnCode ?? "3305" }));
    const items    = inv.items.map((it: any) => ({
      name: it.name, type: it.itemType === "SERVICE" ? "Service" : "Product",
      code: it.itemType === "SERVICE" ? "999721" : (it.product?.hsnCode ?? "3305"),
      amount: Number(it.total),
    }));

    const settings = await prisma.salonSettings.findFirst();

    return NextResponse.json({
      success: true,
      data: {
        invoiceNo:    inv.invoiceNumber,
        date:         new Date(inv.createdAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }),
        customer:     inv.customer?.name ?? "",
        phone:        inv.customer?.phone ?? "",
        stylist:      inv.appointment?.staff?.name ?? null,
        stylistRole:  inv.appointment?.staff?.designation ?? null,
        items:        items.map((it: any) => ({ description: it.name, type: it.type, hsnCode: it.code, amount: it.amount })),
        subtotal:     Number(inv.taxableAmount),
        discountAmt:  Number(inv.discountAmount) || undefined,
        discountNote: meta.discountNote || undefined,
        cgst:         Number(inv.cgst),
        sgst:         Number(inv.sgst),
        halfGst:      Number(inv.taxableAmount) > 0 ? Math.round(Number(inv.cgst) / Number(inv.taxableAmount) * 100) : 9,
        total:        Number(inv.totalAmount),
        payMethod:    methodLabel === "-" ? "Pending" : methodLabel,
        status,
        brandName:    settings?.salonName ?? undefined,
        brandTagline: settings?.tagline ?? undefined,
        brandAddress: settings?.address ?? undefined,
        brandGstin:   settings?.gstin ?? undefined,
        brandPhone:   settings?.phone ?? undefined,
        brandEmail:   settings?.email ?? undefined,
        brandLogo:    settings?.logo ?? undefined,
      },
    });
  } catch (e) {
    console.error("[INVOICE VIEW]", e);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
