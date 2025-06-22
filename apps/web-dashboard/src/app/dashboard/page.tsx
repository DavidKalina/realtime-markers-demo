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

              <TabsContent value="overview" className="pt-6">
                <div className="flex flex-wrap gap-6">
                  {/* Event Metrics */}
                  <MetricCard
                    title="Total Active Events"
                    value={(metrics?.totalActiveEvents ?? 0).toLocaleString()}
                    description="Events currently active"
                    icon="📅"
                  />
                  <MetricCard
                    title="Users This Month"
                    value={(metrics?.usersThisMonth ?? 0).toLocaleString()}
                    description="New user registrations"
                    icon="👥"
                  />
                  <MetricCard
                    title="Events Scanned This Week"
                    value={(
                      metrics?.eventsScannedThisWeek ?? 0
                    ).toLocaleString()}
                    description="QR code scans"
                    icon="📱"
                  />

                  {/* Civic Engagement Metrics */}
                  {civicMetrics && (
                    <>
                      <MetricCard
                        title="Total Engagements"
                        value={civicMetrics.totalEngagements.toLocaleString()}
                        description="Civic engagements"
                        icon="🗣️"
                      />
                      <MetricCard
                        title="Implementation Rate"
                        value={`${civicMetrics.summary.implementationRate}%`}
                        description="Ideas implemented"
                        icon="✅"
                      />
                      <MetricCard
                        title="Unique Creators"
                        value={civicMetrics.participation.uniqueCreators.toLocaleString()}
                        description="Active community members"
                        icon="✍️"
                      />
                    </>
                  )}

                  {/* Event Details */}
                  {activities.length > 0 && (
                    <ActivityFeed activities={activities} />
                  )}
                  {popularCategories.length > 0 && (
                    <PopularCategories categories={popularCategories} />
                  )}
                  {busiestTimes.length > 0 && (
                    <BusiestTimes busiestTimes={busiestTimes} />
                  )}
                  {upcomingEvents.length > 0 && (
                    <UpcomingEvents events={upcomingEvents} />
                  )}

                  {/* Civic Engagement Details */}
                  {civicTrends && (
                    <CivicEngagementTrends trends={civicTrends} />
                  )}
                  {civicActivity.length > 0 && (
                    <CivicEngagementActivity activities={civicActivity} />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="events" className="space-y-6">
                <div className="flex flex-wrap gap-6">
                  <MetricCard
                    title="Total Active Events"
                    value={(metrics?.totalActiveEvents ?? 0).toLocaleString()}
                    description="Events currently active"
                    icon="📅"
                  />
                  <MetricCard
                    title="Users This Month"
                    value={(metrics?.usersThisMonth ?? 0).toLocaleString()}
                    description="New user registrations"
                    icon="👥"
                  />
                  <MetricCard
                    title="Events Scanned This Week"
                    value={(
                      metrics?.eventsScannedThisWeek ?? 0
                    ).toLocaleString()}
                    description="QR code scans"
                    icon="📱"
                  />
                  {activities.length > 0 && (
                    <ActivityFeed activities={activities} />
                  )}
                  {popularCategories.length > 0 && (
                    <PopularCategories categories={popularCategories} />
                  )}
                  {busiestTimes.length > 0 && (
                    <BusiestTimes busiestTimes={busiestTimes} />
                  )}
                  {upcomingEvents.length > 0 && (
                    <UpcomingEvents events={upcomingEvents} />
                  )}
                  {popularCategories.length > 0 && (
                    <CategoryAnalytics categories={popularCategories} />
                  )}
                </div>
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
