import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, parseISO } from "date-fns";

// ─── Tailwind Class Merger ────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Currency ────────────────────────────────────────────
export function formatCurrency(
  amount: number | string,
  symbol = "₹"
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${symbol}${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCurrencyCompact(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(1)}Cr`;
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(1)}L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
}

// ─── Date / Time ─────────────────────────────────────────
export function formatDate(date: Date | string, fmt = "dd MMM yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, fmt);
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "hh:mm a");
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd MMM yyyy, hh:mm a");
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

// ─── ID Generators ───────────────────────────────────────
export function generateCustomerId(sequence: number): string {
  return `CUS-${String(sequence).padStart(4, "0")}`;
}

export function generateEmployeeId(sequence: number): string {
  return `EMP-${String(sequence).padStart(3, "0")}`;
}

export function generateInvoiceNumber(sequence: number): string {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(sequence).padStart(4, "0")}`;
}

export function generateAppointmentNo(sequence: number): string {
  const date = format(new Date(), "yyyyMMdd");
  return `APT-${date}-${String(sequence).padStart(3, "0")}`;
}

export function generatePurchaseNumber(sequence: number): string {
  const year = new Date().getFullYear();
  return `PUR-${year}-${String(sequence).padStart(3, "0")}`;
}

// ─── Percentage & Tax ────────────────────────────────────
export function calculateGST(amount: number, gstRate: number) {
  const taxableAmount = amount;
  const cgst = (taxableAmount * gstRate) / 2 / 100;
  const sgst = (taxableAmount * gstRate) / 2 / 100;
  return { cgst, sgst, totalGst: cgst + sgst };
}

export function calculateDiscount(
  amount: number,
  discountType: "PERCENTAGE" | "FIXED",
  discountValue: number
): number {
  if (discountType === "PERCENTAGE") {
    return (amount * discountValue) / 100;
  }
  return Math.min(discountValue, amount);
}

// ─── String Helpers ──────────────────────────────────────
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function truncate(str: string, len = 30): string {
  return str.length > len ? `${str.slice(0, len)}...` : str;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─── Appointment Duration ────────────────────────────────
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ─── Phone Formatting ────────────────────────────────────
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

// ─── Status Color Map ────────────────────────────────────
export const APPOINTMENT_STATUS_COLORS = {
  CONFIRMED: "bg-blue-100 text-blue-700",
  WAITING:   "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-primary-100 text-primary-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW:   "bg-gray-100 text-gray-600",
} as const;

export const PAYMENT_STATUS_COLORS = {
  PENDING:  "bg-amber-100 text-amber-700",
  PAID:     "bg-emerald-100 text-emerald-700",
  PARTIAL:  "bg-blue-100 text-blue-700",
  REFUNDED: "bg-purple-100 text-purple-700",
} as const;

// ─── Pagination ──────────────────────────────────────────
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number
): { data: T[]; total: number; totalPages: number } {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const data = items.slice((page - 1) * pageSize, page * pageSize);
  return { data, total, totalPages };
}

// ─── API Response Helpers ────────────────────────────────
export function successResponse<T>(data: T, message?: string) {
  return { success: true, data, message };
}

export function errorResponse(message: string, status = 400) {
  return { success: false, error: message, status };
}
