import type { UserProfile } from "@realtime-markers/shared";

// Base API types
export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

// Re-export shared types for consistency
export type User = UserProfile;

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
}
