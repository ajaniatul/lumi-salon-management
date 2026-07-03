import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import type { Role } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────
export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  role: Role;
  staffId?: string;
}

// ─── Config ──────────────────────────────────────────────
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-in-production"
);
const COOKIE_NAME = "salon_auth_token";
const TOKEN_EXPIRY = "7d";

// ─── Token Management ────────────────────────────────────

/** Sign a new JWT and return the token string */
export async function signToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/** Verify a JWT and return its payload, or null if invalid */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

/** Read the current session from the cookie */
export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** Read the session from a Next.js request object (for middleware) */
export async function getSessionFromRequest(
  req: NextRequest
): Promise<JWTPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** Set the auth cookie (server action or API route) */
export function createAuthCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  };
}

/** Clear the auth cookie */
export function clearAuthCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 0,
    path: "/",
  };
}

// ─── Role Helpers ─────────────────────────────────────────

/** Check if a role can access admin-only features */
export function isAdmin(role: Role): boolean {
  return role === "ADMIN";
}

/** Check if a role can manage operations */
export function isManagerOrAbove(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

/** Check if a role can create bookings & bills */
export function canBook(role: Role): boolean {
  return role !== "STYLIST";
}

/** Map role to a display label */
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  RECEPTIONIST: "Receptionist",
  STYLIST: "Stylist",
};

/** Role-based route access map */
export const ROLE_PERMISSIONS: Record<
  Role,
  { canAccess: string[]; cannotAccess: string[] }
> = {
  ADMIN: { canAccess: ["*"], cannotAccess: [] },
  MANAGER: {
    canAccess: [
      "/dashboard",
      "/appointments",
      "/customers",
      "/billing",
      "/products",
      "/services",
      "/inventory",
      "/purchases",
      "/expenses",
      "/staff",
      "/reports",
      "/analytics",
      "/memberships",
      "/packages",
      "/attendance",
      "/commission",
    ],
    cannotAccess: ["/settings/security", "/settings/backup"],
  },
  RECEPTIONIST: {
    canAccess: [
      "/dashboard",
      "/appointments",
      "/customers",
      "/billing",
      "/products",
      "/services",
      "/memberships",
      "/packages",
    ],
    cannotAccess: [
      "/staff",
      "/expenses",
      "/purchases",
      "/inventory",
      "/reports",
      "/analytics",
      "/attendance",
      "/commission",
      "/settings",
    ],
  },
  STYLIST: {
    canAccess: ["/dashboard", "/appointments", "/attendance"],
    cannotAccess: [
      "/customers",
      "/billing",
      "/products",
      "/services",
      "/inventory",
      "/purchases",
      "/expenses",
      "/staff",
      "/reports",
      "/analytics",
      "/memberships",
      "/packages",
      "/commission",
      "/settings",
    ],
  },
};
