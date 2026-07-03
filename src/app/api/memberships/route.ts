import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function daysToValidity(days: number) {
  if (days >= 360) return "12 months";
  if (days >= 175) return "6 months";
  if (days >= 85)  return "3 months";
  return `${days} days`;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {


    const [plans, members] = await Promise.all([
      prisma.membership.findMany({
        where: { isActive: true },
        include: { _count: { select: { customerMemberships: { where: { isActive: true } } } } },
        orderBy: { price: "asc" },
      }),
      prisma.customerMembership.findMany({
        include: { customer: true, membership: true },
        orderBy: { expiryDate: "asc" },
      }),
    ]);

    const now = Date.now();

    return NextResponse.json({
      success: true,
      plans: plans.map(p => ({
        id:          p.id,
        tier:        p.tier,
        name:        p.name,
        price:       Number(p.price),
        validity:    daysToValidity(p.validityDays),
        validityDays: p.validityDays,
        discount:    Number(p.discountPercent),
        benefits:    p.benefits,
        members:     p._count.customerMemberships,
      })),
      members: members.map(m => {
        const daysLeft = Math.round((m.expiryDate.getTime() - now) / 86400000);
        return {
          id:         m.id,
          customerId: m.customerId,
          customer:   m.customer.name,
          phone:      m.customer.phone,
          tier:       m.membership.tier,
          tierName:   m.membership.name,
          price:      Number(m.membership.price),
          start:      m.startDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          expiry:     m.expiryDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          daysLeft,
          status:     m.isActive && daysLeft >= 0 ? "ACTIVE" : "EXPIRED",
        };
      }),
    });
  } catch (e) {
    console.error("[MEMBERSHIPS GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load memberships." }, { status: 500 });
  }
}

// DELETE /api/memberships — delete customer membership assignment
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";
    if (!id) return NextResponse.json({ success: false, error: "ID is required." }, { status: 400 });

    // Hard delete the customer membership assignment
    await prisma.customerMembership.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Customer membership assignment removed successfully." });
  } catch (e) {
    console.error("[CUSTOMER MEMBERSHIP DELETE]", e);
    return NextResponse.json({ success: false, error: "Failed to delete customer membership." }, { status: 500 });
  }
}

// POST /api/memberships — create new membership plan
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { name, tier, price, validityDays, discountPercent, benefits } = await req.json();
    if (!name?.trim() || !tier || price == null || discountPercent == null) {
      return NextResponse.json({ success: false, error: "Name, tier, price and discount percentage are required." }, { status: 400 });
    }

    const plan = await prisma.membership.create({
      data: {
        name: name.trim(),
        tier: tier.toUpperCase(),
        price: Number(price),
        validityDays: Number(validityDays || 90),
        discountPercent: Number(discountPercent),
        benefits: Array.isArray(benefits) ? benefits.filter((b: string) => b.trim()) : [],
      },
    });

    return NextResponse.json({ success: true, data: { id: plan.id } });
  } catch (e) {
    console.error("[MEMBERSHIPS POST]", e);
    return NextResponse.json({ success: false, error: "Failed to create membership plan." }, { status: 500 });
  }
}
