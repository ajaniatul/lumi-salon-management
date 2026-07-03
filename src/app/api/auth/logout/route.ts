import { NextResponse } from "next/server";
import { getSession, clearAuthCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await getSession();

  if (session) {
    // Log the logout
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "LOGOUT",
        entity: "User",
        entityId: session.userId,
      },
    });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(clearAuthCookie());
  return response;
}
