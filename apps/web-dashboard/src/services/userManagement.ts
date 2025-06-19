import { AuthService } from "@/lib/auth";

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export interface User {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  role: "USER" | "MODERATOR" | "ADMIN";
  planType: "FREE" | "PRO";
  isVerified: boolean;
  discoveryCount: number;
  scanCount: number;
  saveCount: number;
  viewCount: number;
  totalXp: number;
  currentTitle?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: "USER" | "MODERATOR" | "ADMIN";
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
}

export const userManagementService = new UserManagementService();
