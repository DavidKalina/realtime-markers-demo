"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";
import { CivicEngagementMetrics } from "@/components/dashboard/CivicEngagementMetrics";
import { CivicEngagementTrends } from "@/components/dashboard/CivicEngagementTrends";
import { CivicEngagementActivity } from "@/components/dashboard/CivicEngagementActivity";
import { EventsOverview } from "@/components/dashboard/EventsOverview";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { UpcomingEventsChart } from "@/components/dashboard/UpcomingEventsChart";
import { MetricsSummary } from "@/components/dashboard/MetricsSummary";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useCivicEngagementData } from "@/hooks/useCivicEngagementData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  // Calculate metrics for the summary
  const totalScans = popularCategories.reduce(
    (sum, category) => sum + category.metrics.totalScans,
    0,
  );

  const scanRate = metrics?.totalActiveEvents
    ? Math.round((totalScans / metrics.totalActiveEvents) * 100)
    : 0;

  // Civic engagement metrics cards
  const civicMetricsCards = civicMetrics
    ? [
        {
          title: "Total Engagements",
          value: civicMetrics.totalEngagements.toLocaleString(),
          description: "Civic engagements",
          icon: "🗣️",
        },
        {
          title: "Implementation Rate",
          value: `${civicMetrics.summary.implementationRate}%`,
          description: "Ideas implemented",
          icon: "✅",
        },
        {
          title: "Unique Creators",
          value: civicMetrics.participation.uniqueCreators.toLocaleString(),
          description: "Active community members",
          icon: "✍️",
        },
      ]
    : [];

  return (
    <ProtectedRoute>
      <DashboardLayout>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-8">
            <Tabs defaultValue="events" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="events">Events</TabsTrigger>
                <TabsTrigger value="civic-engagement">
                  Civic Engagement
                </TabsTrigger>
              </TabsList>

              {/* Events Tab */}
              <TabsContent value="events" className="space-y-8">
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
                    userGrowth={12} // Mock data - would come from API
                    scanGrowth={15} // Mock data - would come from API
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
              </TabsContent>

              {/* Civic Engagement Tab */}
              <TabsContent value="civic-engagement" className="space-y-8">
                {/* Civic Engagement Metrics */}
                {civicMetrics && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-semibold text-foreground">
                      Engagement Metrics
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {civicMetricsCards.map((metric, index) => (
                        <div
                          key={index}
                          className="p-6 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium">
                              {metric.title}
                            </h3>
                            <span className="text-2xl">{metric.icon}</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {metric.value}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {metric.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Civic Engagement Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {civicTrends && (
                    <CivicEngagementTrends trends={civicTrends} />
                  )}

                  {civicActivity.length > 0 && (
                    <CivicEngagementActivity activities={civicActivity} />
                  )}
                </div>

                {/* Civic Engagement Details */}
                {civicMetrics && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-semibold text-foreground">
                      Engagement Details
                    </h2>
                    <CivicEngagementMetrics metrics={civicMetrics} />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
