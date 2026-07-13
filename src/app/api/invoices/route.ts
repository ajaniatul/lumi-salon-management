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
    dbId:           inv.id,
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
    discount:       meta.discountNote ?? "",
    influencerNote: isInfluencer ? (meta.collabNote ?? "") : "",
    discountAmt:    Number(inv.discountAmount),
    description:    meta.description ?? "",
    stylist:        inv.appointment?.staff?.name ?? null,
    stylistRole:    inv.appointment?.staff?.designation ?? null,
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
        appointment: { include: { staff: { select: { name: true, designation: true } } } },
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

  let step = "parse";
  try {
    step = "parse";
    const body = await request.json();
    const {
      customerId,
      appointmentId,
      items,
      discountAmt = 0,
      discountNote = "",
      gstRate = 18,
      cgst,
      sgst,
      total,
      rawSubtotal,
      paidAmt,
      methodLabel = "-",
      description = "",
      collabNote  = "",
      isInfluencer = false,
    } = body ?? {};

    if (!customerId || !items?.length) {
      return NextResponse.json({ success: false, error: "Customer and at least one item are required." }, { status: 400 });
    }

    step = "find-customer";
    const customer = await prisma.customer.findUnique({
      where: { customerId },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ success: false, error: "Customer not found." }, { status: 404 });
    }

    // Idempotency: if an invoice already exists for this appointment, return it
    step = "idempotency";
    if (appointmentId) {
      const existing = await prisma.invoice.findUnique({
        where: { appointmentId },
        include: {
          customer:    { select: { name: true, phone: true } },
          items:       { include: { product: { select: { hsnCode: true } } } },
          payments:    { select: { method: true, amount: true } },
          appointment: { include: { staff: { select: { name: true, designation: true } } } },
        },
      });
      if (existing) {
        return NextResponse.json({ success: true, data: toUI(existing) }, { status: 200 });
      }
    }

    step = "compute";
    const year   = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const lastInv = await prisma.invoice.findFirst({
      where:   { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: "desc" },
      select:  { invoiceNumber: true },
    });
    const lastNum     = lastInv ? parseInt(lastInv.invoiceNumber.replace(prefix, ""), 10) : 0;
    const invoiceNumber = `${prefix}${String(lastNum + 1).padStart(4, "0")}`;

    const taxableAmt = (rawSubtotal ?? total) - discountAmt;
    const paidFinal  = isInfluencer ? 0 : (paidAmt != null ? Math.min(Number(paidAmt), total) : total);
    const dueFinal   = Math.max(0, total - paidFinal);
    const payStatus  = isInfluencer ? "PENDING"
                     : paidFinal >= total ? "PAID"
                     : paidFinal > 0     ? "PARTIAL"
                     :                     "PENDING";
    const notesJson = JSON.stringify({
      description,
      discountNote,
      collabNote,
      isInfluencer,
      methodLabel,
    });

    step = "create-invoice";
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
        customer:    { select: { name: true, phone: true } },
        items:       { include: { product: { select: { hsnCode: true } } } },
        payments:    { select: { method: true, amount: true } },
        appointment: { include: { staff: { select: { name: true, designation: true } } } },
      },
    });

    // Update customer totals — non-fatal
    step = "update-customer";
    try {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          totalVisits:   { increment: 1 },
          totalSpend:    { increment: total },
        },
      });
    } catch (updateErr: any) {
      console.error("[INVOICES POST] customer update failed (non-fatal):", updateErr?.message);
    }

    return NextResponse.json({ success: true, data: toUI(created) }, { status: 201 });
  } catch (e: any) {
    console.error("[INVOICES POST] failed at step:", step, "| code:", e?.code, "| msg:", e?.message, e);
    if (e?.code === "P2002") {
      const field = e?.meta?.target?.[0] ?? "field";
      return NextResponse.json({ success: false, error: `Duplicate invoice: ${field} already billed` }, { status: 409 });
    }
    if (e?.code === "P2003") {
      return NextResponse.json({ success: false, error: `Data error at ${step}: ${e?.meta?.field_name ?? e.message}` }, { status: 422 });
    }
    return NextResponse.json({ success: false, error: `Error at [${step}]: ${e?.message ?? "unknown"}` }, { status: 500 });
  }
}

function mapMethod(label: string) {
  const l = label.toLowerCase();
  if (l.includes("cash"))  return "CASH";
  if (l.includes("upi"))   return "UPI";
  if (l.includes("card"))  return "CARD";
  return "CASH";
}
