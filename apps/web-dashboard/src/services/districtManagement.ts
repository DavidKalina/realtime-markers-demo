import { AuthService } from "@/lib/auth";

export interface AdminDistrict {
  id: string;
  name: string;
  description: string | null;
  itineraryCount: number;
  avgRating: number | null;
  totalAdoptions: number;
  activityTags: string[];
  status: string;
  centroidLat: number;
  centroidLng: number;
  geohash: string;
  lastClusteredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDistrictItinerary {
  id: string;
  title: string | null;
  intention: string | null;
  activityTypes: string[];
  durationHours: number;
  rating: number | null;
  timesAdopted: number;
  createdAt: string;
  creatorEmail: string;
}

export interface ClusteringConfig {
  epsilon: number;
  minPoints: number;
  centroidMatchThreshold: number;
  seedPerCity: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class DistrictManagementService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const token = AuthService.getAccessToken();

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

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }

  async listDistricts(
    sort?: string,
    order?: string,
  ): Promise<ApiResponse<{ districts: AdminDistrict[]; total: number }>> {
    const params = new URLSearchParams();
    if (sort) params.set("sort", sort);
    if (order) params.set("order", order);
    const qs = params.toString();
    return this.makeRequest(`/districts${qs ? `?${qs}` : ""}`);
  }

  async getDistrictDetail(id: string): Promise<
    ApiResponse<{
      district: AdminDistrict;
      itineraries: AdminDistrictItinerary[];
    }>
  > {
    return this.makeRequest(`/districts/${id}`);
  }

  async renameDistrict(
    id: string,
  ): Promise<ApiResponse<{ name: string; description: string }>> {
    return this.makeRequest(`/districts/${id}/rename`, { method: "POST" });
  }

  async deleteDistrict(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.makeRequest(`/districts/${id}`, { method: "DELETE" });
  }

  async reclusterRegion(
    id: string,
  ): Promise<ApiResponse<{ success: boolean; geohash: string }>> {
    return this.makeRequest(`/districts/${id}/recluster`, { method: "POST" });
  }

  async reclusterAll(): Promise<
    ApiResponse<{
      success: boolean;
      regionsProcessed: number;
      totalRegions: number;
    }>
  > {
    return this.makeRequest("/districts/recluster-all", { method: "POST" });
  }

  async getConfig(): Promise<ApiResponse<ClusteringConfig>> {
    return this.makeRequest("/districts/config");
  }
}

export const districtManagementService = new DistrictManagementService();
