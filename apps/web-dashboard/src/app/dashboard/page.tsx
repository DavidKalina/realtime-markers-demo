"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { PopularCategories } from "@/components/dashboard/PopularCategories";
import { BusiestTimes } from "@/components/dashboard/BusiestTimes";
import { UpcomingEvents } from "@/components/dashboard/UpcomingEvents";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";
import { CivicEngagementMetrics } from "@/components/dashboard/CivicEngagementMetrics";
import { CivicEngagementTrends } from "@/components/dashboard/CivicEngagementTrends";
import { CivicEngagementActivity } from "@/components/dashboard/CivicEngagementActivity";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useCivicEngagementData } from "@/hooks/useCivicEngagementData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryAnalytics } from "@/components/dashboard/CategoryAnalytics";
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

  // Event metrics cards
  const eventMetricsCards = [
    {
      title: "Total Active Events",
      value: (metrics?.totalActiveEvents ?? 0).toLocaleString(),
      description: "Events currently active",
      icon: "📅",
    },
    {
      title: "Users This Month",
      value: (metrics?.usersThisMonth ?? 0).toLocaleString(),
      description: "New user registrations",
      icon: "👥",
    },
    {
      title: "Events Scanned This Week",
      value: (metrics?.eventsScannedThisWeek ?? 0).toLocaleString(),
      description: "QR code scans",
      icon: "📱",
    },
  ];

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
                {/* Event Metrics */}
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-foreground">
                    Event Metrics
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {eventMetricsCards.map((metric, index) => (
                      <MetricCard
                        key={index}
                        title={metric.title}
                        value={metric.value}
                        description={metric.description}
                        icon={metric.icon}
                      />
                    ))}
                  </div>
                </div>

                {/* Event Analytics Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    {activities.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Recent Activity</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ActivityFeed activities={activities} />
                        </CardContent>
                      </Card>
                    )}

                    {upcomingEvents.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Upcoming Events</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <UpcomingEvents events={upcomingEvents} />
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div className="space-y-6">
                    {popularCategories.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Category Analytics</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <CategoryAnalytics categories={popularCategories} />
                        </CardContent>
                      </Card>
                    )}

                    {busiestTimes.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Busiest Times</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <BusiestTimes busiestTimes={busiestTimes} />
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>

                {/* Additional Event Insights */}
                {popularCategories.length > 0 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-semibold text-foreground">
                      Event Insights
                    </h2>
                    <Card>
                      <CardHeader>
                        <CardTitle>Popular Categories</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <PopularCategories categories={popularCategories} />
                      </CardContent>
                    </Card>
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
                        <MetricCard
                          key={index}
                          title={metric.title}
                          value={metric.value}
                          description={metric.description}
                          icon={metric.icon}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Civic Engagement Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {civicTrends && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Engagement Trends</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CivicEngagementTrends trends={civicTrends} />
                      </CardContent>
                    </Card>
                  )}

                  {civicActivity.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Recent Engagements</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CivicEngagementActivity activities={civicActivity} />
                      </CardContent>
                    </Card>
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
