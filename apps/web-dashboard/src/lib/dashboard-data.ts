// Real API data for dashboard components
import { api } from "./api";

export interface DashboardMetrics {
  totalActiveEvents: number;
  usersThisMonth: number;
  eventsScannedThisWeek: number;
}

export interface ActivityItem {
  id: string;
  type:
    | "event_scanned"
    | "user_registered"
    | "event_created"
    | "category_added";
  title: string;
  description: string;
  timestamp: string;
  user?: {
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, string | number | boolean>;
}

export interface CategoryStat {
  id: string;
  name: string;
  emoji: string;
  metrics: {
    totalEvents: number;
    verifiedEvents: number;
    eventsThisMonth: number;
    eventsThisWeek: number;
    totalScans: number;
    scansLast30Days: number;
    totalSaves: number;
    totalViews: number;
    avgScanCount: number;
    avgSaveCount: number;
    avgViewCount: number;
  };
  percentages: {
    ofTotalEvents: number;
    ofVerifiedEvents: number;
    ofTotalScans: number;
    ofRecentScans: number;
  };
  engagement: {
    score: number;
    avgPerEvent: number;
    trend: "trending" | "stable";
  };
}

export interface TimeStat {
  day: string;
  time: string;
  count: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  endDate: string;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  address?: string;
  categories: {
    id: string;
    name: string;
    description?: string;
    icon?: string;
  }[];
  attendees: number;
  maxAttendees?: number;
}

export interface CategoryTrends {
  trends: {
    eventCreation: Record<
      string,
      {
        name: string;
        emoji: string;
        weeklyData: Array<{
          week: string;
          eventsCreated: number;
          eventsVerified: number;
        }>;
      }
    >;
    scans: Record<
      string,
      {
        name: string;
        emoji: string;
        weeklyData: Array<{
          week: string;
          scansCount: number;
          uniqueUsers: number;
        }>;
      }
    >;
  };
  growthRates: Array<{
    categoryName: string;
    emoji: string;
    eventCreationGrowth: number;
    scanGrowth: number;
    trend: "growing" | "declining" | "stable";
  }>;
  summary: {
    totalWeeks: number;
    startDate: string;
    endDate: string;
    categoriesTracked: number;
  };
}

// Helper function to get the primary category from an event
export function getPrimaryCategory(event: Event) {
  return event.categories && event.categories.length > 0
    ? event.categories[0]
    : null;
}

// Helper function to get category name with fallback
export function getCategoryName(
  event: Event,
  fallback: string = "No category",
) {
  const primaryCategory = getPrimaryCategory(event);
  return primaryCategory ? primaryCategory.name : fallback;
}

export class DashboardDataService {
  static async getMetrics(): Promise<DashboardMetrics> {
    try {
      const response = await api.get<DashboardMetrics>(
        "/api/admin/dashboard/metrics",
      );
      return response;
    } catch (error) {
      console.error("Failed to fetch dashboard metrics:", error);
      // Return fallback data if API fails
      return {
        totalActiveEvents: 0,
        usersThisMonth: 0,
        eventsScannedThisWeek: 0,
      };
    }
  }

  static async getRecentActivity(): Promise<ActivityItem[]> {
    try {
      const response = await api.get<ActivityItem[]>(
        "/api/admin/dashboard/activity",
      );
      return response;
    } catch (error) {
      console.error("Failed to fetch recent activity:", error);
      // Return fallback data if API fails
      return [];
    }
  }

  static async getPopularCategories(): Promise<CategoryStat[]> {
    try {
      const response = await api.get<{
        categories: CategoryStat[];
        summary: {
          totalCategories: number;
          totalEvents: number;
          totalVerifiedEvents: number;
          totalScans: number;
          totalScansLast30Days: number;
          averageEventsPerCategory: number;
          mostEngagedCategory: CategoryStat;
          fastestGrowingCategory: CategoryStat;
        };
      }>("/api/admin/dashboard/categories");
      return response.categories;
    } catch (error) {
      console.error("Failed to fetch popular categories:", error);
      // Return fallback data if API fails
      return [];
    }
  }

  static async getBusiestTimes(): Promise<TimeStat[]> {
    try {
      const response = await api.get<TimeStat[]>(
        "/api/admin/dashboard/busiest-times",
      );
      return response;
    } catch (error) {
      console.error("Failed to fetch busiest times:", error);
      // Return fallback data if API fails
      return [];
    }
  }

  static async getUpcomingEvents(): Promise<Event[]> {
    try {
      const response = await api.get<Event[]>(
        "/api/admin/dashboard/upcoming-events",
      );
      return response;
    } catch (error) {
      console.error("Failed to fetch upcoming events:", error);
      // Return fallback data if API fails
      return [];
    }
  }

  static async getCategoryTrends(): Promise<CategoryTrends> {
    try {
      const response = await api.get<CategoryTrends>(
        "/api/admin/dashboard/category-trends",
      );
      return response;
    } catch (error) {
      console.error("Failed to fetch category trends:", error);
      // Return fallback data if API fails
      return {
        trends: { eventCreation: {}, scans: {} },
        growthRates: [],
        summary: {
          totalWeeks: 0,
          startDate: "",
          endDate: "",
          categoriesTracked: 0,
        },
      };
    }
  }
}
