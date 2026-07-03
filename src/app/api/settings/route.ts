import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/settings — Load or initialize salon settings
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    let settings = await prisma.salonSettings.findFirst();
    if (!settings) {
      // Create a default row if none exists
      settings = await prisma.salonSettings.create({
        data: {
          salonName: "Lumi Beauty Lounge",
          tagline: "Where Beauty Meets Luxury",
          phone: "022-12345678",
          email: "hello@lumisalon.in",
          address: "Shop No. 12, First Floor, Luxury Mall, Linking Road, Bandra West, Mumbai - 400050",
          gstin: "27AABCE1234F1Z5",
          currency: "INR",
          currencySymbol: "₹",
          openingTime: "10:00 AM",
          closingTime: "07:00 PM",
        },
      });
    }
    return NextResponse.json({ success: true, data: settings });
  } catch (e) {
    console.error("[SETTINGS GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load settings" }, { status: 500 });
  }
}

// POST /api/settings — Update salon settings
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Unauthorized. Admin role required." }, { status: 403 });
  }

  try {
    const body = await req.json();
    let settings = await prisma.salonSettings.findFirst();

    if (settings) {
      settings = await prisma.salonSettings.update({
        where: { id: settings.id },
        data: body,
      });
    } else {
      settings = await prisma.salonSettings.create({
        data: body,
      });
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (e) {
    console.error("[SETTINGS POST]", e);
    return NextResponse.json({ success: false, error: "Failed to save settings" }, { status: 500 });
  }
}
