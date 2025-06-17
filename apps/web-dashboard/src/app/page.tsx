"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MetricsSection } from "@/components/dashboard/MetricsSection";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";
import { useDashboardData } from "@/hooks/useDashboardData";

export default function Home() {
  const {
    metrics,
    activities,
    popularCategories,
    busiestTimes,
    upcomingEvents,
    loading,
    error,
    refetch,
  } = useDashboardData();

  return (
    <ProtectedRoute>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="min-h-screen bg-background p-8">
          <div className="container mx-auto space-y-8">
            <DashboardHeader />
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
            {/* QuickActions intentionally omitted until endpoint-backed */}
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
