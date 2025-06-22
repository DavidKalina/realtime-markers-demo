"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MetricsSection } from "@/components/dashboard/MetricsSection";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { CategoryAnalytics } from "@/components/dashboard/CategoryAnalytics";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";
import { CivicEngagementMetrics } from "@/components/dashboard/CivicEngagementMetrics";
import { CivicEngagementTrends } from "@/components/dashboard/CivicEngagementTrends";
import { CivicEngagementActivity } from "@/components/dashboard/CivicEngagementActivity";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useCivicEngagementData } from "@/hooks/useCivicEngagementData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DashboardPage() {
  const {
    metrics,
    activities,
    popularCategories,
    busiestTimes,
    upcomingEvents,
    loading: dashboardLoading,
  } = useDashboardData();

  const {
    metrics: civicMetrics,
    trends: civicTrends,
    activity: civicActivity,
    loading: civicLoading,
  } = useCivicEngagementData();

  const loading = dashboardLoading || civicLoading;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-8">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
                <TabsTrigger value="civic-engagement">
                  Civic Engagement
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* Combined Metrics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {metrics && (
                    <div>
                      <h2 className="text-2xl font-bold mb-4">Event Metrics</h2>
                      <MetricsSection metrics={metrics} />
                    </div>
                  )}
                  {civicMetrics && (
                    <div>
                      <h2 className="text-2xl font-bold mb-4">
                        Civic Engagement Metrics
                      </h2>
                      <CivicEngagementMetrics metrics={civicMetrics} />
                    </div>
                  )}
                </div>

                {/* Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {activities.length > 0 && (
                    <div>
                      <h2 className="text-2xl font-bold mb-4">
                        Event Activity
                      </h2>
                      <DashboardContent
                        activities={activities}
                        popularCategories={popularCategories}
                        busiestTimes={busiestTimes}
                        upcomingEvents={upcomingEvents}
                      />
                    </div>
                  )}
                  {civicActivity.length > 0 && (
                    <div>
                      <h2 className="text-2xl font-bold mb-4">
                        Civic Engagement Activity
                      </h2>
                      <CivicEngagementActivity activities={civicActivity} />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="events" className="space-y-6">
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
              </TabsContent>

              <TabsContent value="civic-engagement" className="space-y-6">
                {civicMetrics && (
                  <CivicEngagementMetrics metrics={civicMetrics} />
                )}
                {civicTrends && <CivicEngagementTrends trends={civicTrends} />}
                {civicActivity.length > 0 && (
                  <CivicEngagementActivity activities={civicActivity} />
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
