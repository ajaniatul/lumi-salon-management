"use client";

import Link from "next/link";
import { Clock, ChevronRight, User } from "lucide-react";
import { cn, formatTime, formatDuration, APPOINTMENT_STATUS_COLORS } from "@/lib/utils";
import type { AppointmentStatus } from "@/types";

interface AppointmentItem {
  id: string;
  appointmentNo: string;
  customer: { name: string; phone: string };
  staff: { name: string };
  startTime: string;
  endTime: string;
  duration: number;
  status: AppointmentStatus;
  services: string[];
}

interface AppointmentsWidgetProps {
  appointments: AppointmentItem[];
  loading?: boolean;
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  CONFIRMED:   "Confirmed",
  WAITING:     "Waiting",
  IN_PROGRESS: "In Progress",
  COMPLETED:   "Done",
  CANCELLED:   "Cancelled",
  NO_SHOW:     "No Show",
};

export function AppointmentsWidget({ appointments, loading = false }: AppointmentsWidgetProps) {
  if (loading) {
    return (
      <div className="card-luxury p-5">
        <div className="skeleton w-44 h-5 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-ivory-100">
              <div className="skeleton w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton w-32 h-4 rounded" />
                <div className="skeleton w-24 h-3 rounded" />
              </div>
              <div className="skeleton w-16 h-5 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card-luxury p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Today&apos;s Appointments</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {appointments.length} bookings scheduled
          </p>
        </div>
        <Link
          href="/appointments"
          className="flex items-center gap-1 text-xs font-medium hover:underline"
          style={{ color: "#B76E79" }}
        >
          View all
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* List */}
      {appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: "rgba(183,110,121,0.08)" }}>
            <Clock className="w-6 h-6" style={{ color: "#D4A0A7" }} />
          </div>
          <p className="text-sm font-medium text-foreground">No appointments today</p>
          <p className="text-xs text-muted-foreground mt-1">
            Bookings will appear here
          </p>
          <Link href="/appointments" className="btn-primary text-xs px-4 py-2 mt-4">
            Book appointment
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map((appt) => (
            <Link
              key={appt.id}
              href="/appointments"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-ivory-100 transition-colors group"
            >
              {/* Time block */}
              <div className="w-12 text-center flex-shrink-0">
                <p className="text-sm font-semibold text-foreground leading-none">
                  {formatTime(appt.startTime)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDuration(appt.duration)}
                </p>
              </div>

              {/* Divider */}
              <div className="w-px h-8 rounded-full flex-shrink-0"
                style={{ background: "#E8E0DC" }} />

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {appt.customer.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {appt.services.join(", ")} · {appt.staff.name}
                </p>
              </div>

              {/* Status */}
              <span className={cn(
                "badge flex-shrink-0 text-[10px]",
                APPOINTMENT_STATUS_COLORS[appt.status]
              )}>
                {STATUS_LABELS[appt.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
