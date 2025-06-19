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

export interface QueryInsights {
  summary: {
    totalQueries: number;
    totalSearches: number;
    averageHitRate: number;
    zeroHitQueries: number;
    lowHitQueries: number;
  };
  popularQueries: Array<{
    query: string;
    totalSearches: number;
    hitRate: number;
    averageResults: number;
  }>;
  lowHitRateQueries: Array<{
    query: string;
    totalSearches: number;
    hitRate: number;
    lastSearched: Date;
  }>;
  trendingQueries: Array<{
    query: string;
    recentSearches: number;
    growthRate: number;
  }>;
  zeroResultQueries: Array<{
    query: string;
    searchCount: number;
    lastSearched: Date;
  }>;
  queryClusters: Array<{
    representativeQuery: string;
    similarQueries: Array<{
      query: string;
      similarity: number;
      totalSearches: number;
      hitRate: number;
    }>;
    totalSearches: number;
    averageHitRate: number;
    totalHits: number;
    needsAttention: boolean;
  }>;
}

export interface QueryStats {
  totalSearches: number;
  totalHits: number;
  hitRate: number;
  averageResults: number;
  firstSearched: Date | null;
  lastSearched: Date | null;
  topResults: string[];
  searchCategories: string[];
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
        trends: {
          eventCreation: {},
          scans: {},
        },
        growthRates: [],
        summary: {
          totalWeeks: 0,
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          categoriesTracked: 0,
        },
      };
    }
  }

  static async getQueryInsights(options?: {
    days?: number;
    limit?: number;
    minSearches?: number;
  }): Promise<QueryInsights> {
    try {
      const params = new URLSearchParams();
      if (options?.days) params.append("days", options.days.toString());
      if (options?.limit) params.append("limit", options.limit.toString());
      if (options?.minSearches)
        params.append("minSearches", options.minSearches.toString());

      const response = await api.get<{
        success: boolean;
        insights: QueryInsights;
      }>(`/api/admin/analytics/queries/insights?${params.toString()}`);
      return response.insights;
    } catch (error) {
      console.error("Failed to fetch query insights:", error);
      // Return fallback data if API fails
      return {
        summary: {
          totalQueries: 0,
          totalSearches: 0,
          averageHitRate: 0,
          zeroHitQueries: 0,
          lowHitQueries: 0,
        },
        popularQueries: [],
        lowHitRateQueries: [],
        trendingQueries: [],
        zeroResultQueries: [],
        queryClusters: [],
      };
    }
  }

  static async getPopularQueries(limit?: number): Promise<
    Array<{
      query: string;
      totalSearches: number;
      hitRate: number;
      averageResults: number;
    }>
  > {
    try {
      const params = new URLSearchParams();
      if (limit) params.append("limit", limit.toString());

      const response = await api.get<{
        success: boolean;
        popularQueries: Array<{
          query: string;
          totalSearches: number;
          hitRate: number;
          averageResults: number;
        }>;
      }>(`/api/admin/analytics/queries/popular?${params.toString()}`);
      return response.popularQueries;
    } catch (error) {
      console.error("Failed to fetch popular queries:", error);
      return [];
    }
  }

  static async getLowHitRateQueries(limit?: number): Promise<
    Array<{
      query: string;
      totalSearches: number;
      hitRate: number;
      lastSearched: Date;
    }>
  > {
    try {
      const params = new URLSearchParams();
      if (limit) params.append("limit", limit.toString());

      const response = await api.get<{
        success: boolean;
        lowHitRateQueries: Array<{
          query: string;
          totalSearches: number;
          hitRate: number;
          lastSearched: string;
        }>;
      }>(`/api/admin/analytics/queries/low-hit-rate?${params.toString()}`);
      return response.lowHitRateQueries.map((q) => ({
        ...q,
        lastSearched: new Date(q.lastSearched),
      }));
    } catch (error) {
      console.error("Failed to fetch low hit rate queries:", error);
      return [];
    }
  }

  static async getZeroResultQueries(limit?: number): Promise<
    Array<{
      query: string;
      searchCount: number;
      lastSearched: Date;
    }>
  > {
    try {
      const params = new URLSearchParams();
      if (limit) params.append("limit", limit.toString());

      const response = await api.get<{
        success: boolean;
        zeroResultQueries: Array<{
          query: string;
          searchCount: number;
          lastSearched: string;
        }>;
      }>(`/api/admin/analytics/queries/zero-results?${params.toString()}`);
      return response.zeroResultQueries.map((q) => ({
        ...q,
        lastSearched: new Date(q.lastSearched),
      }));
    } catch (error) {
      console.error("Failed to fetch zero result queries:", error);
      return [];
    }
  }

  static async getQueryStats(query: string): Promise<QueryStats | null> {
    try {
      const response = await api.get<{ success: boolean; stats: QueryStats }>(
        `/api/admin/analytics/queries/${encodeURIComponent(query)}/stats`,
      );
      return response.stats;
    } catch (error) {
      console.error("Failed to fetch query stats:", error);
      return null;
    }
  }

  static async getQueryClusters(similarityThreshold?: number): Promise<
    Array<{
      representativeQuery: string;
      similarQueries: Array<{
        query: string;
        similarity: number;
        totalSearches: number;
        hitRate: number;
      }>;
      totalSearches: number;
      averageHitRate: number;
      totalHits: number;
      needsAttention: boolean;
    }>
  > {
    try {
      const params = new URLSearchParams();
      if (similarityThreshold)
        params.append("similarityThreshold", similarityThreshold.toString());

      const response = await api.get<{
        success: boolean;
        clusters: Array<{
          representativeQuery: string;
          similarQueries: Array<{
            query: string;
            similarity: number;
            totalSearches: number;
            hitRate: number;
          }>;
          totalSearches: number;
          averageHitRate: number;
          totalHits: number;
          needsAttention: boolean;
        }>;
      }>(`/api/admin/analytics/queries/clusters?${params.toString()}`);
      return response.clusters;
    } catch (error) {
      console.error("Failed to fetch query clusters:", error);
      return [];
    }
  }

  static async findSimilarQueries(
    query: string,
    limit?: number,
    similarityThreshold?: number,
  ): Promise<
    Array<{
      query: string;
      similarity: number;
      totalSearches: number;
      hitRate: number;
    }>
  > {
    try {
      const params = new URLSearchParams();
      if (limit) params.append("limit", limit.toString());
      if (similarityThreshold)
        params.append("similarityThreshold", similarityThreshold.toString());

      const response = await api.get<{
        success: boolean;
        similarQueries: Array<{
          query: string;
          similarity: number;
          totalSearches: number;
          hitRate: number;
        }>;
      }>(
        `/api/admin/analytics/queries/${encodeURIComponent(query)}/similar?${params.toString()}`,
      );
      return response.similarQueries;
    } catch (error) {
      console.error("Failed to find similar queries:", error);
      return [];
    }
  }
}
