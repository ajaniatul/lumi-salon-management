import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// PATCH /api/services/[id] — update service
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { name, cat, price, duration, gst, desc } = await req.json();

    const updated = await prisma.service.update({
      where: { id: params.id },
      data: {
        ...(name     && { name: name.trim() }),
        ...(cat      && { category: cat }),
        ...(price    != null && { price: Number(price) }),
        ...(duration != null && { duration: Number(duration) }),
        ...(gst      != null && { gstRate: Number(gst) }),
        ...(desc     !== undefined && { description: desc?.trim() || null }),
      },
    });

    return NextResponse.json({ success: true, data: { id: updated.id } });
  } catch (e) {
    console.error("[SERVICES PATCH]", e);
    return NextResponse.json({ success: false, error: "Failed to update service." }, { status: 500 });
  }
}

// DELETE /api/services/[id] — delete service
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    try {
      // Try hard delete
      await prisma.service.delete({
        where: { id: params.id },
      });
      return NextResponse.json({ success: true, message: "Service deleted successfully from catalog." });
    } catch (dbError) {
      // Soft-deactivate if linked to existing transactions/appointments
      await prisma.service.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      return NextResponse.json({
        success: true,
        message: "Service has historic appointments or billing logs. It was deactivated instead of hard-deleted."
      });
    }
  } catch (e) {
    console.error("[SERVICES DELETE]", e);
    return NextResponse.json({ success: false, error: "Failed to delete service." }, { status: 500 });
  }
}
