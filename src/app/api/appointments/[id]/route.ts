import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { AppointmentStatus } from "@prisma/client";

const VALID: AppointmentStatus[] = ["CONFIRMED", "WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"];

// PATCH /api/appointments/[id] — update status
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { status } = await request.json();
    if (!VALID.includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status." }, { status: 400 });
    }
    await prisma.appointment.update({ where: { id: params.id }, data: { status } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[APPOINTMENT PATCH]", e);
    return NextResponse.json({ success: false, error: "Failed to update appointment" }, { status: 500 });
  }
}

// DELETE /api/appointments/[id] — remove a booking (and its service links).
// If the appointment was already billed, reverses the invoice: deletes it and
// rolls back the visit/spend/loyalty totals it added to the customer.
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const appt = await prisma.appointment.findUnique({ where: { id: params.id }, include: { invoice: true } });
    if (!appt) return NextResponse.json({ success: false, error: "Appointment not found." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      if (appt.invoice) {
        const inv = appt.invoice;
        await tx.invoiceItem.deleteMany({ where: { invoiceId: inv.id } });
        await tx.payment.deleteMany({ where: { invoiceId: inv.id } });
        await tx.invoice.delete({ where: { id: inv.id } });

        const customer = await tx.customer.findUnique({
          where: { id: inv.customerId },
          select: { totalVisits: true, totalSpend: true, loyaltyPoints: true },
        });
        if (customer) {
          await tx.customer.update({
            where: { id: inv.customerId },
            data: {
              totalVisits:   Math.max(0, customer.totalVisits - 1),
              totalSpend:    Math.max(0, Number(customer.totalSpend) - Number(inv.totalAmount)),
              loyaltyPoints: Math.max(0, customer.loyaltyPoints - inv.loyaltyEarned),
            },
          });
        }
      }
      await tx.appointmentService.deleteMany({ where: { appointmentId: params.id } });
      await tx.appointment.delete({ where: { id: params.id } });
    });

    return NextResponse.json({ success: true, data: { hadInvoice: !!appt.invoice } });
  } catch (e) {
    console.error("[APPOINTMENT DELETE]", e);
    return NextResponse.json({ success: false, error: "Failed to delete appointment" }, { status: 500 });
  }
}
