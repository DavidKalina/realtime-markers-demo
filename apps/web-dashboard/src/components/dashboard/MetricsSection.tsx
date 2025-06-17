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
        value={(metrics?.totalActiveEvents ?? 0).toLocaleString()}
        description="Events currently active on the platform"
        trend={{ value: 12, isPositive: true }}
        icon="📅"
      />
      <MetricCard
        title="Users This Month"
        value={(metrics?.usersThisMonth ?? 0).toLocaleString()}
        description="New user registrations this month"
        trend={{ value: 8, isPositive: true }}
        icon="👥"
      />
      <MetricCard
        title="Events Scanned This Week"
        value={(metrics?.eventsScannedThisWeek ?? 0).toLocaleString()}
        description="QR code scans in the last 7 days"
        trend={{ value: 15, isPositive: true }}
        icon="📱"
      />
    </div>
  );
}
