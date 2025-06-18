"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MetricsSection } from "@/components/dashboard/MetricsSection";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { CategoryAnalytics } from "@/components/dashboard/CategoryAnalytics";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";
import { useDashboardData } from "@/hooks/useDashboardData";

export default function DashboardPage() {
  const {
    metrics,
    activities,
    popularCategories,
    busiestTimes,
    upcomingEvents,
    loading,
  } = useDashboardData();

  return (
    <ProtectedRoute>
      <DashboardLayout>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-8">
            {metrics && <MetricsSection metrics={metrics} />}
            {(activities.length > 0 ||
              popularCategories.length > 0 ||
              busiestTimes.length > 0 ||
              upcomingEvents.length > 0) && (
              <DashboardContent
                activities={activities}
                popularCategories={popularCategories}
                busiestTimes={busiestTimes}
                upcomingEvents={upcomingEvents}
              />
            )}
            {popularCategories.length > 0 && (
              <CategoryAnalytics categories={popularCategories} />
            )}
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
