// API service for web dashboard
// This handles authentication and API calls to the backend

import { AuthService } from "@/lib/auth";
import type {
  CivicEngagementSummary,
  CivicEngagementType,
  ApiResponse as DatabaseApiResponse,
  DayOfWeek,
  EventSummary,
  RecurrenceFrequency,
} from "@realtime-markers/database";

// Extend the database ApiResponse to include status property
interface ApiResponse<T> extends DatabaseApiResponse<T> {
  status: number;
}

// Civic Engagement interfaces - using derived types
type CivicEngagement = CivicEngagementSummary;

interface CreateCivicEngagementPayload {
  title: string;
  description?: string;
  type: CivicEngagementType;
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  address?: string;
  locationNotes?: string;
  imageBuffer?: string; // base64 encoded image
  contentType?: string;
  filename?: string;
}

interface CivicEngagementStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

interface CreateEventPayload {
  title: string;
  description?: string;
  date: string;
  eventDate: string;
  endDate?: string;
  isPrivate: boolean;
  emoji?: string;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  address?: string;
  locationNotes?: string;

  userCoordinates?: {
    lat: number;
    lng: number;
  };
  image?: File;
  // QR code related fields
  qrUrl?: string;
  // Recurring event fields
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceDays?: DayOfWeek[];
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceInterval?: number;
  recurrenceTime?: string;
}

// Use derived Event type
type Event = EventSummary;

interface EventEngagement {
  eventId: string;
  saveCount: number;
  scanCount: number;
  viewCount: number;
  rsvpCount: number;
  goingCount: number;
  notGoingCount: number;
  totalEngagement: number;
  lastUpdated: string;
}

interface JobStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  progressStep: string;
  result?: any;
  error?: string;
}

