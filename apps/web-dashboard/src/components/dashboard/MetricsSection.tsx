import { MetricCard } from "./MetricCard";
import type { DashboardMetrics } from "@/lib/dashboard-data";

interface MetricsSectionProps {
  metrics: DashboardMetrics | null;
  className?: string;
}

export function MetricsSection({ metrics, className }: MetricsSectionProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>
      <MetricCard
        title="Total Active Events"
        value={metrics?.totalActiveEvents.toLocaleString() || "0"}
        description="Events currently active on the platform"
        trend={{ value: 12, isPositive: true }}
        icon="📅"
      />
      <MetricCard
        title="Users This Month"
        value={metrics?.usersThisMonth.toLocaleString() || "0"}
        description="New user registrations this month"
        trend={{ value: 8, isPositive: true }}
        icon="👥"
      />
      <MetricCard
        title="Events Scanned This Week"
        value={metrics?.eventsScannedThisWeek.toLocaleString() || "0"}
        description="QR code scans in the last 7 days"
        trend={{ value: 15, isPositive: true }}
        icon="📱"
      />
    </div>
  );
}
