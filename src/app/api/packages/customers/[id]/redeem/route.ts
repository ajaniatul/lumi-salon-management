import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const cp = await prisma.customerPackage.findUnique({
      where: { id: params.id },
      include: { package: true, sessionUsages: true },
    });
    if (!cp) return NextResponse.json({ success: false, error: "Customer package not found." }, { status: 404 });

    const total = cp.package.serviceList.length || 1;
    if (cp.sessionUsages.length >= total) {
      return NextResponse.json({ success: false, error: "All sessions already redeemed." }, { status: 400 });
    }

    await prisma.packageSessionUsage.create({
      data: { customerPackageId: params.id, serviceId: cp.packageId },
    });

    const remaining = total - cp.sessionUsages.length - 1;
    if (remaining <= 0) {
      await prisma.customerPackage.update({ where: { id: params.id }, data: { isActive: false } });
    }

    return NextResponse.json({ success: true, data: { remaining } });
  } catch (e) {
    console.error("[PACKAGES REDEEM]", e);
    return NextResponse.json({ success: false, error: "Failed to redeem session." }, { status: 500 });
  }
}
