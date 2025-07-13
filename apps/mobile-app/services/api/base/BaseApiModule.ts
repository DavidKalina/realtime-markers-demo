import { BaseApiClient } from "./ApiClient";
import { AuthTokens } from "./types";
import { UserResponse } from "@realtime-markers/types";

export abstract class BaseApiModule {
  protected readonly client: BaseApiClient;

  constructor(client: BaseApiClient) {
    this.client = client;
  }

  // Expose auth-related methods to all modules
  protected getCurrentUser(): UserResponse | null {
    return this.client.getCurrentUser();
  }

  protected isAuthenticated(): boolean {
    return this.client.isAuthenticated();
  }

  protected async getAccessToken(): Promise<string | null> {
    return this.client.getAccessToken();
  }

  protected async fetchWithAuth(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    return this.client.fetchWithAuth(url, options);
  }

  protected async handleResponse<T>(response: Response): Promise<T> {
    return this.client.handleResponse<T>(response);
  }

  protected createRequestOptions(options: RequestInit = {}): RequestInit {
    return this.client.createRequestOptions(options);
  }

  // Add ensureInitialized method
  protected async ensureInitialized(): Promise<void> {
    return this.client.ensureInitialized();
  }

  // Auth state management methods
  protected async saveAuthState(
    user: UserResponse,
    tokens: AuthTokens,
  ): Promise<void> {
    return this.client.saveAuthState(user, tokens);
  }

  protected async clearAuthState(): Promise<void> {
    return this.client.clearAuthState();
  }

  protected async syncTokensWithStorage(): Promise<AuthTokens | null> {
    return this.client.syncTokensWithStorage();
  }
}
