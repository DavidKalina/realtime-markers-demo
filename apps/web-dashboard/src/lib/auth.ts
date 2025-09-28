// Authentication utilities for secure token management
import type { UserProfile } from "@realtime-markers/database";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type User = UserProfile;

export interface LoginResponse {
  message: string;
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Secure token storage using cookies (accessible by middleware)
class TokenManager {
  private static readonly ACCESS_TOKEN_KEY = "auth_access_token";
  private static readonly REFRESH_TOKEN_KEY = "auth_refresh_token";
  private static readonly USER_KEY = "auth_user";

  // Store tokens in cookies
  static setTokens(tokens: AuthTokens): void {
    if (typeof window !== "undefined") {
      // Set cookies with appropriate options
      const isSecure = window.location.protocol === "https:";
      const secureFlag = isSecure ? "; secure" : "";

      document.cookie = `${this.ACCESS_TOKEN_KEY}=${tokens.accessToken}; path=/; max-age=3600; SameSite=Strict${secureFlag}`;
      document.cookie = `${this.REFRESH_TOKEN_KEY}=${tokens.refreshToken}; path=/; max-age=86400; SameSite=Strict${secureFlag}`;
    }
  }

  static getAccessToken(): string | null {
    if (typeof window !== "undefined") {
      const cookies = document.cookie.split(";");
      const tokenCookie = cookies.find((cookie) =>
        cookie.trim().startsWith(`${this.ACCESS_TOKEN_KEY}=`),
      );
      return tokenCookie ? tokenCookie.split("=")[1] : null;
    }
    return null;
  }

  static getRefreshToken(): string | null {
    if (typeof window !== "undefined") {
      const cookies = document.cookie.split(";");
      const tokenCookie = cookies.find((cookie) =>
        cookie.trim().startsWith(`${this.REFRESH_TOKEN_KEY}=`),
      );
      return tokenCookie ? tokenCookie.split("=")[1] : null;
    }
    return null;
  }

  static clearTokens(): void {
    if (typeof window !== "undefined") {
      // Clear cookies by setting them to expire in the past
      document.cookie = `${this.ACCESS_TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      document.cookie = `${this.REFRESH_TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      sessionStorage.removeItem(this.USER_KEY);
    }
  }

  static setUser(user: User): void {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
  }

  static getUser(): User | null {
    if (typeof window !== "undefined") {
      const userStr = sessionStorage.getItem(this.USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    }
    return null;
  }

  static isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}

// API client for authentication
class AuthAPI {
  private static readonly BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.BASE_URL}${endpoint}`;

    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    // Add auth header if token exists
    const token = TokenManager.getAccessToken();
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.details || errorData.error || `HTTP ${response.status}`,
      );
    }

    return response.json();
  }

  static async login(credentials: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  static async register(userData: RegisterRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  static async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string }> {
    return this.request<{ accessToken: string }>("/api/auth/refresh-token", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  }

  static async logout(): Promise<{ message: string }> {
    return this.request<{ message: string }>("/api/auth/logout", {
      method: "POST",
    });
  }

  static async getCurrentUser(): Promise<User> {
    return this.request<User>("/api/auth/me", {
      method: "POST",
    });
  }
}

// Authentication service that combines token management and API calls
export class AuthService {
  static async login(
    email: string,
    password: string,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const response = await AuthAPI.login({ email, password });

      const tokens: AuthTokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      };

      TokenManager.setTokens(tokens);
      TokenManager.setUser(response.user);

      return {
        user: response.user,
        tokens,
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Login failed");
    }
  }

  static async register(
    email: string,
    password: string,
    displayName: string,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const response = await AuthAPI.register({ email, password, displayName });

      const tokens: AuthTokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      };

      TokenManager.setTokens(tokens);
      TokenManager.setUser(response.user);

      return {
        user: response.user,
        tokens,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Registration failed",
      );
    }
  }

  static async logout(): Promise<void> {
    try {
      await AuthAPI.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      TokenManager.clearTokens();
    }
  }

  static async refreshAccessToken(): Promise<string | null> {
    const refreshToken = TokenManager.getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await AuthAPI.refreshToken(refreshToken);

      const newTokens: AuthTokens = {
        accessToken: response.accessToken,
        refreshToken: refreshToken,
      };

      TokenManager.setTokens(newTokens);
      return response.accessToken;
    } catch (error) {
      console.error("Token refresh failed:", error);
      TokenManager.clearTokens();
      return null;
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      const user = await AuthAPI.getCurrentUser();
      TokenManager.setUser(user);
      return user;
    } catch (error) {
      console.error("Get current user failed:", error);
      return null;
    }
  }

  static isAuthenticated(): boolean {
    return TokenManager.isAuthenticated();
  }

  static getUser(): User | null {
    return TokenManager.getUser();
  }

  static getAccessToken(): string | null {
    return TokenManager.getAccessToken();
  }
}

// Export the main service
export default AuthService;
