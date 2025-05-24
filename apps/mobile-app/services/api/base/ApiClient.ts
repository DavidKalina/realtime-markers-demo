import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthTokens, User } from "./types";

export class BaseApiClient {
  protected baseUrl: string;
  protected user: User | null = null;
  protected tokens: AuthTokens | null = null;
  private authListeners: ((isAuthenticated: boolean) => void)[] = [];
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(baseUrl: string = process.env.EXPO_PUBLIC_API_URL!) {
    this.baseUrl = baseUrl;
    this.initializationPromise = this.loadAuthState();
  }

  // Core auth methods
  protected async loadAuthState(): Promise<void> {
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

      this.notifyAuthListeners(this.isAuthenticated());
      this.isInitialized = true;
    } catch (error) {
      console.error("Error loading auth state:", error);
      this.isInitialized = true;
    }
  }

  protected async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  protected async saveAuthState(user: User, tokens: AuthTokens): Promise<void> {
    try {
      const storageOperations = [
        AsyncStorage.setItem("user", JSON.stringify(user)),
        AsyncStorage.setItem("accessToken", tokens.accessToken),
      ];

      if (tokens.refreshToken) {
        storageOperations.push(
          AsyncStorage.setItem("refreshToken", tokens.refreshToken),
        );
      }

      await Promise.all(storageOperations);

      // Update in-memory state
      this.user = user;
      this.tokens = tokens;

      // Notify all listeners about the auth state change
      this.notifyAuthListeners(true);

      console.log("Auth state saved:", {
        userId: user.id,
        isAuthenticated: true,
      });
    } catch (error) {
      console.error("Error saving auth state:", error);
      throw error;
    }
  }

  async clearAuthState(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem("user"),
        AsyncStorage.removeItem("accessToken"),
        AsyncStorage.removeItem("refreshToken"),
      ]);

      this.user = null;
      this.tokens = null;
      this.notifyAuthListeners(false);
    } catch (error) {
      console.error("Error clearing auth state:", error);
      throw error;
    }
  }

  isAuthenticated(): boolean {
    return !!this.user;
  }

  getCurrentUser(): User | null {
    return this.user;
  }

  async getAccessToken(): Promise<string | null> {
    await this.ensureInitialized();
    if (!this.tokens?.accessToken) return null;

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

  // Auth listeners
  addAuthListener(listener: (isAuthenticated: boolean) => void): void {
    this.authListeners.push(listener);
    listener(this.isAuthenticated());
  }

  removeAuthListener(listener: (isAuthenticated: boolean) => void): void {
    this.authListeners = this.authListeners.filter((l) => l !== listener);
  }

  private notifyAuthListeners(isAuthenticated: boolean): void {
    this.authListeners.forEach((listener) => listener(isAuthenticated));
  }

  // Core HTTP methods
  protected async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  protected createRequestOptions(options: RequestInit = {}): RequestInit {
    const defaultHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const customHeaders = (options.headers as Record<string, string>) || {};
    const headers: Record<string, string> = {
      ...defaultHeaders,
      ...customHeaders,
    };

    if (this.tokens?.accessToken) {
      headers.Authorization = `Bearer ${this.tokens.accessToken}`;
    }

    return {
      ...options,
      headers,
    };
  }

  protected async fetchWithAuth(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    // Ensure we're fully initialized before making any requests
    await this.ensureInitialized();

    // Get a fresh access token, which will handle refresh if needed
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error("No access token available");
    }

    const requestOptions = this.createRequestOptions({
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const response = await fetch(url, requestOptions);

    if (response.status === 401) {
      console.log("Received 401, attempting to refresh token");
      const refreshSuccess = await this.refreshTokens();

      if (refreshSuccess) {
        console.log("Token refresh succeeded, retrying original request");
        // Get the new access token after refresh
        const newAccessToken = await this.getAccessToken();
        if (!newAccessToken) {
          throw new Error("Failed to get new access token after refresh");
        }

        const newRequestOptions = this.createRequestOptions({
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newAccessToken}`,
          },
        });
        return fetch(url, newRequestOptions);
      } else {
        console.log("Token refresh failed, clearing auth state");
        await this.clearAuthState();
        throw new Error("Authentication failed");
      }
    }

    return response;
  }

  // Token management
  protected async isTokenExpired(): Promise<boolean> {
    if (!this.tokens?.accessToken) return true;

    try {
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

  protected async refreshTokens(): Promise<boolean> {
    if (!this.tokens?.refreshToken) {
      console.log("No refresh token available");
      return false;
    }

    try {
      console.log("Attempting to refresh token");
      const url = `${this.baseUrl}/api/auth/refresh-token`;

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

      if (!data.accessToken) {
        console.error("Invalid refresh token response:", data);
        return false;
      }

      const newTokens: AuthTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || this.tokens.refreshToken,
      };

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

  // Utility methods
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  async syncTokensWithStorage() {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        AsyncStorage.getItem("accessToken"),
        AsyncStorage.getItem("refreshToken"),
      ]);

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

  // Add public method for token refresh
  async refreshAuthTokens(): Promise<boolean> {
    return this.refreshTokens();
  }
}
