// Derived types from database entities
import {
  User,
  UserRole,
  UserPushToken,
} from "../entities";

// ============================================================================
// USER TYPES
// ============================================================================

export type UserInput = Omit<
  User,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "pushTokens"
>;

export type UserUpdate = Partial<
  Omit<
    User,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "pushTokens"
  >
>;

export type UserProfile = Pick<
  User,
  | "id"
  | "firstName"
  | "lastName"
  | "email"
  | "avatarUrl"
  | "bio"
  | "role"
  | "isVerified"
  | "discoveryCount"
  | "scanCount"
  | "saveCount"
  | "viewCount"
  | "totalXp"
  | "currentTier"
  | "currentStreak"
  | "longestStreak"
  | "onboardingProfile"
  | "comfortProfile"
  | "pacePreference"
  | "comfortRadiusMiles"
  | "homeLatitude"
  | "homeLongitude"
>;

// ============================================================================
// PUSH TOKEN TYPES
// ============================================================================

export type UserPushTokenInput = Omit<
  UserPushToken,
  "id" | "createdAt" | "user"
> & {
  userId: string;
};

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export type PaginationParams = {
  page?: number;
  limit?: number;
  offset?: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export type ApiError = {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type WithTimestamps = {
  createdAt: Date;
  updatedAt: Date;
};

export type WithId = {
  id: string;
};

export type OptionalFields<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ============================================================================
// ENUM EXPORTS
// ============================================================================

export { UserRole };
