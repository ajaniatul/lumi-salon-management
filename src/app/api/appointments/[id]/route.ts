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

// DELETE /api/appointments/[id] — remove a booking (and its service links)
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.appointmentService.deleteMany({ where: { appointmentId: params.id } });
    await prisma.appointment.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[APPOINTMENT DELETE]", e);
    return NextResponse.json({ success: false, error: "Failed to delete appointment" }, { status: 500 });
  }
}
