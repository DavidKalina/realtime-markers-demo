"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { UpcomingEvents } from "@/components/dashboard/UpcomingEvents";
import {
  DashboardDataService,
  type DashboardMetrics,
  type ActivityItem,
  type CategoryStat,
  type TimeStat,
  type Event,
} from "@/lib/dashboard-data";

function DashboardContent() {
  const { user, logout } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [popularCategories, setPopularCategories] = useState<CategoryStat[]>(
    [],
  );
  const [busiestTimes, setBusiestTimes] = useState<TimeStat[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const [
          metricsData,
          activitiesData,
          categoriesData,
          timesData,
          eventsData,
        ] = await Promise.all([
          DashboardDataService.getMetrics(),
          DashboardDataService.getRecentActivity(),
          DashboardDataService.getPopularCategories(),
          DashboardDataService.getBusiestTimes(),
          DashboardDataService.getUpcomingEvents(),
        ]);

        setMetrics(metricsData);
        setActivities(activitiesData);
        setPopularCategories(categoriesData);
        setBusiestTimes(timesData);
        setUpcomingEvents(eventsData);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="container mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.displayName || user?.email}!
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Activity Feed */}
          <div className="lg:col-span-1">
            <ActivityFeed activities={activities} />
          </div>

          {/* Right Column - Quick Stats and Upcoming Events */}
          <div className="lg:col-span-2 space-y-8">
            <QuickStats
              popularCategories={popularCategories}
              busiestTimes={busiestTimes}
            />
            <UpcomingEvents events={upcomingEvents} />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-12">
              📊 View Analytics
            </Button>
            <Button variant="outline" className="h-12">
              👥 Manage Users
            </Button>
            <Button variant="outline" className="h-12">
              🎉 Create Event
            </Button>
            <Button variant="outline" className="h-12">
              ⚙️ Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
