// src/services/ApiClient.ts

import { EventType } from "@/types/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Define base API types from your backend
interface Location {
  type: string;
  coordinates: [number, number]; // [longitude, latitude]
}

// Add user and auth types
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  avatarUrl?: string;
  isVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string; // Make refreshToken optional
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
  accessToken: string;
  refreshToken?: string;
}

interface ApiEvent {
  id: string;
  title: string;
  description?: string;
  eventDate: string;
  location: Location;
  address?: string;
  categories?: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
  emoji?: string;
}

// Search response from your API
interface SearchResponse {
  results: ApiEvent[];
  nextCursor?: string;
}

// Options for fetching events
interface EventOptions {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

class ApiClient {
  public baseUrl: string;
  private user: User | null = null;
  private tokens: AuthTokens | null = null;
  private authListeners: ((isAuthenticated: boolean) => void)[] = [];

  constructor(baseUrl: string = process.env.EXPO_PUBLIC_API_URL!) {
    this.baseUrl = baseUrl;
    this.loadAuthState();
  }

  // Load auth state from storage
  private async loadAuthState(): Promise<void> {
    try {
      const [userJson, accessToken, refreshToken] = await Promise.all([
        AsyncStorage.getItem("user"),
        AsyncStorage.getItem("accessToken"),
        AsyncStorage.getItem("refreshToken"),
      ]);

      if (userJson) this.user = JSON.parse(userJson);
      if (accessToken && refreshToken) this.tokens = { accessToken, refreshToken };

      // Notify listeners if we have valid auth
      this.notifyAuthListeners(this.isAuthenticated());
    } catch (error) {
      console.error("Error loading auth state:", error);
    }
  }