// Place search interfaces
interface PlaceSearchParams {
  query: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

interface PlaceSearchResult {
  success: boolean;
  error?: string;
  place?: {
    name: string;
    address: string;
    coordinates: [number, number];
    placeId: string;
    types: string[];
    rating?: number;
    userRatingsTotal?: number;
    distance?: number;
    locationNotes?: string;
  };
}

interface CityStateSearchParams {
  query: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

interface CityStateSearchResult {
  success: boolean;
  error?: string;
  cityState?: {
    city: string;
    state: string;
    coordinates: [number, number];
    formattedAddress: string;
    placeId: string;
    distance?: number;
  };
}

// Civic Engagement Dashboard Interfaces
interface CivicEngagementMetrics {
  totalEngagements: number;
  engagementsByType: Record<string, number>;
  engagementsByStatus: Record<string, number>;
  recentActivity: {
    thisMonth: number;
    thisWeek: number;
    implementedThisMonth: number;
  };
  participation: {
    uniqueCreators: number;
    withLocation: number;
    withImages: number;
  };
  summary: {
    avgEngagementsPerMonth: number;
    implementationRate: number;
    locationCoverage: number;
    mediaCoverage: number;
  };
}

interface CivicEngagementTrends {
  trends: {
    byType: Record<
      string,
      {
        type: string;
        weeklyData: Array<{
          week: string;
          engagementsCreated: number;
          engagementsImplemented: number;
        }>;
      }
    >;
    byStatus: Record<
      string,
      {
        status: string;
        weeklyData: Array<{
          week: string;
          engagementsCount: number;
        }>;
      }
    >;
  };
  growthRates: Array<{
    type: string;
    engagementCreationGrowth: number;
    trend: "growing" | "declining" | "stable";
  }>;
  summary: {
    totalWeeks: number;
    startDate: string;
    endDate: string;
    typesTracked: number;
    statusesTracked: number;
  };
}

interface CivicEngagementStatusAnalysis {
  statusBreakdown: Array<{
    status: string;
    type: string;
    count: number;
    avgDaysToUpdate: number;
    withLocation: number;
    withImages: number;
    withAdminNotes: number;
  }>;
  implementationMetrics: Array<{
    type: string;
    avgDaysToImplement: number;
    minDaysToImplement: number;
    maxDaysToImplement: number;
    totalImplemented: number;
  }>;
  statusTransitions: Array<{
    status: string;
    type: string;
    count: number;
    avgAgeDays: number;
  }>;
  summary: {
    totalStatuses: number;
    totalImplemented: number;
    avgImplementationTime: number;
  };
}

interface CivicEngagementGeographic {
  geographicData: Array<{
    type: string;
    status: string;
    address: string;
    coordinates: {
      longitude: number;
      latitude: number;
    };
    locationNotes: string;
    createdAt: string;
  }>;
  locationDensity: Array<{
    address: string;
    totalEngagements: number;
    implementedCount: number;
    byType: {
      positive: number;
      negative: number;
      ideas: number;
    };
    implementationRate: number;
  }>;
  recentActivity: Array<{
    address: string;
    recentCount: number;
    type: string;
    status: string;
  }>;
  summary: {
    totalWithLocation: number;
    topLocation: string | null;
    mostActiveLocation: string | null;
    recentActivityCount: number;
  };
}

interface CivicEngagementActivity {
  id: string;
  type: "engagement_created" | "engagement_updated" | "engagement_implemented";
  title: string;
  description: string;
  timestamp: string;
  user?: {
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, string | number | boolean>;
}

// Dashboard Interfaces
interface DashboardMetrics {
  totalActiveEvents: number;
  usersThisMonth: number;
  eventsScannedThisWeek: number;
}

interface DashboardActivity {
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

interface DashboardCategory {
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

interface DashboardCategories {
  categories: DashboardCategory[];
  summary: {
    totalCategories: number;
    totalEvents: number;
    totalVerifiedEvents: number;
    totalScans: number;
    totalScansLast30Days: number;
    averageEventsPerCategory: number;
    mostEngagedCategory: DashboardCategory | null;
    fastestGrowingCategory: DashboardCategory | null;
  };
}

interface DashboardCategoryTrends {
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

interface DashboardBusiestTime {
  day: string;
  time: string;
  count: number;
}

interface DashboardUpcomingEvent {
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

class ApiService {
  private baseUrl: string;

  constructor() {
    // In development, this would point to your local backend
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  }

  private async getAccessToken(): Promise<string | null> {
    // Get the access token from AuthService
    return AuthService.getAccessToken();
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const token = await this.getAccessToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
          status: response.status,
        };
      }

      return {
        success: true,
        data,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
        status: 0,
      };
    }
  }

