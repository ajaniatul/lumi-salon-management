import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Gender } from "@prisma/client";

// Map a Prisma customer (+relations) into the shape the UI uses.
function toUI(c: any) {
  const tier = c.membership?.membership?.tier as string | undefined;
  const titleTier = tier ? tier.charAt(0) + tier.slice(1).toLowerCase() : null;
  const lastInvoice = c.invoices?.[0]?.createdAt as Date | undefined;
  return {
    id: c.customerId,
    name: c.name,
    phone: c.phone,
    email: c.email ?? "",
    visits: c.totalVisits,
    totalSpent: Number(c.totalSpend).toLocaleString("en-IN"),
    lastVisit: lastInvoice
      ? new Date(lastInvoice).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : c.totalVisits > 0 ? "Recently" : "Never",
    membership: titleTier,
    birthday: c.dateOfBirth
      ? new Date(c.dateOfBirth).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
      : "",
    tags: c.tags ?? [],
  };
}

// GET /api/customers — list all active customers; ?phone=XXX for single lookup
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const phone = req.nextUrl.searchParams.get("phone");
    if (phone) {
      const c = await prisma.customer.findFirst({ where: { phone: phone.trim(), isActive: true } });
      if (!c) return NextResponse.json({ success: true, data: [] });
      return NextResponse.json({ success: true, data: [{ id: c.id, name: c.name, phone: c.phone }] });
    }

    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: {
        membership: { include: { membership: { select: { tier: true } } } },
        invoices: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    });
    return NextResponse.json({ success: true, data: customers.map(toUI) });
  } catch (e) {
    console.error("[CUSTOMERS GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load customers" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(6),
  email: z.string().trim().email().optional().or(z.literal("")),
  gender: z.enum(["Female", "Male", "Other"]).optional().or(z.literal("")),
  dob: z.string().optional().or(z.literal("")),
});

// POST /api/customers — create a customer
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Name and a valid phone are required." }, { status: 400 });
  }
  const { name, phone, email, gender, dob } = parsed.data;

  try {
    const existing = await prisma.customer.findUnique({ where: { phone } });
    if (existing) {
      return NextResponse.json({ success: false, error: "A customer with this phone already exists." }, { status: 409 });
    }

    // Next sequential customerId (CUS-0001 format)
    const last = await prisma.customer.findFirst({ orderBy: { customerId: "desc" }, select: { customerId: true } });
    const nextNum = last ? parseInt(last.customerId.replace(/\D/g, ""), 10) + 1 : 1;
    const customerId = `CUS-${String(nextNum).padStart(4, "0")}`;

    const genderMap: Record<string, Gender> = { Female: "FEMALE", Male: "MALE", Other: "OTHER" };

    const created = await prisma.customer.create({
      data: {
        customerId,
        name,
        phone,
        email: email || null,
        gender: gender ? genderMap[gender] : null,
        dateOfBirth: dob ? new Date(dob) : null,
        tags: ["New"],
      },
      include: {
        membership: { include: { membership: { select: { tier: true } } } },
        invoices: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    });
    return NextResponse.json({ success: true, data: toUI(created) }, { status: 201 });
  } catch (e) {
    console.error("[CUSTOMERS POST]", e);
    return NextResponse.json({ success: false, error: "Failed to create customer" }, { status: 500 });
  }
}
