import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const customerPkgs = await prisma.customerPackage.findMany({
      where: { isActive: true },
      include: {
        customer: true,
        package:  true,
        sessionUsages: true,
      },
      orderBy: { purchaseDate: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: customerPkgs.map(cp => {
        const total = cp.package.serviceList.length || 1;
        const used  = cp.sessionUsages.length;
        return {
          id:           cp.id,
          customer:     cp.customer.name,
          phone:        cp.customer.phone,
          pkg:          cp.package.name,
          pkgId:        cp.packageId,
          purchased:    cp.purchaseDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          expiry:       cp.expiryDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          sessionsUsed:  used,
          sessionsTotal: total,
          remaining:     Math.max(0, total - used),
        };
      }),
    });
  } catch (e) {
    console.error("[PACKAGES CUSTOMERS GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load customer packages." }, { status: 500 });
  }
}