  // Event-related API calls
  async createEvent(payload: CreateEventPayload): Promise<ApiResponse<Event>> {
    // If image is provided, use FormData
    if (payload.image) {
      const formData = new FormData();

      // Add the image file
      formData.append("image", payload.image);

      // Add other event data as individual fields
      formData.append("title", payload.title);
      if (payload.description)
        formData.append("description", payload.description);
      formData.append("eventDate", payload.eventDate);
      if (payload.endDate) formData.append("endDate", payload.endDate);
      if (payload.emoji) formData.append("emoji", payload.emoji);
      if (payload.address) formData.append("address", payload.address);
      if (payload.locationNotes)
        formData.append("locationNotes", payload.locationNotes);
      formData.append("isPrivate", payload.isPrivate.toString());
      formData.append("lat", payload.location.coordinates[0].toString());
      formData.append("lng", payload.location.coordinates[1].toString());

      // Add QR code related fields
      if (payload.qrUrl) {
        formData.append("qrUrl", payload.qrUrl);
      }

      // Add recurring event fields
      if (payload.isRecurring !== undefined) {
        formData.append("isRecurring", payload.isRecurring.toString());
      }
      if (payload.recurrenceFrequency) {
        formData.append("recurrenceFrequency", payload.recurrenceFrequency);
      }
      if (payload.recurrenceDays && payload.recurrenceDays.length > 0) {
        formData.append(
          "recurrenceDays",
          JSON.stringify(payload.recurrenceDays),
        );
      }
      if (payload.recurrenceStartDate) {
        formData.append("recurrenceStartDate", payload.recurrenceStartDate);
      }
      if (payload.recurrenceEndDate) {
        formData.append("recurrenceEndDate", payload.recurrenceEndDate);
      }
      if (payload.recurrenceInterval) {
        formData.append(
          "recurrenceInterval",
          payload.recurrenceInterval.toString(),
        );
      }
      if (payload.recurrenceTime) {
        formData.append("recurrenceTime", payload.recurrenceTime);
      }

      if (payload.userCoordinates) {
        formData.append("userLat", payload.userCoordinates.lat.toString());
        formData.append("userLng", payload.userCoordinates.lng.toString());
      }

      const token = await this.getAccessToken();
      const headers: Record<string, string> = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      try {
        const response = await fetch(`${this.baseUrl}/api/events`, {
          method: "POST",
          headers,
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            success: false,
            error: data.error || `HTTP ${response.status}`,
            status: response.status,
          };
        }

        return {
          success: true,
          data,
          status: response.status,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Network error",
          status: 0,
        };
      }
    } else {
      // No image, use JSON
      return this.makeRequest<Event>("/api/events", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
  }

  async createPrivateEvent(payload: CreateEventPayload): Promise<
    ApiResponse<{
      status: string;
      jobId: string;
      message: string;
      _links: {
        self: string;
        status: string;
        stream: string;
      };
    }>
  > {
    // If image is provided, use FormData
    if (payload.image) {
      const formData = new FormData();

      // Add the image file
      formData.append("image", payload.image);

      // Add other event data as individual fields
      formData.append("title", payload.title);
      if (payload.description)
        formData.append("description", payload.description);
      formData.append("eventDate", payload.eventDate);
      if (payload.endDate) formData.append("endDate", payload.endDate);
      if (payload.emoji) formData.append("emoji", payload.emoji);
      if (payload.address) formData.append("address", payload.address);
      if (payload.locationNotes)
        formData.append("locationNotes", payload.locationNotes);
      formData.append("isPrivate", payload.isPrivate.toString());
      formData.append("lat", payload.location.coordinates[0].toString());
      formData.append("lng", payload.location.coordinates[1].toString());

      // Add QR code related fields
      if (payload.qrUrl) {
        formData.append("qrUrl", payload.qrUrl);
      }

      // Add recurring event fields
      if (payload.isRecurring !== undefined) {
        formData.append("isRecurring", payload.isRecurring.toString());
      }
      if (payload.recurrenceFrequency) {
        formData.append("recurrenceFrequency", payload.recurrenceFrequency);
      }
      if (payload.recurrenceDays && payload.recurrenceDays.length > 0) {
        formData.append(
          "recurrenceDays",
          JSON.stringify(payload.recurrenceDays),
        );
      }
      if (payload.recurrenceStartDate) {
        formData.append("recurrenceStartDate", payload.recurrenceStartDate);
      }
      if (payload.recurrenceEndDate) {
        formData.append("recurrenceEndDate", payload.recurrenceEndDate);
      }
      if (payload.recurrenceInterval) {
        formData.append(
          "recurrenceInterval",
          payload.recurrenceInterval.toString(),
        );
      }
      if (payload.recurrenceTime) {
        formData.append("recurrenceTime", payload.recurrenceTime);
      }

      if (payload.userCoordinates) {
        formData.append("userLat", payload.userCoordinates.lat.toString());
        formData.append("userLng", payload.userCoordinates.lng.toString());
      }

      const token = await this.getAccessToken();
      const headers: Record<string, string> = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      try {
        const response = await fetch(`${this.baseUrl}/api/events/private`, {
          method: "POST",
          headers,
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            success: false,
            error: data.error || `HTTP ${response.status}`,
            status: response.status,
          };
        }

        return {
          success: true,
          data,
          status: response.status,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Network error",
          status: 0,
        };
      }
    } else {
      // No image, use JSON
      return this.makeRequest("/api/events/private", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
  }

  async getEvents(
    params: {
      limit?: number;
      offset?: number;
      cursor?: string;
    } = {},
  ): Promise<
    ApiResponse<{
      events: Event[];
      total: number;
      hasMore: boolean;
    }>
  > {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.offset) queryParams.append("offset", params.offset.toString());
    if (params.cursor) queryParams.append("cursor", params.cursor);

    const queryString = queryParams.toString();
    const endpoint = `/api/events${queryString ? `?${queryString}` : ""}`;

    return this.makeRequest(endpoint);
  }

  async getEventById(id: string): Promise<ApiResponse<Event>> {
    return this.makeRequest<Event>(`/api/events/${id}`);
  }

  async getEventEngagement(id: string): Promise<ApiResponse<EventEngagement>> {
    return this.makeRequest<EventEngagement>(`/api/events/${id}/engagement`);
  }

  async updateEvent(
    id: string,
    payload: Partial<CreateEventPayload>,
  ): Promise<ApiResponse<Event>> {
    return this.makeRequest<Event>(`/api/events/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteEvent(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>(`/api/events/${id}`, {
      method: "DELETE",
    });
  }

  // Job-related API calls
  async getJobStatus(jobId: string): Promise<ApiResponse<JobStatus>> {
    return this.makeRequest<JobStatus>(`/api/jobs/${jobId}`);
  }

  // Friends-related API calls (for private events)
  async getFriends(): Promise<
    ApiResponse<
      Array<{
        id: string;
        name: string;
        email: string;
      }>
    >
  > {
    return this.makeRequest("/api/friends");
  }

  // Place search API calls
  async searchPlace(
    params: PlaceSearchParams,
  ): Promise<ApiResponse<PlaceSearchResult>> {
    return this.makeRequest<PlaceSearchResult>("/api/places/search", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async searchCityState(
    params: CityStateSearchParams,
  ): Promise<ApiResponse<CityStateSearchResult>> {
    return this.makeRequest<CityStateSearchResult>(
      "/api/places/search-city-state",
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    );
  }

  // Civic Engagement API calls
  async createCivicEngagement(
    payload: CreateCivicEngagementPayload,
  ): Promise<ApiResponse<{ jobId: string; message: string; status: string }>> {
    return this.makeRequest<{ jobId: string; message: string; status: string }>(
      "/api/civic-engagements",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  }

  async getCivicEngagements(
    params: {
      limit?: number;
      offset?: number;
      type?: string[];
      status?: string[];
      search?: string;
    } = {},
  ): Promise<
    ApiResponse<{ civicEngagements: CivicEngagement[]; total: number }>
  > {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.offset) queryParams.append("offset", params.offset.toString());
    if (params.type) queryParams.append("type", params.type.join(","));
    if (params.status) queryParams.append("status", params.status.join(","));
    if (params.search) queryParams.append("search", params.search);

    const queryString = queryParams.toString();
    const endpoint = `/api/civic-engagements${queryString ? `?${queryString}` : ""}`;

    return this.makeRequest<{
      civicEngagements: CivicEngagement[];
      total: number;
    }>(endpoint);
  }

  async getCivicEngagementById(
    id: string,
  ): Promise<ApiResponse<CivicEngagement>> {
    return this.makeRequest<CivicEngagement>(`/api/civic-engagements/${id}`);
  }

  async getCivicEngagementStats(): Promise<ApiResponse<CivicEngagementStats>> {
    return this.makeRequest<CivicEngagementStats>(
      "/api/civic-engagements/stats",
    );
  }

  async getNearbyCivicEngagements(
    lat: number,
    lng: number,
    radius?: number,
    filters?: {
      type?: string[];
      status?: string[];
      search?: string;
    },
  ): Promise<ApiResponse<CivicEngagement[]>> {
    const queryParams = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
    });

    if (radius) queryParams.append("radius", radius.toString());
    if (filters?.type) queryParams.append("type", filters.type.join(","));
    if (filters?.status) queryParams.append("status", filters.status.join(","));
    if (filters?.search) queryParams.append("search", filters.search);

    const endpoint = `/api/civic-engagements/nearby?${queryParams.toString()}`;
    return this.makeRequest<CivicEngagement[]>(endpoint);
  }

  // Dashboard API calls
  async getDashboardMetrics(): Promise<ApiResponse<DashboardMetrics>> {
    return this.makeRequest<DashboardMetrics>("/api/admin/dashboard/metrics");
  }

  async getDashboardActivity(): Promise<ApiResponse<DashboardActivity[]>> {
    return this.makeRequest<DashboardActivity[]>(
      "/api/admin/dashboard/activity",
    );
  }

  async getDashboardCategories(): Promise<ApiResponse<DashboardCategories>> {
    return this.makeRequest<DashboardCategories>(
      "/api/admin/dashboard/categories",
    );
  }

  async getDashboardCategoryTrends(): Promise<
    ApiResponse<DashboardCategoryTrends>
  > {
    return this.makeRequest<DashboardCategoryTrends>(
      "/api/admin/dashboard/category-trends",
    );
  }

  async getDashboardBusiestTimes(): Promise<
    ApiResponse<DashboardBusiestTime[]>
  > {
    return this.makeRequest<DashboardBusiestTime[]>(
      "/api/admin/dashboard/busiest-times",
    );
  }

  async getDashboardUpcomingEvents(): Promise<
    ApiResponse<DashboardUpcomingEvent[]>
  > {
    return this.makeRequest<DashboardUpcomingEvent[]>(
      "/api/admin/dashboard/upcoming-events",
    );
  }

  // Civic Engagement Dashboard API calls
  async getCivicEngagementMetrics(): Promise<
    ApiResponse<CivicEngagementMetrics>
  > {
    return this.makeRequest<CivicEngagementMetrics>(
      "/api/admin/dashboard/civic-engagement/metrics",
    );
  }

  async getCivicEngagementTrends(): Promise<
    ApiResponse<CivicEngagementTrends>
  > {
    return this.makeRequest<CivicEngagementTrends>(
      "/api/admin/dashboard/civic-engagement/trends",
    );
  }

  async getCivicEngagementStatusAnalysis(): Promise<
    ApiResponse<CivicEngagementStatusAnalysis>
  > {
    return this.makeRequest<CivicEngagementStatusAnalysis>(
      "/api/admin/dashboard/civic-engagement/status-analysis",
    );
  }

  async getCivicEngagementGeographic(): Promise<
    ApiResponse<CivicEngagementGeographic>
  > {
    return this.makeRequest<CivicEngagementGeographic>(
      "/api/admin/dashboard/civic-engagement/geographic",
    );
  }

  async getCivicEngagementActivity(): Promise<
    ApiResponse<CivicEngagementActivity[]>
  > {
    return this.makeRequest<CivicEngagementActivity[]>(
      "/api/admin/dashboard/civic-engagement/activity",
    );
  }
}

// Export a singleton instance
export const apiService = new ApiService();
export type {
  CityStateSearchParams,
  CityStateSearchResult,
  CivicEngagement,
  CivicEngagementActivity,
  CivicEngagementGeographic,
  CivicEngagementMetrics,
  CivicEngagementStats,
  CivicEngagementStatusAnalysis,
  CivicEngagementTrends,
  CreateCivicEngagementPayload,
  CreateEventPayload,
  DashboardActivity,
  DashboardBusiestTime,
  DashboardCategories,
  DashboardCategory,
  DashboardCategoryTrends,
  DashboardMetrics,
  DashboardUpcomingEvent,
  Event,
  EventEngagement,
  JobStatus,
  PlaceSearchParams,
  PlaceSearchResult,
};