  // Save auth state to storage
  private async saveAuthState(user: User, tokens: AuthTokens): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem("user", JSON.stringify(user)),
        AsyncStorage.setItem("accessToken", tokens.accessToken),
      ]);

      this.user = user;
      this.tokens = tokens;

      // Notify listeners
      this.notifyAuthListeners(true);
    } catch (error) {
      console.error("Error saving auth state:", error);
      throw error;
    }
  }

  // Clear auth state
  private async clearAuthState(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem("user"),
        AsyncStorage.removeItem("accessToken"),
        AsyncStorage.removeItem("refreshToken"),
      ]);

      this.user = null;
      this.tokens = null;

      // Notify listeners
      this.notifyAuthListeners(false);
    } catch (error) {
      console.error("Error clearing auth state:", error);
      throw error;
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const hasUser = !!this.user;
    const hasAccessToken = !!this.tokens?.accessToken;
    console.log("isAuthenticated check:", {
      hasUser,
      hasAccessToken,
      userId: this.user?.id,
    });

    // Only require access token, not refresh token
    return hasUser && hasAccessToken;
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.user;
  }

  // Get access token
  getAccessToken(): string | null {
    return this.tokens?.accessToken || null;
  }

  // Add auth state change listener
  addAuthListener(listener: (isAuthenticated: boolean) => void): void {
    this.authListeners.push(listener);
    // Immediately notify with current state
    listener(this.isAuthenticated());
  }

  // Remove auth state change listener
  removeAuthListener(listener: (isAuthenticated: boolean) => void): void {
    this.authListeners = this.authListeners.filter((l) => l !== listener);
  }

  // Notify all listeners
  private notifyAuthListeners(isAuthenticated: boolean): void {
    this.authListeners.forEach((listener) => listener(isAuthenticated));
  }

  // Set the base URL (useful for environment switching)
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  // Helper method to handle API responses
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  private createRequestOptions(options: RequestInit = {}): RequestInit {
    const defaultHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Ensure options.headers is treated as a plain object
    const customHeaders = (options.headers as Record<string, string>) || {};

    // Merge headers with default headers
    const headers: Record<string, string> = {
      ...defaultHeaders,
      ...customHeaders,
    };

    // Add auth token if available
    if (this.tokens?.accessToken) {
      headers.Authorization = `Bearer ${this.tokens.accessToken}`;
    }

    return {
      ...options,
      headers,
    };
  }

  // Authenticated fetch with token refresh
  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    let requestOptions = this.createRequestOptions(options);

    // Make initial request
    let response = await fetch(url, requestOptions);

    // Handle 401 Unauthorized by refreshing token
    if (response.status === 401 && this.tokens?.refreshToken) {
      const refreshSuccessful = await this.refreshTokens();

      if (refreshSuccessful) {
        // Retry with new token
        requestOptions = this.createRequestOptions(options);
        response = await fetch(url, requestOptions);
      } else {
        // If refresh failed, clear auth state
        await this.clearAuthState();
      }
    }

    return response;
  }

  // Convert API event to frontend event type
  private mapEventToEventType(apiEvent: ApiEvent): EventType {
    return {
      id: apiEvent.id,
      title: apiEvent.title,
      description: apiEvent.description || "",
      time: new Date(apiEvent.eventDate).toLocaleString(),
      location: apiEvent.address || "Location not specified",
      distance: "", // This would be calculated based on user's location
      emoji: apiEvent.emoji || "📍",
      categories: apiEvent.categories?.map((c) => c.name) || [],
    };
  }

  // Authentication Methods

  async login(email: string, password: string): Promise<User> {
    const url = `${this.baseUrl}/api/auth/login`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await this.handleResponse<LoginResponse>(response);

      console.log("Login response received:", {
        hasUser: !!data.user,
        hasAccessToken: !!data.accessToken,
        hasRefreshToken: !!data.refreshToken,
      });

      // Make sure we have the expected response format
      if (!data.user) {
        throw new Error("User data missing from login response");
      }

      if (!data.accessToken) {
        throw new Error("Access token missing from login response");
      }

      // Create tokens object from the response
      const tokens: AuthTokens = {
        accessToken: data.accessToken,
        // Use refreshToken if provided, otherwise use accessToken
        refreshToken: data.refreshToken || data.accessToken,
      };

      await this.saveAuthState(data.user, tokens);
      return data.user;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  // Register new user
  // Update in ApiClient.ts

  // Register new user
  async register(email: string, password: string, displayName?: string): Promise<User> {
    const url = `${this.baseUrl}/api/auth/register`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, displayName }),
    });

    const user = await this.handleResponse<User>(response);

    // Don't try to login automatically - return the user and let the caller
    // decide what to do next
    return user;
  }

  // Logout user
  async logout(): Promise<void> {
    if (this.tokens?.accessToken) {
      try {
        const url = `${this.baseUrl}/api/auth/logout`;
        await this.fetchWithAuth(url, {
          method: "POST",
        });
      } catch (error) {
        console.error("Logout API error:", error);
        // Continue with local logout even if API call fails
      }
    }

    await this.clearAuthState();
  }

  // Refresh tokens
  async refreshTokens(): Promise<boolean> {
    if (!this.tokens?.refreshToken) return false;

    try {
      const url = `${this.baseUrl}/api/auth/refresh`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: this.tokens.refreshToken }),
      });

      if (!response.ok) return false;

      const newTokens = await this.handleResponse<AuthTokens>(response);

      // Update tokens in memory and storage
      this.tokens = newTokens;
      await Promise.all([AsyncStorage.setItem("accessToken", newTokens.accessToken)]);

      return true;
    } catch (error) {
      console.error("Token refresh error:", error);
      return false;
    }
  }

  // Get user profile
  async getUserProfile(): Promise<User> {
    const url = `${this.baseUrl}/api/users/me`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<User>(response);
  }

  // Update user profile
  async updateUserProfile(updates: Partial<User>): Promise<User> {
    const url = `${this.baseUrl}/api/users/me`;
    const response = await this.fetchWithAuth(url, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });

    const updatedUser = await this.handleResponse<User>(response);

    // Update local user state
    if (this.user) {
      this.user = { ...this.user, ...updatedUser };
      await AsyncStorage.setItem("user", JSON.stringify(this.user));
    }

    return updatedUser;
  }

  // Change password
  async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    const url = `${this.baseUrl}/api/users/me/change-password`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    await this.handleResponse<{ success: boolean }>(response);
    return true;
  }

  // Get events created by current user
  async getUserCreatedEvents(options?: EventOptions): Promise<EventType[]> {
    const queryParams = new URLSearchParams();

    if (options?.limit) queryParams.append("limit", options.limit.toString());
    if (options?.offset) queryParams.append("offset", options.offset.toString());

    const url = `${this.baseUrl}/api/users/me/events/created?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<ApiEvent[]>(response);

    return data.map(this.mapEventToEventType);
  }

  // Get events discovered by current user
  async getUserDiscoveredEvents(options?: EventOptions): Promise<EventType[]> {
    const queryParams = new URLSearchParams();

    if (options?.limit) queryParams.append("limit", options.limit.toString());
    if (options?.offset) queryParams.append("offset", options.offset.toString());

    const url = `${this.baseUrl}/api/users/me/events/discovered?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<ApiEvent[]>(response);

    return data.map(this.mapEventToEventType);
  }

  // Fetch all events
  async getEvents(options?: EventOptions): Promise<EventType[]> {
    const queryParams = new URLSearchParams();

    if (options?.limit) queryParams.append("limit", options.limit.toString());
    if (options?.offset) queryParams.append("offset", options.offset.toString());

    const url = `${this.baseUrl}/api/events?${queryParams.toString()}`;
    // Use authenticated fetch for all API calls
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<ApiEvent[]>(response);

    return data.map(this.mapEventToEventType);
  }

  // Fetch a single event by ID
  async getEventById(id: string): Promise<EventType> {
    const url = `${this.baseUrl}/api/events/${id}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<ApiEvent>(response);

    return this.mapEventToEventType(data);
  }

  // Fetch nearby events
  async getNearbyEvents(
    latitude: number,
    longitude: number,
    radius?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<EventType[]> {
    const queryParams = new URLSearchParams({
      lat: latitude.toString(),
      lng: longitude.toString(),
    });

    if (radius) queryParams.append("radius", radius.toString());
    if (startDate) queryParams.append("startDate", startDate.toISOString());
    if (endDate) queryParams.append("endDate", endDate.toISOString());

    const url = `${this.baseUrl}/api/events/nearby?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<ApiEvent[]>(response);

    return data.map((event) => {
      // Add distance calculation here if provided by API
      const eventWithDistance = this.mapEventToEventType(event);
      // You could calculate distance from the coordinates if not provided by API
      return eventWithDistance;
    });
  }

  // Search events with cursor-based pagination
  async searchEvents(query: string, limit: number = 10, cursor?: string): Promise<SearchResponse> {
    const queryParams = new URLSearchParams({ q: query });

    if (limit) queryParams.append("limit", limit.toString());
    if (cursor) queryParams.append("cursor", cursor);

    const url = `${this.baseUrl}/api/events/search?${queryParams.toString()}`;

    try {
      const response = await this.fetchWithAuth(url);
      const data = await this.handleResponse<SearchResponse>(response);

      // Log pagination details for debugging
      console.log(
        `Search query: "${query}" | Results: ${data.results.length} | Next cursor: ${
          data.nextCursor || "none"
        }`
      );

      return data;
    } catch (error) {
      console.error("Search API error:", error);
      throw error;
    }
  }

  // Get events by categories
  async getEventsByCategories(categoryIds: string[], options?: EventOptions): Promise<EventType[]> {
    const queryParams = new URLSearchParams({
      categories: categoryIds.join(","),
    });

    if (options?.limit) queryParams.append("limit", options.limit.toString());
    if (options?.offset) queryParams.append("offset", options.offset.toString());
    if (options?.startDate) queryParams.append("startDate", options.startDate.toISOString());
    if (options?.endDate) queryParams.append("endDate", options.endDate.toISOString());

    const url = `${this.baseUrl}/api/events/by-categories?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<ApiEvent[]>(response);

    return data.map(this.mapEventToEventType);
  }

  // Get all categories
  async getAllCategories(): Promise<{ id: string; name: string }[]> {
    const url = `${this.baseUrl}/api/events/categories`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{ id: string; name: string }[]>(response);
  }

  // Create a new event
  async createEvent(eventData: Partial<ApiEvent>): Promise<ApiEvent> {
    const url = `${this.baseUrl}/api/events`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(eventData),
    });

    return this.handleResponse<ApiEvent>(response);
  }

  // Upload an image for event processing
  async processEventImage(imageFile: File): Promise<{ jobId: string; status: string }> {
    const formData = new FormData();
    formData.append("image", imageFile);

    const url = `${this.baseUrl}/api/events/process`;

    // Create request options without Content-Type header (browser will set it with boundary)
    const requestOptions = this.createRequestOptions({
      method: "POST",
      body: formData,
      headers: {}, // Override the default Content-Type
    });

    // Remove Content-Type header as it will be set by the browser with the correct boundary
    delete (requestOptions.headers as any)["Content-Type"];

    const response = await this.fetchWithAuth(url, requestOptions);
    return this.handleResponse<{ jobId: string; status: string }>(response);
  }

  // Get event processing job status
  async getJobStatus(jobId: string): Promise<any> {
    const url = `${this.baseUrl}/api/events/process/${jobId}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<any>(response);
  }

  // Create a stream connection for job updates
  createJobStream(
    jobId: string,
    callbacks: {
      onMessage: (data: any) => void;
      onError?: (error: Event) => void;
      onComplete?: () => void;
    }
  ): EventSource {
    // Add access token to the URL for authentication
    let url = `${this.baseUrl}/api/jobs/${jobId}/stream`;

    // Add token as a query param for EventSource (it can't set headers)
    if (this.tokens?.accessToken) {
      url += `?token=${encodeURIComponent(this.tokens.accessToken)}`;
    }

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callbacks.onMessage(data);

        // Check if job is complete or failed
        if (data.status === "completed" || data.status === "failed") {
          eventSource.close();
          if (callbacks.onComplete) callbacks.onComplete();
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    eventSource.onerror = (error) => {
      if (callbacks.onError) callbacks.onError(error);
      eventSource.close();
    };

    return eventSource;
  }
}

// Export as singleton
export const apiClient = new ApiClient();
export default apiClient;
