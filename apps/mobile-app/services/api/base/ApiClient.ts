import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthTokens, User } from "./types";

export class BaseApiClient {
  public baseUrl: string;
  public user: User | null = null;
  public tokens: AuthTokens | null = null;
  private authListeners: ((isAuthenticated: boolean) => void)[] = [];
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private tokenSyncPromise: Promise<AuthTokens | null> | null = null;
  private tokenRefreshPromise: Promise<boolean> | null = null;

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

      if (userJson) {
        this.user = JSON.parse(userJson);
      }

      if (accessToken) {
        this.tokens = {
          accessToken,
          refreshToken: refreshToken || undefined,
        };
      }

      this.notifyAuthListeners(this.isAuthenticated());
      this.isInitialized = true;
    } catch (error) {
      this.isInitialized = true; // Mark as initialized even on error to prevent infinite loops
      throw error; // Re-throw to let callers handle the error
    }
  }

  public async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = this.loadAuthState();
    await this.initializationPromise;
  }

  public async saveAuthState(user: User, tokens: AuthTokens): Promise<void> {
    try {
      // Update in-memory state first
      this.user = user;
      this.tokens = tokens;

      // Then save to storage
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

      // Verify storage after save
      await Promise.all([
        AsyncStorage.getItem("accessToken"),
        AsyncStorage.getItem("refreshToken"),
      ]);

      // Notify all listeners about the auth state change
      this.notifyAuthListeners(true);
    } catch (error) {
      console.error("Error saving auth state:", error);
      // Clear in-memory state on error
      this.user = null;
      this.tokens = null;
      throw error;
    }
  }

  public async clearAuthState(): Promise<void> {
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

  public async getAccessToken(): Promise<string | null> {
    await this.ensureInitialized();

    // First check if we have a valid access token in memory
    if (this.tokens?.accessToken && !(await this.isTokenExpired())) {
      return this.tokens.accessToken;
    }

    // If we have a refresh token, try to refresh first
    if (this.tokens?.refreshToken) {
      const refreshSuccess = await this.refreshTokens();
      if (refreshSuccess && this.tokens?.accessToken) {
        return this.tokens.accessToken;
      }
    }

    // If refresh failed or we don't have a refresh token, try to sync from storage
    const syncedTokens = await this.syncTokensWithStorage();

    if (syncedTokens?.accessToken) {
      return syncedTokens.accessToken;
    }

    // If we have a refresh token in storage but not in memory, try one last refresh
    const storedRefreshToken = await AsyncStorage.getItem("refreshToken");
    if (storedRefreshToken) {
      this.tokens = { accessToken: "", refreshToken: storedRefreshToken };
      const refreshSuccess = await this.refreshTokens();
      if (refreshSuccess && this.tokens?.accessToken) {
        return this.tokens.accessToken;
      }
    }

    return null;
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
  public async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  public createRequestOptions(options: RequestInit = {}): RequestInit {
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

  public async fetchWithAuth(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    // Ensure we're fully initialized before making any requests
    if (!this.isInitialized) {
      await this.ensureInitialized();
    }

    // Get a fresh access token, which will handle refresh if needed
    const accessToken = await this.getAccessToken();

    if (!accessToken) {
      // If we're still initializing, wait a bit and try again
      if (!this.isInitialized) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.fetchWithAuth(url, options);
      }

      // If we have no tokens at all, try to refresh auth state
      const refreshSuccess = await this.refreshAuthTokens();
      if (refreshSuccess) {
        return this.fetchWithAuth(url, options);
      }

      // If we still have no tokens, throw a more specific error
      throw new Error("Authentication required - please log in again");
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
      const refreshSuccess = await this.refreshTokens();

      if (refreshSuccess) {
        // Get the new access token after refresh
        const newAccessToken = await this.getAccessToken();
        if (!newAccessToken) {
          console.error("Failed to get new access token after refresh");
          throw new Error("Authentication failed - please log in again");
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
        await this.clearAuthState();
        throw new Error("Authentication failed - please log in again");
      }
    }

    return response;
  }

  // Token management
  protected async isTokenExpired(): Promise<boolean> {
    if (!this.tokens?.accessToken) return true;

    try {
      // Decode the JWT token to check expiry locally
      const tokenParts = this.tokens.accessToken.split(".");
      if (tokenParts.length !== 3) return true;

      const payload = JSON.parse(atob(tokenParts[1]));
      const expiryTime = payload.exp * 1000; // Convert to milliseconds

      // Add a 30-second buffer to prevent edge cases
      return Date.now() >= expiryTime - 30000;
    } catch (error) {
      console.error("Error checking token expiration:", error);
      return true;
    }
  }

  protected async refreshTokens(): Promise<boolean> {
    // If there's already a refresh in progress, wait for it
    if (this.tokenRefreshPromise) {
      try {
        return await this.tokenRefreshPromise;
      } catch (error) {
        console.error("Error waiting for token refresh:", error);
        return false;
      }
    }

    this.tokenRefreshPromise = (async () => {
      try {
        // Get the current refresh token before starting the refresh
        const currentRefreshToken = this.tokens?.refreshToken;
        if (!currentRefreshToken) {
          return false;
        }

        const url = `${this.baseUrl}/api/auth/refresh-token`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken: currentRefreshToken }),
        });

        if (!response.ok) {
          console.error("Token refresh failed with status:", response.status);
          await this.clearAuthState();
          return false;
        }

        const data = await response.json();

        if (!data.accessToken) {
          console.error("Invalid refresh token response:", data);
          await this.clearAuthState();
          return false;
        }

        const newTokens: AuthTokens = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken || currentRefreshToken,
        };

        // Update in-memory state first
        this.tokens = newTokens;

        // Then save to storage atomically
        if (this.user) {
          await this.saveAuthState(this.user, newTokens);
        } else {
          // If we don't have a user, just save the tokens
          await Promise.all([
            AsyncStorage.setItem("accessToken", newTokens.accessToken),
            AsyncStorage.setItem("refreshToken", newTokens.refreshToken || ""),
          ]);
        }

        return true;
      } catch (error) {
        console.error("Token refresh error:", error);
        await this.clearAuthState();
        return false;
      } finally {
        this.tokenRefreshPromise = null;
      }
    })();

    return this.tokenRefreshPromise;
  }

  public async syncTokensWithStorage(): Promise<AuthTokens | null> {
    // If there's already a sync in progress, wait for it
    if (this.tokenSyncPromise) {
      try {
        return await this.tokenSyncPromise;
      } catch (error) {
        console.error("Error waiting for token sync:", error);
        return null;
      }
    }

    this.tokenSyncPromise = (async () => {
      try {
        // First check if we have valid tokens in memory
        if (this.tokens?.accessToken && !(await this.isTokenExpired())) {
          return this.tokens;
        }

        // If we have an expired access token but a refresh token, try to refresh
        if (this.tokens?.refreshToken) {
          const refreshSuccess = await this.refreshTokens();
          if (refreshSuccess && this.tokens?.accessToken) {
            return this.tokens;
          }
        }

        // If we get here, try to load from storage
        const [accessToken, refreshToken] = await Promise.all([
          AsyncStorage.getItem("accessToken"),
          AsyncStorage.getItem("refreshToken"),
        ]);

        if (!accessToken) {
          this.tokens = null;
          return null;
        }

        // If we have a refresh token, try to refresh the access token
        if (refreshToken) {
          const refreshSuccess = await this.refreshTokens();
          if (refreshSuccess && this.tokens?.accessToken) {
            return this.tokens;
          }
        }

        // If we get here, just use the access token from storage
        this.tokens = {
          accessToken,
          refreshToken: refreshToken || undefined,
        };

        return this.tokens;
      } catch (error) {
        console.error("Error during token sync:", error);
        this.tokens = null;
        return null;
      } finally {
        this.tokenSyncPromise = null;
      }
    })();

    return this.tokenSyncPromise;
  }

  // Utility methods
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  // Add public method for token refresh
  async refreshAuthTokens(): Promise<boolean> {
    return this.refreshTokens();
  }
}
