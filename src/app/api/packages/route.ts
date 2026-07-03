import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function daysToValidity(days: number) {
  if (days >= 360) return "12 months";
  if (days >= 175) return "6 months";
  if (days >= 85)  return "3 months";
  if (days >= 40)  return "6 weeks";
  if (days >= 25)  return "4 weeks";
  if (days >= 20)  return "3 weeks";
  return `${days} days`;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const packages = await prisma.servicePackage.findMany({
      where: { isActive: true },
      include: { _count: { select: { customerPackages: { where: { isActive: true } } } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: packages.map(p => ({
        id:            p.id,
        name:          p.name,
        desc:          p.description ?? "",
        category:      p.category,
        services:      p.serviceList,
        validity:      daysToValidity(p.validityDays),
        validityDays:  p.validityDays,
        originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
        packagePrice:  Number(p.price),
        savings:       p.originalPrice ? Number(p.originalPrice) - Number(p.price) : 0,
        activePurchases: p._count.customerPackages,
      })),
    });
  } catch (e) {
    console.error("[PACKAGES GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load packages." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { name, category, desc, services, validity, originalPrice, packagePrice } = await req.json();
    if (!name?.trim() || !packagePrice || !services?.length) {
      return NextResponse.json({ success: false, error: "Name, price and services are required." }, { status: 400 });
    }

    // Convert validity string to days
    let days = 90;
    const vm = String(validity ?? "3 months").match(/(\d+)\s*(month|week|day)/i);
    if (vm) {
      const n = Number(vm[1]); const unit = vm[2].toLowerCase();
      if (unit === "month") days = n * 30;
      else if (unit === "week") days = n * 7;
      else days = n;
    }

    const pkg = await prisma.servicePackage.create({
      data: {
        name:         name.trim(),
        description:  desc?.trim() || null,
        category:     category || "Hair",
        price:        Number(packagePrice),
        originalPrice: originalPrice ? Number(originalPrice) : null,
        validityDays: days,
        serviceList:  services.filter((s: string) => s.trim()),
      },
    });

    return NextResponse.json({ success: true, data: { id: pkg.id } });
  } catch (e) {
    console.error("[PACKAGES POST]", e);
    return NextResponse.json({ success: false, error: "Failed to create package." }, { status: 500 });
  }
}
