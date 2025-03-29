// src/services/ApiClient.ts

import { EventType, UserType } from "@/types/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

// Define base API types from your backend
interface Location {
  type: string;
  coordinates: [number, number]; // [longitude, latitude]
}

// In ApiClient.ts or a types file
export interface Filter {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  semanticQuery?: string; // New field for natural language query
  emoji?: string; // AI-generated emoji for the filter
  // embedding field exists on server but not needed in client
  criteria: {
    // Remove categories, keywords, tags
    dateRange?: {
      start?: string;
      end?: string;
    };
    status?: string[];
    location?: {
      latitude?: number;
      longitude?: number;
      radius?: number; // in meters
    };
  };
  createdAt: Date;
  updatedAt: Date;
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

export interface ApiEvent {
  id: string;
  title: string;
  description?: string;
  eventDate: string;
  endDate?: string;
  location: Location;
  address?: string;
  locationNotes?: string; // Add location notes
  categories?: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
  emoji?: string;
  creator?: UserType;
  creatorId?: string;
  scanCount?: number;
  saveCount?: number; // Add count of saves
  timezone?: string;
  qrUrl?: string | null;
  qrCodeData?: string;
  qrImagePath?: string | null;
  hasQrCode?: boolean;
  qrGeneratedAt?: string | null;
  qrDetectedInImage?: boolean;
  detectedQrData?: string | null;
}

interface ClusterFeature {
  id?: string;
  title?: string;
  address?: string;
  location?: [number, number]; // [longitude, latitude]
  pointCount?: number;
  eventIds?: string[];
}

interface ClusterNamingRequest {
  clusters: ClusterFeature[];
  zoom: number;
  bounds?: {
    north: number;
    east: number;
    south: number;
    west: number;
  };
}

// Geocoding information returned from the service
interface GeocodingInfo {
  placeName: string;
  neighborhood?: string;
  locality?: string;
  place?: string;
  district?: string;
  region?: string;
  country?: string;
  poi?: string;
}

// Updated result to include optional geocoding information
interface ClusterNamingResult {
  clusterId: string;
  generatedName: string;
  geocodingInfo?: GeocodingInfo;
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
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(baseUrl: string = process.env.EXPO_PUBLIC_API_URL!) {
    this.baseUrl = baseUrl;
    this.initializationPromise = this.loadAuthState();
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
      if (accessToken) {
        this.tokens = {
          accessToken,
          refreshToken: refreshToken || undefined,
        };
      }

      // Notify listeners if we have valid auth
      this.notifyAuthListeners(this.isAuthenticated());

      // Mark as initialized
      this.isInitialized = true;
    } catch (error) {
      console.error("Error loading auth state:", error);
      this.isInitialized = true; // Still mark as initialized even on error
    }
  }

  // Make sure client is initialized before making any API calls
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  private async saveAuthState(user: User, tokens: AuthTokens): Promise<void> {
    try {
      const storageOperations = [
        AsyncStorage.setItem("user", JSON.stringify(user)),
        AsyncStorage.setItem("accessToken", tokens.accessToken),
      ];

      // Store refresh token if available
      if (tokens.refreshToken) {
        storageOperations.push(AsyncStorage.setItem("refreshToken", tokens.refreshToken));
      }

      await Promise.all(storageOperations);

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
  async clearAuthState(): Promise<void> {
    try {
      // Remove all auth-related items from AsyncStorage
      await Promise.all([
        AsyncStorage.removeItem("user"),
        AsyncStorage.removeItem("accessToken"),
        AsyncStorage.removeItem("refreshToken"),
      ]);

      // Clear in-memory auth state
      this.user = null;
      this.tokens = null;

      // Notify any listeners that auth state has changed
      this.notifyAuthListeners(false);
    } catch (error) {
      console.error("Error clearing auth state:", error);
      throw error;
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const hasUser = !!this.user;

    // Only require access token, not refresh token
    return hasUser;
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.user;
  }

  async getAccessToken(): Promise<string | null> {
    await this.ensureInitialized();

    if (!this.tokens?.accessToken) {
      return null;
    }

    // Check if token is expired and refresh if needed
    const isExpired = await this.isTokenExpired();

    if (isExpired && this.tokens.refreshToken) {
      const refreshed = await this.refreshTokens();
      if (!refreshed) {
        await this.clearAuthState();
        return null;
      }
    }

    return this.tokens.accessToken;
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

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    // Wait for initialization to complete
    await this.ensureInitialized();

    // Create request options with current tokens
    const requestOptions = this.createRequestOptions(options);

    // Make the initial request
    let response = await fetch(url, requestOptions);

    // If we get a 401 unauthorized error, try to refresh the token
    if (response.status === 401 && this.tokens?.refreshToken) {
      console.log("Received 401, attempting to refresh token");

      const refreshSuccess = await this.refreshTokens();

      if (refreshSuccess) {
        // If token refresh succeeded, retry the original request with new token
        console.log("Token refresh succeeded, retrying original request");
        const newRequestOptions = this.createRequestOptions(options);
        return fetch(url, newRequestOptions);
      } else {
        // If refresh failed, clear auth state and return the original 401 response
        console.log("Token refresh failed, clearing auth state");
        await this.clearAuthState();
      }
    }

    return response;
  }

  private mapEventToEventType(apiEvent: ApiEvent): EventType {
    return {
      id: apiEvent.id,
      title: apiEvent.title,
      description: apiEvent.description || "",
      eventDate: apiEvent.eventDate,
      endDate: apiEvent.endDate ?? undefined,
      time: new Date(apiEvent.eventDate).toLocaleString(),
      coordinates: apiEvent.location.coordinates,
      location: apiEvent.address || "Location not specified",
      locationNotes: apiEvent.locationNotes || "",
      distance: "",
      emoji: apiEvent.emoji || "📍",
      categories: apiEvent.categories?.map((c) => c.name) || [],
      creator: apiEvent?.creator,
      scanCount: apiEvent.scanCount ?? 1,
      saveCount: apiEvent.saveCount ?? 0,
      timezone: apiEvent.timezone ?? "",
      qrUrl: apiEvent.qrUrl,
      qrCodeData: apiEvent.qrCodeData,
      qrImagePath: apiEvent.qrImagePath,
      hasQrCode: apiEvent?.hasQrCode,
      qrGeneratedAt: apiEvent?.qrGeneratedAt,
      qrDetectedInImage: apiEvent?.qrDetectedInImage,
      detectedQrData: apiEvent?.detectedQrData,
    };
  }

  // Add this method to ApiClient class
  async syncTokensWithStorage() {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        AsyncStorage.getItem("accessToken"),
        AsyncStorage.getItem("refreshToken"),
      ]);

      // Update the in-memory tokens
      if (accessToken) {
        this.tokens = {
          accessToken,
          refreshToken: refreshToken || undefined,
        };
        console.log("Tokens synced from AsyncStorage");
      } else {
        this.tokens = null;
        console.log("No tokens found in AsyncStorage");
      }

      return this.tokens;
    } catch (error) {
      console.error("Error syncing tokens with storage:", error);
      return null;
    }
  }

