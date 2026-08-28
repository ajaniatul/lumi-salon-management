import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function methodLabel(m: string) {
  switch (m) {
    case "CASH": return "Cash";
    case "UPI":  return "UPI";
    case "CARD": return "Card";
    case "SPLIT": return "Split";
    default:     return m;
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ success: false, error: "date required" }, { status: 400 });

  const [y, m, d] = date.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0);
  const end   = new Date(y, m - 1, d, 23, 59, 59, 999);

  const invoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: {
      customer: { select: { name: true, phone: true } },
      items:    true,
      payments: { select: { method: true, amount: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows = invoices.map(inv => ({
    invoiceNo:    inv.invoiceNumber,
    customer:     inv.customer?.name ?? "—",
    phone:        inv.customer?.phone ?? "",
    items:        inv.items.map(i => i.name).join(", "),
    subtotalExTax: Number(inv.taxableAmount),
    cgst:         Number(inv.cgst),
    sgst:         Number(inv.sgst),
    totalIncTax:  Number(inv.totalAmount),
    paid:         Number(inv.paidAmount),
    due:          Number(inv.dueAmount),
    status:       inv.paymentStatus,
    method:       inv.payments.map(p => methodLabel(p.method)).join(" + ") || "—",
  }));

  const totals = rows.reduce((acc, r) => ({
    subtotalExTax: acc.subtotalExTax + r.subtotalExTax,
    cgst:  acc.cgst  + r.cgst,
    sgst:  acc.sgst  + r.sgst,
    totalIncTax: acc.totalIncTax + r.totalIncTax,
    paid:  acc.paid  + r.paid,
    due:   acc.due   + r.due,
  }), { subtotalExTax:0, cgst:0, sgst:0, totalIncTax:0, paid:0, due:0 });

  return NextResponse.json({ success: true, data: { rows, totals, date, count: rows.length } });
}
