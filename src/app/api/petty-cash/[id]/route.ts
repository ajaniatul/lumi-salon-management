import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { date, description, category, type, amount } = await req.json();
    const updated = await prisma.pettyCashEntry.update({
      where: { id: params.id },
      data: {
        ...(date        && { date: new Date(date) }),
        ...(description && { description: description.trim() }),
        ...(category    && { category }),
        ...(type        && { type }),
        ...(amount      != null && { amount: Number(amount) }),
      },
    });
    return NextResponse.json({ success: true, data: { id: updated.id } });
  } catch (err) {
    console.error("[PETTY-CASH PATCH]", err);
    return NextResponse.json({ success: false, error: "Failed to update entry." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.pettyCashEntry.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PETTY-CASH DELETE]", err);
    return NextResponse.json({ success: false, error: "Failed to delete entry." }, { status: 500 });
  }
}
