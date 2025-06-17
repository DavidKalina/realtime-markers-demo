import { useEffect, useState } from "react";
import {
  DashboardDataService,
  type DashboardMetrics,
  type ActivityItem,
  type CategoryStat,
  type TimeStat,
  type Event,
} from "@/lib/dashboard-data";

interface DashboardData {
  metrics: DashboardMetrics | null;
  activities: ActivityItem[];
  popularCategories: CategoryStat[];
  busiestTimes: TimeStat[];
  upcomingEvents: Event[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDashboardData(): DashboardData {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [popularCategories, setPopularCategories] = useState<CategoryStat[]>(
    [],
  );
  const [busiestTimes, setBusiestTimes] = useState<TimeStat[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

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
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard data",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return {
    metrics,
    activities,
    popularCategories,
    busiestTimes,
    upcomingEvents,
    loading,
    error,
    refetch: loadDashboardData,
  };
}
