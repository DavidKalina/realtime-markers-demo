import { AuthService } from "@/lib/auth";
import type { ApiResponse } from "@realtime-markers/database";

export interface ItineraryItemPayload {
  title: string;
  startTime: string;
  endTime: string;
  latitude: number;
  longitude: number;
  emoji?: string;
  description?: string;
  venueName?: string;
  venueCategory?: string;
  estimatedCost?: number;
}

export interface CreateItineraryPayload {
  userId: string;
  title: string;
  city: string;
  plannedDate: string;
  durationHours: number;
  activate?: boolean;
  budgetMin?: number;
  budgetMax?: number;
  activityTypes?: string[];
  items: ItineraryItemPayload[];
}

export interface CreateItineraryResponse {
  success: boolean;
  itinerary: {
    id: string;
    title: string;
    city: string;
    status: string;
    items: Array<{
      id: string;
      title: string;
      sortOrder: number;
      latitude: number;
      longitude: number;
    }>;
  };
  activated: boolean;
}

class ItineraryManagementService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  }

  private async getAccessToken(): Promise<string | null> {
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
      const response = await fetch(`${this.baseUrl}/api/admin${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }

  async createItinerary(
    payload: CreateItineraryPayload,
  ): Promise<ApiResponse<CreateItineraryResponse>> {
    return this.makeRequest<CreateItineraryResponse>("/itineraries", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}

export const itineraryManagementService = new ItineraryManagementService();
