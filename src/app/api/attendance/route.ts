import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

function toHHMM(d: Date | null | undefined): string | null {
  if (!d) return null;
  const dt = new Date(d);
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

// GET /api/attendance?month=6&year=2026
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now   = new Date();
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));
  const year  = parseInt(searchParams.get("year")  ?? String(now.getFullYear()));

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59);

  try {
    const staff = await prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { employeeId: "asc" },
      include: {
        attendance: {
          where: { date: { gte: monthStart, lte: monthEnd } },
          orderBy: { date: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      month,
      year,
      data: staff.map(s => ({
        id:          s.employeeId,
        dbId:        s.id,
        name:        s.name,
        designation: s.designation,
        records:     s.attendance.map(a => ({
          date:       a.date.toISOString().slice(0, 10),
          status:     a.status,
          clockIn:    toHHMM(a.clockIn),
          clockOut:   toHHMM(a.clockOut),
          workHours:  a.workHours ? Number(a.workHours) : null,
          notes:      a.notes,
        })),
      })),
    });
  } catch (e) {
    console.error("[ATTENDANCE GET]", e);
    return NextResponse.json({ success: false, error: "Failed to load attendance." }, { status: 500 });
  }
}

// POST /api/attendance — upsert a day's record
// Body: { staffDbId, date, status, notes?, clockIn?: "HH:MM", clockOut?: "HH:MM", action? }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  try {
    const { staffDbId, date, status, notes, action, clockIn: clockInStr, clockOut: clockOutStr } = await req.json();
    if (!staffDbId || !date || !status) {
      return NextResponse.json({ success: false, error: "staffDbId, date and status are required." }, { status: 400 });
    }

    const dateObj = new Date(date);
    const now     = new Date();
    const [dateYear, dateMonth, dateDay] = (date as string).split("-").map(Number);

    let clockInDate:  Date | undefined | null = undefined;
    let clockOutDate: Date | undefined | null = undefined;
    let workHours:    number | undefined | null = undefined;

    // Legacy action (backward compat)
    if (action === "clock_in") {
      clockInDate  = now;
      clockOutDate = null;
      workHours    = null;
    }

    // Manual time entry — "HH:MM" strings
    if (clockInStr && typeof clockInStr === "string") {
      const [h, m] = (clockInStr as string).split(":").map(Number);
      clockInDate  = new Date(dateYear, dateMonth - 1, dateDay, h, m, 0, 0);
    }
    if (clockOutStr && typeof clockOutStr === "string") {
      const [h, m] = (clockOutStr as string).split(":").map(Number);
      clockOutDate = new Date(dateYear, dateMonth - 1, dateDay, h, m, 0, 0);
    }

    // Calculate work hours when both provided in the same request
    if (clockInDate && clockOutDate) {
      const diffMs = clockOutDate.getTime() - clockInDate.getTime();
      workHours = Math.max(0, diffMs / (1000 * 60 * 60));
    }

    const updateData = {
      status,
      notes: notes ?? null,
      ...(clockInDate  !== undefined && { clockIn:  clockInDate }),
      ...(clockOutDate !== undefined && { clockOut: clockOutDate }),
      ...(workHours    !== undefined && { workHours }),
    };

    const record = await prisma.attendance.upsert({
      where:  { staffId_date: { staffId: staffDbId, date: dateObj } },
      create: { staffId: staffDbId, date: dateObj, ...updateData },
      update: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        date:      record.date.toISOString().slice(0, 10),
        status:    record.status,
        notes:     record.notes,
        clockIn:   toHHMM(record.clockIn),
        clockOut:  toHHMM(record.clockOut),
        workHours: record.workHours ? Number(record.workHours) : null,
      },
    });
  } catch (e) {
    console.error("[ATTENDANCE POST]", e);
    return NextResponse.json({ success: false, error: "Failed to save attendance." }, { status: 500 });
  }
}
