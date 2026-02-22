"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";
import { EventsOverview } from "@/components/dashboard/EventsOverview";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { UpcomingEventsChart } from "@/components/dashboard/UpcomingEventsChart";
import { MetricsSummary } from "@/components/dashboard/MetricsSummary";
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

  // Calculate metrics for the summary
  const totalScans = popularCategories.reduce(
    (sum, category) => sum + category.metrics.totalScans,
    0,
  );

  const scanRate = metrics?.totalActiveEvents
    ? Math.round((totalScans / metrics.totalActiveEvents) * 100)
    : 0;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-8">
            {/* Event Metrics Summary */}
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">
                Event Overview
              </h2>
              <MetricsSummary
                totalEvents={metrics?.totalActiveEvents ?? 0}
                totalScans={totalScans}
                totalUsers={metrics?.usersThisMonth ?? 0}
                scanRate={scanRate}
              />
            </div>

            {/* Events Overview Charts */}
            <EventsOverview
              categories={popularCategories}
              busiestTimes={busiestTimes}
            />

            {/* Upcoming Events Chart */}
            {upcomingEvents.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-foreground">
                  Upcoming Events
                </h2>
                <UpcomingEventsChart events={upcomingEvents} />
              </div>
            )}

            {/* Activity Analytics & Feed */}
            {activities.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-foreground">
                  Activity Analytics
                </h2>

                {/* Activity Charts */}
                <ActivityChart activities={activities} />

                {/* Recent Activity Feed */}
                <ActivityFeed activities={activities.slice(0, 8)} />
              </div>
            )}
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
