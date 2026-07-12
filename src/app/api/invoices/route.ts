import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ── Shape the DB invoice into what the UI expects ──────────────────────────
function toUI(inv: any) {
  let meta: Record<string, any> = {};
  try { meta = JSON.parse(inv.notes || "{}"); } catch {}

  const isInfluencer = meta.isInfluencer === true;
  const methodLabel  = meta.methodLabel ?? (inv.payments?.[0]?.method ?? "-");

  const status = isInfluencer
    ? "INFLUENCER"
    : (inv.paymentStatus as string); // PAID | PARTIAL | PENDING

  const services = inv.items
    .filter((it: any) => it.itemType === "SERVICE")
    .map((it: any) => ({ name: it.name, sac: "999721" }));
  const products = inv.items
    .filter((it: any) => it.itemType !== "SERVICE")
    .map((it: any) => ({ name: it.name, hsn: it.product?.hsnCode ?? "3305" }));
  const items = inv.items.map((it: any) => ({
    name:   it.name,
    type:   it.itemType === "SERVICE" ? "Service" : "Product",
    code:   it.itemType === "SERVICE" ? "999721" : (it.product?.hsnCode ?? "3305"),
    amount: Number(it.total),
  }));

  return {
    id:             inv.invoiceNumber,
    dbId:           inv.id,               // UUID for payment recording
    date:           new Date(inv.createdAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }),
    customer:       inv.customer?.name ?? "",
    phone:          inv.customer?.phone  ?? "",
    services,
    products,
    items,
    subtotal:       Number(inv.taxableAmount),
    cgst:           Number(inv.cgst),
    sgst:           Number(inv.sgst),
    total:          Number(inv.totalAmount),
    paid:           Number(inv.paidAmount),
    due:            Number(inv.dueAmount),
    method:         methodLabel,
    status,
    loyalty:        { earned: inv.loyaltyEarned, redeemed: inv.loyaltyUsed },
    discount:       meta.discountNote ?? "",
    influencerNote: isInfluencer ? (meta.collabNote ?? "") : "",
    discountAmt:    Number(inv.discountAmount),
    description:    meta.description ?? "",
    stylist:        inv.appointment?.staff?.name ?? null,
    stylistRole:    inv.appointment?.staff?.role ?? null,
  };
}

// GET /api/invoices — list all invoices, newest first
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer:    { select: { name: true, phone: true } },
        items:       { include: { product: { select: { hsnCode: true } } } },
        payments:    { select: { method: true, amount: true } },
        appointment: { include: { staff: { select: { name: true, role: true } } } },
      },
    });
    return NextResponse.json({ success: true, data: invoices.map(toUI) });
  } catch (e) {
    console.error("[INVOICES GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load invoices" }, { status: 500 });
  }
}

// POST /api/invoices — create a new invoice
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      customerId,       // "CUS-0001" string
      appointmentId,    // optional — links this invoice back to the appointment it was billed from
      items,            // [{ type, dbId, name, unitPrice, qty, gstRate }]
      discountAmt = 0,
      discountNote = "",
      gstRate = 18,
      cgst,
      sgst,
      total,
      rawSubtotal,      // pre-discount subtotal
      paidAmt,
      methodLabel = "-",
      description = "",
      collabNote  = "",
      isInfluencer = false,
    } = body ?? {};

    if (!customerId || !items?.length) {
      return NextResponse.json({ success: false, error: "Customer and at least one item are required." }, { status: 400 });
    }

    // Resolve customer
    const customer = await prisma.customer.findUnique({
      where: { customerId },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ success: false, error: "Customer not found." }, { status: 404 });
    }

    // Invoice number
    const count = await prisma.invoice.count();
    const year  = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, "0")}`;

    const taxableAmt = (rawSubtotal ?? total) - discountAmt;
    const paidFinal  = isInfluencer ? 0 : (paidAmt != null ? Math.min(Number(paidAmt), total) : total);
    const dueFinal   = Math.max(0, total - paidFinal);
    const payStatus  = isInfluencer ? "PENDING"
                     : paidFinal >= total ? "PAID"
                     : paidFinal > 0     ? "PARTIAL"
                     :                     "PENDING";
    const loyalty    = isInfluencer ? 0 : Math.floor(total / 100);

    // Pack extra metadata into notes as JSON
    const notesJson = JSON.stringify({
      description,
      discountNote,
      collabNote,
      isInfluencer,
      methodLabel,
    });

    const created = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId:    customer.id,
        appointmentId: appointmentId || null,
        subtotal:      rawSubtotal ?? total,
        discountAmount: discountAmt,
        taxableAmount: taxableAmt,
        cgst,
        sgst,
        totalGst:      cgst + sgst,
        totalAmount:   total,
        paidAmount:    paidFinal,
        dueAmount:     dueFinal,
        paymentStatus: payStatus as any,
        loyaltyEarned: loyalty,
        notes:         notesJson,
        items: {
          create: items.map((it: any) => ({
            itemType:  it.type === "Service" ? "SERVICE" : "PRODUCT",
            serviceId: it.type === "Service" ? it.dbId : null,
            productId: it.type === "Product" ? it.dbId : null,
            name:      it.name,
            quantity:  it.qty ?? 1,
            unitPrice: it.unitPrice,
            discount:  0,
            gstRate:   it.gstRate ?? gstRate,
            gstAmount: Math.round(it.unitPrice * (it.qty ?? 1) * (it.gstRate ?? gstRate) / 100 * 100) / 100,
            total:     it.unitPrice * (it.qty ?? 1),
          })),
        },
        ...(!isInfluencer && paidFinal > 0 ? {
          payments: {
            create: [{
              method: mapMethod(methodLabel),
              amount: paidFinal,
              notes:  methodLabel,
            }],
          },
        } : {}),
      },
      include: {
        customer: { select: { name: true, phone: true } },
        items:    { include: { product: { select: { hsnCode: true } } } },
        payments: { select: { method: true, amount: true } },
      },
    });

    // Update customer totals
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        totalVisits:  { increment: 1 },
        totalSpend:   { increment: total },
        loyaltyPoints: { increment: loyalty },
      },
    });

    return NextResponse.json({ success: true, data: toUI(created) }, { status: 201 });
  } catch (e: any) {
    console.error("[INVOICES POST]", e);
    return NextResponse.json({ success: false, error: e?.message ?? "Failed to create invoice" }, { status: 500 });
  }
}

function mapMethod(label: string) {
  const l = label.toLowerCase();
  if (l.includes("cash"))  return "CASH";
  if (l.includes("upi"))   return "UPI";
  if (l.includes("card"))  return "CARD";
  return "CASH";
}
