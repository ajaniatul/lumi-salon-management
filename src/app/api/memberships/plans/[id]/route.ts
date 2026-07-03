import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { price, validityDays } = await req.json();

    const updated = await prisma.membership.update({
      where: { id: params.id },
      data: {
        ...(price        != null && { price: Number(price) }),
        ...(validityDays != null && { validityDays: Number(validityDays) }),
      },
    });

    return NextResponse.json({ success: true, data: { id: updated.id } });
  } catch (e) {
    console.error("[MEMBERSHIPS PLAN PATCH]", e);
    return NextResponse.json({ success: false, error: "Failed to update plan." }, { status: 500 });
  }
}

// DELETE /api/memberships/plans/[id] — delete membership plan
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    try {
      // Try hard delete
      await prisma.membership.delete({
        where: { id: params.id },
      });
      return NextResponse.json({ success: true, message: "Membership plan deleted successfully." });
    } catch (dbError) {
      // Soft-deactivate if linked to existing customer records
      await prisma.membership.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      return NextResponse.json({
        success: true,
        message: "Membership plan has associated customer records. It was deactivated instead of deleted."
      });
    }
  } catch (e) {
    console.error("[MEMBERSHIPS PLAN DELETE]", e);
    return NextResponse.json({ success: false, error: "Failed to delete plan." }, { status: 500 });
  }
}
