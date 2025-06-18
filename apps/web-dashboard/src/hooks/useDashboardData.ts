import { useEffect, useState } from "react";
import {
  DashboardDataService,
  type DashboardMetrics,
  type ActivityItem,
  type CategoryStat,
  type TimeStat,
  type Event,
} from "@/lib/dashboard-data";

// Import the Event type that UpcomingEvents expects
interface DashboardEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  category: {
    name: string;
    emoji: string;
  };
  attendees: number;
  maxAttendees?: number;
}

interface DashboardData {
  metrics: DashboardMetrics | null;
  activities: ActivityItem[];
  popularCategories: CategoryStat[];
  busiestTimes: TimeStat[];
  upcomingEvents: DashboardEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Transform API Event to DashboardEvent
function transformEvent(event: Event): DashboardEvent {
  const primaryCategory =
    event.categories && event.categories.length > 0
      ? event.categories[0]
      : { name: "General", icon: "📅" };

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startDate: event.eventDate,
    endDate: event.endDate,
    location: event.address || "Location TBD",
    category: {
      name: primaryCategory.name,
      emoji: primaryCategory.icon || "📅",
    },
    attendees: event.attendees,
    maxAttendees: event.maxAttendees,
  };
}

export function useDashboardData(): DashboardData {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [popularCategories, setPopularCategories] = useState<CategoryStat[]>(
    [],
  );
  const [busiestTimes, setBusiestTimes] = useState<TimeStat[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<DashboardEvent[]>([]);
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
      setUpcomingEvents(eventsData.map(transformEvent));
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
