import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { AppointmentStatus } from "@prisma/client";

const VALID: AppointmentStatus[] = ["CONFIRMED", "WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"];

const DAY_START = 10;   // scheduler starts at 10:00 — matches src/app/api/appointments/route.ts
const SLOT_MINS = 5;
function slotToHM(slot: number) {
  const total = DAY_START * 60 + slot * SLOT_MINS;
  return { h: Math.floor(total / 60), m: total % 60 };
}

// PATCH /api/appointments/[id] — update status, and/or reschedule (staff/time)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { status, staffId, startSlot, endSlot } = await request.json();
    const data: any = {};

    if (status !== undefined) {
      if (!VALID.includes(status)) {
        return NextResponse.json({ success: false, error: "Invalid status." }, { status: 400 });
      }
      data.status = status;
    }

    const isReschedule = staffId !== undefined || (startSlot != null && endSlot != null);
    if (isReschedule) {
      const current = await prisma.appointment.findUnique({ where: { id: params.id } });
      if (!current) return NextResponse.json({ success: false, error: "Appointment not found." }, { status: 404 });
      if (current.status === "COMPLETED" || current.status === "CANCELLED") {
        return NextResponse.json({ success: false, error: "Can't reschedule a completed or cancelled appointment." }, { status: 400 });
      }

      const targetStaffId = staffId ?? current.staffId;
      let newStart = current.startTime, newEnd = current.endTime, newDuration = current.duration;
      if (startSlot != null && endSlot != null) {
        if (endSlot <= startSlot) {
          return NextResponse.json({ success: false, error: "Invalid time range." }, { status: 400 });
        }
        // Derive the calendar day from startTime, not the @db.Date `date` column — that
        // column gets truncated to its UTC calendar day on write, which silently rolls
        // back a day in positive-UTC-offset zones (e.g. IST) versus the local day the
        // appointment was actually booked for. startTime is a full DateTime and round-trips
        // correctly with local getters.
        const y = current.startTime.getFullYear(), mo = current.startTime.getMonth(), d = current.startTime.getDate();
        const s = slotToHM(startSlot), e = slotToHM(endSlot);
        newStart = new Date(y, mo, d, s.h, s.m, 0, 0);
        newEnd   = new Date(y, mo, d, e.h, e.m, 0, 0);
        newDuration = (endSlot - startSlot) * SLOT_MINS;
      }

      const conflict = await prisma.appointment.findFirst({
        where: {
          id: { not: params.id },
          staffId: targetStaffId,
          status: { notIn: ["CANCELLED"] },
          startTime: { lt: newEnd },
          endTime:   { gt: newStart },
        },
      });
      if (conflict) {
        return NextResponse.json({ success: false, error: "That stylist already has an appointment at this time." }, { status: 409 });
      }

      data.staffId   = targetStaffId;
      data.startTime = newStart;
      data.endTime   = newEnd;
      data.duration  = newDuration;
    }

    await prisma.appointment.update({ where: { id: params.id }, data });
    if (data.duration !== undefined) {
      await prisma.appointmentService.updateMany({ where: { appointmentId: params.id }, data: { duration: data.duration } });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[APPOINTMENT PATCH]", e);
    return NextResponse.json({ success: false, error: "Failed to update appointment" }, { status: 500 });
  }
}

// DELETE /api/appointments/[id] — remove a booking (and its service links).
// If the appointment was already billed, reverses the invoice: deletes it and
// rolls back the visit/spend totals it added to the customer.
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
          select: { totalVisits: true, totalSpend: true },
        });
        if (customer) {
          await tx.customer.update({
            where: { id: inv.customerId },
            data: {
              totalVisits: Math.max(0, customer.totalVisits - 1),
              totalSpend:  Math.max(0, Number(customer.totalSpend) - Number(inv.totalAmount)),
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
