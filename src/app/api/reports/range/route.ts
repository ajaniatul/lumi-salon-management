import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ success: false, error: "from and to dates required" }, { status: 400 });

  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const start = new Date(fy, fm - 1, fd, 0, 0, 0);
  const end   = new Date(ty, tm - 1, td, 23, 59, 59, 999);

  try {
    const invoices = await prisma.invoice.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: {
        customer:    { select: { name: true } },
        items:       {
          include: {
            service: { select: { category: true } },
            product: { select: { category: true } },
          },
        },
        appointment: { include: { staff: { select: { name: true } } } },
        payments:    { select: { method: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const rows: object[] = [];

    for (const inv of invoices) {
      let meta: any = {};
      try { meta = JSON.parse(inv.notes || "{}"); } catch {}

      const attendedBy = meta.staffNames?.length
        ? (meta.staffNames as string[]).join(", ")
        : (inv.appointment?.staff?.name ?? "—");

      const paymentMethod = meta.methodLabel
        ?? (inv.payments?.[0]?.method ?? "—");

      const discountAmt = Number(inv.discountAmount);
      const subtotal    = Number(inv.subtotal);
      const discountPct = subtotal > 0
        ? Math.round((discountAmt / subtotal) * 100 * 10) / 10
        : 0;

      const date = new Date(inv.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      });

      for (const item of inv.items) {
        const isService = item.itemType === "SERVICE";
        const catRaw    = isService
          ? (item.service?.category ?? "")
          : (item.product?.category ?? "");
        const category  = catRaw
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c: string) => c.toUpperCase());

        const itemTotal  = Number(item.total);
        const gstRate    = Number(item.gstRate);
        // If gstRate is 0, amount is non-taxable; otherwise it's taxable
        const taxableAmt    = gstRate > 0 ? itemTotal : 0;
        const nonTaxableAmt = gstRate === 0 ? itemTotal : 0;
        const itemGst       = Math.round(itemTotal * gstRate / 100 * 100) / 100;

        rows.push({
          invoiceNo:      inv.invoiceNumber,
          date,
          customer:       inv.customer?.name ?? "—",
          attendedBy,
          itemName:       item.name,
          itemType:       isService ? "Service" : "Product",
          category,
          taxableAmt,
          nonTaxableAmt,
          totalTax:       itemGst,
          discountPct,
          totalPaid:      Number(inv.paidAmount),
          paymentMethod,
        });
      }
    }

    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    console.error("[REPORTS RANGE]", e);
    return NextResponse.json({ success: false, error: "Failed to load range report" }, { status: 500 });
  }
}
