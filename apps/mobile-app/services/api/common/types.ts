import { User } from "../base/types";

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  direction?: "forward" | "backward";
}

export interface Location {
  type: string;
  coordinates: [number, number]; // [longitude, latitude]
}

export interface BaseApiClient {
  baseUrl: string;
  getAccessToken(): Promise<string | null>;
  fetchWithAuth(url: string, options?: RequestInit): Promise<Response>;
  handleResponse<T>(response: Response): Promise<T>;
  createRequestOptions(options?: RequestInit): RequestInit;
  ensureInitialized(): Promise<void>;
  isAuthenticated(): boolean;
  getCurrentUser(): User | null;
  addAuthListener(listener: (isAuthenticated: boolean) => void): void;
  removeAuthListener(listener: (isAuthenticated: boolean) => void): void;
  setBaseUrl(url: string): void;
  clearAuthState(): Promise<void>;
  refreshTokens(): Promise<boolean>;
  isTokenExpired(): Promise<boolean>;
  syncTokensWithStorage(): Promise<AuthTokens | null>;
}
