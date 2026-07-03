"use client";

import { formatCurrency, getInitials } from "@/lib/utils";

interface StaffStat {
  name: string;
  avatar?: string;
  appointments: number;
  revenue: number;
  target?: number;
}

interface StaffPerformanceProps {
  staff: StaffStat[];
  loading?: boolean;
}

export function StaffPerformance({ staff, loading = false }: StaffPerformanceProps) {
  if (loading) {
    return (
      <div className="card-luxury p-5">
        <div className="skeleton w-40 h-5 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton w-28 h-4 rounded" />
                <div className="skeleton w-full h-2 rounded-full" />
              </div>
              <div className="skeleton w-16 h-4 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...staff.map((s) => s.revenue), 1);

  return (
    <div className="card-luxury p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Staff Performance</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Revenue generated this month</p>
      </div>

      {staff.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No data</p>
      ) : (
        <div className="space-y-4">
          {staff.map((member, i) => {
            const pct = (member.revenue / maxRevenue) * 100;
            return (
              <div key={member.name} className="flex items-center gap-3">
                {/* Rank */}
                <span className="text-xs font-bold w-4 text-center flex-shrink-0"
                  style={{ color: i === 0 ? "#B76E79" : "#9CA3AF" }}>
                  #{i + 1}
                </span>

                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #B76E79, #C4956A)" }}
                >
                  {member.avatar
                    ? <img src={member.avatar} className="w-8 h-8 rounded-full object-cover" alt={member.name} />
                    : getInitials(member.name)
                  }
                </div>

                {/* Progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-foreground truncate">
                      {member.name}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {member.appointments} appts
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-ivory-200">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: i === 0
                          ? "linear-gradient(90deg, #B76E79, #C4956A)"
                          : "linear-gradient(90deg, #D4A0A7, #DBA98E)",
                      }}
                    />
                  </div>
                </div>

                {/* Revenue */}
                <span className="text-xs font-semibold text-foreground flex-shrink-0 w-20 text-right"
                  style={{ color: i === 0 ? "#B76E79" : undefined }}>
                  {formatCurrency(member.revenue)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
