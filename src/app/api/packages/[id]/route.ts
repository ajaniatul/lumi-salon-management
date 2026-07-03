import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { name, category, desc, services, validity, originalPrice, packagePrice } = await req.json();

    let days: number | undefined;
    if (validity) {
      const vm = String(validity).match(/(\d+)\s*(month|week|day)/i);
      if (vm) {
        const n = Number(vm[1]); const unit = vm[2].toLowerCase();
        days = unit === "month" ? n * 30 : unit === "week" ? n * 7 : n;
      }
    }

    const updated = await prisma.servicePackage.update({
      where: { id: params.id },
      data: {
        ...(name         && { name: name.trim() }),
        ...(category     && { category }),
        ...(desc         !== undefined && { description: desc?.trim() || null }),
        ...(services     && { serviceList: services.filter((s: string) => s.trim()) }),
        ...(days         !== undefined && { validityDays: days }),
        ...(packagePrice != null && { price: Number(packagePrice) }),
        ...(originalPrice !== undefined && { originalPrice: originalPrice ? Number(originalPrice) : null }),
      },
    });

    return NextResponse.json({ success: true, data: { id: updated.id } });
  } catch (e) {
    console.error("[PACKAGES PATCH]", e);
    return NextResponse.json({ success: false, error: "Failed to update package." }, { status: 500 });
  }
}
