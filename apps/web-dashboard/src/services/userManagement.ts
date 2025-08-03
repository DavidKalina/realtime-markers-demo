import { AuthService } from "@/lib/auth";
import type { UserProfile, ApiResponse, PaginationParams, PaginatedResponse } from "@realtime-markers/database";

export type User = UserProfile;

export interface UserListParams extends PaginationParams {
  search?: string;
  role?: "USER" | "MODERATOR" | "ADMIN";
}

export interface UserListResponse extends PaginatedResponse<User> {
  users: User[];
}

export interface UserStats {
  totalUsers: number;
  adminUsers: number;
  verifiedUsers: number;
  usersThisMonth: number;
}

export interface UpdateUserRoleParams {
  userId: string;
  role: "USER" | "MODERATOR" | "ADMIN";
}

export interface CreateAdminParams {
  email: string;
  password: string;
  displayName?: string;
  username?: string;
}

class UserManagementService {
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
          error: data.error || `HTTP ${response.status}`,
          status: response.status,
        };
      }

      return {
        data,
        status: response.status,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Network error",
        status: 0,
      };
    }
  }

  async getUsers(
    params: UserListParams = {},
  ): Promise<ApiResponse<UserListResponse>> {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.append("page", params.page.toString());
    if (params.limit) searchParams.append("limit", params.limit.toString());
    if (params.search) searchParams.append("search", params.search);
    if (params.role) searchParams.append("role", params.role);

    const queryString = searchParams.toString();
    const endpoint = `/users${queryString ? `?${queryString}` : ""}`;

    return this.makeRequest<UserListResponse>(endpoint);
  }

  async getUserById(userId: string): Promise<ApiResponse<User>> {
    return this.makeRequest<User>(`/users/${userId}`);
  }

  async updateUserRole(
    params: UpdateUserRoleParams,
  ): Promise<ApiResponse<User>> {
    return this.makeRequest<User>(`/users/${params.userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role: params.role }),
    });
  }

  async getUserStats(): Promise<ApiResponse<UserStats>> {
    return this.makeRequest<UserStats>("/users/stats");
  }

  async getAdminUsers(): Promise<ApiResponse<User[]>> {
    return this.makeRequest<User[]>("/users/admins");
  }

  async createAdminUser(params: CreateAdminParams): Promise<ApiResponse<User>> {
    return this.makeRequest<User>("/users/admins", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async deleteAdminUser(
    adminId: string,
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.makeRequest<{ success: boolean; message: string }>(
      `/users/admins/${adminId}`,
      {
        method: "DELETE",
      },
    );
  }
}

export const userManagementService = new UserManagementService();
