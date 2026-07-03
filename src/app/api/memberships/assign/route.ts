import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { phone, planId, startDate } = await req.json();

    if (!phone?.trim() || !planId || !startDate) {
      return NextResponse.json({ success: false, error: "Phone, plan and start date are required." }, { status: 400 });
    }

    const customer = await prisma.customer.findFirst({ where: { phone: phone.trim() } });
    if (!customer) {
      return NextResponse.json({ success: false, error: "No customer found with that phone number. Add them in the Customers page first." }, { status: 404 });
    }

    const plan = await prisma.membership.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ success: false, error: "Membership plan not found." }, { status: 404 });
    }

    const start  = new Date(startDate);
    const expiry = new Date(start);
    expiry.setDate(expiry.getDate() + plan.validityDays);

    const cm = await prisma.customerMembership.upsert({
      where:  { customerId: customer.id },
      update: { membershipId: planId, startDate: start, expiryDate: expiry, isActive: true, remainingVisits: plan.visitLimit ?? null },
      create: { customerId: customer.id, membershipId: planId, startDate: start, expiryDate: expiry, isActive: true, remainingVisits: plan.visitLimit ?? null },
    });

    return NextResponse.json({ success: true, data: { id: cm.id, customerName: customer.name } });
  } catch (e) {
    console.error("[MEMBERSHIPS ASSIGN]", e);
    return NextResponse.json({ success: false, error: "Failed to assign membership." }, { status: 500 });
  }
}