  // 4. Update login method to properly store refresh token
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
        // Use the refresh token if provided
        refreshToken: data.refreshToken,
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

  // 3. Update the refreshTokens method for better error handling
  async refreshTokens(): Promise<boolean> {
    if (!this.tokens?.refreshToken) {
      console.log("No refresh token available");
      return false;
    }

    try {
      console.log("Attempting to refresh token");
      const url = `${this.baseUrl}/api/auth/refresh-token`; // Updated to match your API path

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: this.tokens.refreshToken }),
      });

      if (!response.ok) {
        console.error("Token refresh failed with status:", response.status);
        return false;
      }

      const data = await response.json();

      // Check if we have a valid response format
      if (!data.accessToken) {
        console.error("Invalid refresh token response:", data);
        return false;
      }

      // Create the new tokens object, preserving the refresh token if not returned
      const newTokens: AuthTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || this.tokens.refreshToken,
      };

      // Update tokens in memory and storage
      this.tokens = newTokens;

      await Promise.all([
        AsyncStorage.setItem("accessToken", newTokens.accessToken),
        newTokens.refreshToken
          ? AsyncStorage.setItem("refreshToken", newTokens.refreshToken)
          : Promise.resolve(),
      ]);

      console.log("Token refresh successful");
      return true;
    } catch (error) {
      console.error("Token refresh error:", error);
      return false;
    }
  }

  // Get user profile
  async getUserProfile(): Promise<User> {
    const url = `${this.baseUrl}/api/auth/me`;

    const response = await this.fetchWithAuth(url, { method: "POST" });

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
  async getUserDiscoveredEvents(options?: EventOptions): Promise<{
    events: EventType[];
    total: number;
    hasMore: boolean;
  }> {
    const queryParams = new URLSearchParams();

    if (options?.limit) queryParams.append("limit", options.limit.toString());
    if (options?.offset) queryParams.append("offset", options.offset.toString());

    const url = `${this.baseUrl}/api/events/discovered?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);

    const data = await this.handleResponse<{
      events: ApiEvent[];
      total: number;
      hasMore: boolean;
    }>(response);

    return {
      events: data.events.map(this.mapEventToEventType),
      total: data.total,
      hasMore: data.hasMore,
    };
  }

  async generateClusterNames(request: ClusterNamingRequest): Promise<ClusterNamingResult[]> {
    const url = `${this.baseUrl}/api/events/clusters/names`;

    try {
      const response = await this.fetchWithAuth(url, {
        method: "POST",
        body: JSON.stringify(request),
      });

      return this.handleResponse<ClusterNamingResult[]>(response);
    } catch (error) {
      console.error("Error generating cluster names:", error);
      throw error;
    }
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
        `Search query: "${query}" | Results: ${data.results.length} | Next cursor: ${data.nextCursor || "none"
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

  async toggleSaveEvent(eventId: string): Promise<{ saved: boolean; saveCount: number }> {
    const url = `${this.baseUrl}/api/events/${eventId}/save`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });

    return this.handleResponse<{ saved: boolean; saveCount: number }>(response);
  }

  async isEventSaved(eventId: string): Promise<{ isSaved: boolean }> {
    const url = `${this.baseUrl}/api/events/${eventId}/saved`;
    const response = await this.fetchWithAuth(url);

    return this.handleResponse<{ isSaved: boolean }>(response);
  }

  async getSavedEvents(options?: EventOptions): Promise<{
    events: EventType[];
    total: number;
    hasMore: boolean;
  }> {
    const queryParams = new URLSearchParams();

    if (options?.limit) queryParams.append("limit", options.limit.toString());
    if (options?.offset) queryParams.append("offset", options.offset.toString());

    const url = `${this.baseUrl}/api/events/saved?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);

    const data = await this.handleResponse<{
      events: ApiEvent[];
      total: number;
      hasMore: boolean;
    }>(response);

    // Map API events to frontend event type
    return {
      events: data.events.map(this.mapEventToEventType),
      total: data.total,
      hasMore: data.hasMore,
    };
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
    });

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

  async isTokenExpired(): Promise<boolean> {
    if (!this.tokens?.accessToken) return true;

    try {
      // Make a lightweight request to check token validity
      const url = `${this.baseUrl}/api/auth/me`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.tokens.accessToken}`,
        },
      });

      return response.status === 401;
    } catch (error) {
      console.error("Error checking token expiration:", error);
      return true;
    }
  }

  async getUserFilters(): Promise<Filter[]> {
    const url = `${this.baseUrl}/api/filters`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Filter[]>(response);
  }

  // Create a new filter
  async createFilter(filterData: Partial<Filter>): Promise<Filter> {
    const url = `${this.baseUrl}/api/filters`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(filterData),
    });
    return this.handleResponse<Filter>(response);
  }

  // Update an existing filter
  async updateFilter(filterId: string, filterData: Partial<Filter>): Promise<Filter> {
    const url = `${this.baseUrl}/api/filters/${filterId}`;
    const response = await this.fetchWithAuth(url, {
      method: "PUT",
      body: JSON.stringify(filterData),
    });
    return this.handleResponse<Filter>(response);
  }

  // Delete a filter
  async deleteFilter(filterId: string): Promise<{ success: boolean }> {
    const url = `${this.baseUrl}/api/filters/${filterId}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    return this.handleResponse<{ success: boolean }>(response);
  }

  // Apply filters to the current session
  async applyFilters(filterIds: string[]): Promise<{ message: string; activeFilters: Filter[] }> {
    const url = `${this.baseUrl}/api/filters/apply`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ filterIds }),
    });
    return this.handleResponse<{ message: string; activeFilters: Filter[] }>(response);
  }

  // Clear all active filters
  async clearFilters(): Promise<{ message: string; success: boolean }> {
    const url = `${this.baseUrl}/api/filters/clear`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    return this.handleResponse<{ message: string; success: boolean }>(response);
  }

  async streamEventImage(eventId: string): Promise<string> {
    await this.ensureInitialized();

    // Make sure we have a valid token
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error("Authentication required to access event images");
    }

    const url = `${this.baseUrl}/api/admin/images/${eventId}/image`;

    try {
      // Get the signed URL from our server
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.originalImageUrl) {
        throw new Error("No image URL returned from server");
      }

      // Use the signed URL to download the image to local storage
      const fileName = `event-${eventId}-original.jpg`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      // Check if we already have a recent cached version
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      const now = new Date().getTime();
      const oneHourAgo = now - 60 * 60 * 1000;

      // Use cache if it exists and is less than 1 hour old
      if (
        fileInfo.exists &&
        fileInfo.modificationTime &&
        fileInfo.modificationTime > oneHourAgo &&
        fileInfo.size > 1000
      ) {
        return fileUri;
      }

      // Delete old file if it exists
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      }

      // Download the image from the signed URL
      const downloadResult = await FileSystem.downloadAsync(data.originalImageUrl, fileUri);

      if (downloadResult.status !== 200) {
        throw new Error(`Failed to download image: ${downloadResult.status}`);
      }

      // Verify the downloaded file
      const downloadedFileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!downloadedFileInfo.exists || downloadedFileInfo.size < 1000) {
        throw new Error("Downloaded file is too small to be a valid image");
      }

      return fileUri;
    } catch (error) {
      console.error("Error fetching event image:", error);
      throw error;
    }
  }

  async deleteAccount(password: string): Promise<boolean> {
    const url = `${this.baseUrl}/api/auth/account`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
      body: JSON.stringify({ password }),
    });

    await this.handleResponse<{ message: string }>(response);
    return true;
  }
}

// Export as singleton
export const apiClient = new ApiClient();
export default apiClient;
