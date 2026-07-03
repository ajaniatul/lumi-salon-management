import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { phone, packageId, purchaseDate } = await req.json();

    if (!phone?.trim() || !packageId || !purchaseDate) {
      return NextResponse.json({ success: false, error: "Phone, package and purchase date are required." }, { status: 400 });
    }

    const customer = await prisma.customer.findFirst({ where: { phone: phone.trim(), isActive: true } });
    if (!customer) {
      return NextResponse.json({ success: false, error: "No customer found with that phone. Add them in Customers first." }, { status: 404 });
    }

    const pkg = await prisma.servicePackage.findUnique({ where: { id: packageId } });
    if (!pkg) {
      return NextResponse.json({ success: false, error: "Package not found." }, { status: 404 });
    }

    const start  = new Date(purchaseDate);
    const expiry = new Date(start);
    expiry.setDate(expiry.getDate() + pkg.validityDays);

    const cp = await prisma.customerPackage.create({
      data: { customerId: customer.id, packageId, purchaseDate: start, expiryDate: expiry, isActive: true },
    });

    return NextResponse.json({ success: true, data: { id: cp.id, customerName: customer.name } });
  } catch (e) {
    console.error("[PACKAGES ASSIGN]", e);
    return NextResponse.json({ success: false, error: "Failed to assign package." }, { status: 500 });
  }
}
