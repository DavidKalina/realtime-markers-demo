import { Filter, BoundingBox } from "../types/types";

export interface UserStateService {
  // Filter management
  setUserFilters(userId: string, filters: Filter[]): void;
  getUserFilters(userId: string): Filter[];
  hasUserFilters(userId: string): boolean;
  removeUserFilters(userId: string): void;

  // Viewport management
  setUserViewport(userId: string, viewport: BoundingBox): void;
  getUserViewport(userId: string): BoundingBox | undefined;
  hasUserViewport(userId: string): boolean;
  removeUserViewport(userId: string): void;

  // User lifecycle
  registerUser(
    userId: string,
    viewport?: BoundingBox,
    filters?: Filter[],
  ): void;
  unregisterUser(userId: string): void;

  // Bulk operations
  getAllUserIds(): string[];
  getAllUsersWithFilters(): Array<{ userId: string; filters: Filter[] }>;
  getAllUsersWithViewports(): Array<{ userId: string; viewport: BoundingBox }>;

  // Stats
  getStats(): {
    totalUsers: number;
    usersWithFilters: number;
    usersWithViewports: number;
  };
}

export interface UserStateServiceConfig {
  maxUsers?: number;
  enableViewportTracking?: boolean;
  enableFilterTracking?: boolean;
}

export function createUserStateService(
  config: UserStateServiceConfig = {},
): UserStateService {
  const {
    maxUsers = 10000,
    enableViewportTracking = true,
    enableFilterTracking = true,
  } = config;

  // Private state
  const userFilters = new Map<string, Filter[]>();
  const userViewports = new Map<string, BoundingBox>();

  /**
   * Set filters for a user
   */
  function setUserFilters(userId: string, filters: Filter[]): void {
    if (!enableFilterTracking) {
      console.warn("[UserStateService] Filter tracking is disabled");
      return;
    }

    userFilters.set(userId, filters);

    // Enforce user limit
    if (userFilters.size > maxUsers) {
      const firstKey = userFilters.keys().next().value;
      if (firstKey) {
        unregisterUser(firstKey);
      }
    }
  }

  /**
   * Get filters for a user
   */
  function getUserFilters(userId: string): Filter[] {
    return userFilters.get(userId) || [];
  }

  /**
   * Check if user has filters
   */
  function hasUserFilters(userId: string): boolean {
    return userFilters.has(userId);
  }

  /**
   * Remove filters for a user
   */
  function removeUserFilters(userId: string): void {
    userFilters.delete(userId);
  }

  /**
   * Set viewport for a user
   */
  function setUserViewport(userId: string, viewport: BoundingBox): void {
    if (!enableViewportTracking) {
      console.warn("[UserStateService] Viewport tracking is disabled");
      return;
    }

    userViewports.set(userId, viewport);

    // Enforce user limit
    if (userViewports.size > maxUsers) {
      const firstKey = userViewports.keys().next().value;
      if (firstKey) {
        unregisterUser(firstKey);
      }
    }
  }

  /**
   * Get viewport for a user
   */
  function getUserViewport(userId: string): BoundingBox | undefined {
    return userViewports.get(userId);
  }

  /**
   * Check if user has viewport
   */
  function hasUserViewport(userId: string): boolean {
    return userViewports.has(userId);
  }

  /**
   * Remove viewport for a user
   */
  function removeUserViewport(userId: string): void {
    userViewports.delete(userId);
  }

  /**
   * Register a new user with optional initial state
   */
  function registerUser(
    userId: string,
    viewport?: BoundingBox,
    filters?: Filter[],
  ): void {
    if (viewport && enableViewportTracking) {
      setUserViewport(userId, viewport);
    }

    if (filters && enableFilterTracking) {
      setUserFilters(userId, filters);
    }

    console.log("[UserStateService] User registered:", {
      userId,
      hasViewport: viewport !== undefined,
      hasFilters: filters !== undefined,
      filterCount: filters?.length || 0,
    });
  }

  /**
   * Unregister a user and clean up all their data
   */
  function unregisterUser(userId: string): void {
    const hadFilters = hasUserFilters(userId);
    const hadViewport = hasUserViewport(userId);

    removeUserFilters(userId);
    removeUserViewport(userId);

    console.log("[UserStateService] User unregistered:", {
      userId,
      hadFilters,
      hadViewport,
      remainingUsers: userFilters.size,
    });
  }

  /**
   * Get all user IDs
   */
  function getAllUserIds(): string[] {
    const allUserIds = new Set<string>();

    if (enableFilterTracking) {
      userFilters.forEach((_, userId) => allUserIds.add(userId));
    }

    if (enableViewportTracking) {
      userViewports.forEach((_, userId) => allUserIds.add(userId));
    }

    return Array.from(allUserIds);
  }

  /**
   * Get all users with their filters
   */
  function getAllUsersWithFilters(): Array<{
    userId: string;
    filters: Filter[];
  }> {
    if (!enableFilterTracking) {
      return [];
    }

    return Array.from(userFilters.entries()).map(([userId, filters]) => ({
      userId,
      filters,
    }));
  }

  /**
   * Get all users with their viewports
   */
  function getAllUsersWithViewports(): Array<{
    userId: string;
    viewport: BoundingBox;
  }> {
    if (!enableViewportTracking) {
      return [];
    }

    return Array.from(userViewports.entries()).map(([userId, viewport]) => ({
      userId,
      viewport,
    }));
  }

  /**
   * Get service statistics
   */
  function getStats(): {
    totalUsers: number;
    usersWithFilters: number;
    usersWithViewports: number;
  } {
    const totalUsers = getAllUserIds().length;

    return {
      totalUsers,
      usersWithFilters: enableFilterTracking ? userFilters.size : 0,
      usersWithViewports: enableViewportTracking ? userViewports.size : 0,
    };
  }

  return {
    setUserFilters,
    getUserFilters,
    hasUserFilters,
    removeUserFilters,
    setUserViewport,
    getUserViewport,
    hasUserViewport,
    removeUserViewport,
    registerUser,
    unregisterUser,
    getAllUserIds,
    getAllUsersWithFilters,
    getAllUsersWithViewports,
    getStats,
  };
}
