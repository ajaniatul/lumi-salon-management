import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/services — full catalogue (?full=true) or slim for billing/scheduler
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const full = new URL(req.url).searchParams.get("full") === "true";

  try {
    const services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      ...(full ? {} : {
        select: { id: true, serviceCode: true, name: true, category: true, price: true, duration: true, gstRate: true },
      }),
    });

    return NextResponse.json({
      success: true,
      data: services.map((s: any) => ({
        id:          s.id,
        code:        s.serviceCode,
        name:        s.name,
        cat:         s.category,
        price:       Number(s.price),
        duration:    s.duration,
        gst:         Number(s.gstRate),
        ...(full && {
          desc:      s.description ?? "",
          isActive:  s.isActive,
          sortOrder: s.sortOrder,
        }),
      })),
    });
  } catch (e) {
    console.error("[SERVICES GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load services" }, { status: 500 });
  }
}

// POST /api/services — create service
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, cat, price, duration, gst, desc } = body;

    if (!name?.trim() || !cat || price == null || !duration) {
      return NextResponse.json({ success: false, error: "Name, category, price and duration are required." }, { status: 400 });
    }

    const last = await prisma.service.findFirst({ orderBy: { serviceCode: "desc" }, select: { serviceCode: true } });
    const lastNum = last ? parseInt(last.serviceCode.replace("SRV-", ""), 10) : 0;
    const serviceCode = `SRV-${String(lastNum + 1).padStart(3, "0")}`;

    const service = await prisma.service.create({
      data: {
        serviceCode,
        name:        name.trim(),
        category:    cat,
        price:       Number(price),
        duration:    Number(duration),
        gstRate:     Number(gst) || 18,
        description: desc?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, data: { id: service.id, code: service.serviceCode } });
  } catch (e: any) {
    console.error("[SERVICES POST]", e);
    if (e.code === "P2002") return NextResponse.json({ success: false, error: "Service code already exists." }, { status: 409 });
    return NextResponse.json({ success: false, error: "Failed to create service." }, { status: 500 });
  }
}
