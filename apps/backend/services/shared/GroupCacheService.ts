import { Group } from "../../entities/Group";
import {
  GroupMembership,
  GroupMembershipStatus,
} from "../../entities/GroupMembership";
import { Event } from "../../entities/Event";
import { CacheService } from "./CacheService";

interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  direction?: "forward" | "backward";
}

interface SearchGroupsParams extends CursorPaginationParams {
  query?: string;
  categoryId?: string;
}

interface GetGroupEventsParams extends CursorPaginationParams {
  query?: string;
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface GroupWithDistance extends Group {
  distance: number;
}

export class GroupCacheService extends CacheService {
  private static readonly GROUP_PREFIX = "group:";
  private static readonly GROUP_MEMBERS_PREFIX = "group:members:";
  private static readonly GROUP_SEARCH_PREFIX = "group:search:";
  private static readonly GROUP_PUBLIC_PREFIX = "group:public:";
  private static readonly GROUP_EVENTS_PREFIX = "group:events:";
  private static readonly GROUP_USER_PREFIX = "group:user:";
  private static readonly RECENT_GROUPS_PREFIX = "recent_groups:";
  private static readonly NEARBY_GROUPS_PREFIX = "nearby_groups:";

  // Cache TTLs
  private static readonly GROUP_TTL = 300; // 5 minutes
  private static readonly GROUP_SEARCH_TTL = 60; // 1 minute
  private static readonly GROUP_MEMBERS_TTL = 300; // 5 minutes
  private static readonly GROUP_EVENTS_TTL = 300; // 5 minutes
  private static readonly CACHE_TTL = 5 * 60; // 5 minutes

  // Group data caching
  static async getGroup(groupId: string): Promise<Group | null> {
    return this.get<Group>(`${this.GROUP_PREFIX}${groupId}`, {
      useMemoryCache: true,
      ttlSeconds: this.GROUP_TTL,
    });
  }

  static async setGroup(
    group: Group,
    ttlSeconds: number = this.GROUP_TTL,
  ): Promise<void> {
    await this.set(`${this.GROUP_PREFIX}${group.id}`, group, {
      useMemoryCache: true,
      ttlSeconds,
    });
  }

  // Group members caching
  static async getGroupMembers(
    groupId: string,
    status: GroupMembershipStatus,
    params: CursorPaginationParams,
  ): Promise<{
    memberships: GroupMembership[];
    nextCursor?: string;
    prevCursor?: string;
  } | null> {
    const { cursor, limit = 10, direction = "forward" } = params;
    const cacheKey = `${this.GROUP_MEMBERS_PREFIX}${groupId}:${status}:${cursor || "start"}:${limit}:${direction}`;

    return this.get(cacheKey, {
      useMemoryCache: true,
      ttlSeconds: this.GROUP_MEMBERS_TTL,
    });
  }

  static async setGroupMembers(
    groupId: string,
    status: GroupMembershipStatus,
    params: CursorPaginationParams,
    data: {
      memberships: GroupMembership[];
      nextCursor?: string;
      prevCursor?: string;
    },
    ttlSeconds: number = this.GROUP_MEMBERS_TTL,
  ): Promise<void> {
    const { cursor, limit = 10, direction = "forward" } = params;
    const cacheKey = `${this.GROUP_MEMBERS_PREFIX}${groupId}:${status}:${cursor || "start"}:${limit}:${direction}`;

    await this.set(cacheKey, data, {
      useMemoryCache: true,
      ttlSeconds,
    });
  }

  // Group search caching
  static async getGroupSearch(params: SearchGroupsParams): Promise<{
    groups: Group[];
    nextCursor?: string;
    prevCursor?: string;
  } | null> {
    const {
      query,
      categoryId,
      cursor,
      limit = 10,
      direction = "forward",
    } = params;
    const cacheKey = `${this.GROUP_SEARCH_PREFIX}${query}:${categoryId || "all"}:${cursor || "start"}:${limit}:${direction}`;

    return this.get(cacheKey, {
      useMemoryCache: false,
      ttlSeconds: this.GROUP_SEARCH_TTL,
    });
  }

  static async setGroupSearch(
    params: SearchGroupsParams,
    data: {
      groups: Group[];
      nextCursor?: string;
      prevCursor?: string;
    },
    ttlSeconds: number = this.GROUP_SEARCH_TTL,
  ): Promise<void> {
    const {
      query,
      categoryId,
      cursor,
      limit = 10,
      direction = "forward",
    } = params;
    const cacheKey = `${this.GROUP_SEARCH_PREFIX}${query}:${categoryId || "all"}:${cursor || "start"}:${limit}:${direction}`;

    await this.set(cacheKey, data, {
      useMemoryCache: false,
      ttlSeconds,
    });
  }

  // Public groups caching
  static async getPublicGroups(
    params: CursorPaginationParams & { categoryId?: string },
  ): Promise<{
    groups: Group[];
    nextCursor?: string;
    prevCursor?: string;
  } | null> {
    const { categoryId, cursor, limit = 10, direction = "forward" } = params;
    const cacheKey = `${this.GROUP_PUBLIC_PREFIX}${categoryId || "all"}:${cursor || "start"}:${limit}:${direction}`;

    return this.get(cacheKey, {
      useMemoryCache: false,
      ttlSeconds: this.GROUP_TTL,
    });
  }

  static async setPublicGroups(
    params: CursorPaginationParams & { categoryId?: string },
    data: {
      groups: Group[];
      nextCursor?: string;
      prevCursor?: string;
    },
    ttlSeconds: number = this.GROUP_TTL,
  ): Promise<void> {
    const { categoryId, cursor, limit = 10, direction = "forward" } = params;
    const cacheKey = `${this.GROUP_PUBLIC_PREFIX}${categoryId || "all"}:${cursor || "start"}:${limit}:${direction}`;

    await this.set(cacheKey, data, {
      useMemoryCache: false,
      ttlSeconds,
    });
  }

  // User groups caching
  static async getUserGroups(
    userId: string,
    params: CursorPaginationParams,
  ): Promise<{
    groups: Group[];
    nextCursor?: string;
    prevCursor?: string;
  } | null> {
    const { cursor, limit = 10, direction = "forward" } = params;
    const cacheKey = `${this.GROUP_USER_PREFIX}${userId}:${cursor || "start"}:${limit}:${direction}`;

    return this.get(cacheKey, {
      useMemoryCache: true,
      ttlSeconds: this.GROUP_TTL,
    });
  }

  static async setUserGroups(
    userId: string,
    params: CursorPaginationParams,
    data: {
      groups: Group[];
      nextCursor?: string;
      prevCursor?: string;
    },
    ttlSeconds: number = this.GROUP_TTL,
  ): Promise<void> {
    const { cursor, limit = 10, direction = "forward" } = params;
    const cacheKey = `${this.GROUP_USER_PREFIX}${userId}:${cursor || "start"}:${limit}:${direction}`;

    await this.set(cacheKey, data, {
      useMemoryCache: true,
      ttlSeconds,
    });
  }

  // Group events caching
  static async getGroupEvents(
    groupId: string,
    params: GetGroupEventsParams,
  ): Promise<{
    events: Event[];
    nextCursor?: string;
    prevCursor?: string;
  } | null> {
    const {
      query,
      categoryId,
      cursor,
      limit = 10,
      direction = "forward",
      startDate,
      endDate,
    } = params;
    const cacheKey = `${this.GROUP_EVENTS_PREFIX}${groupId}:${query || "all"}:${categoryId || "all"}:${cursor || "start"}:${limit}:${direction}:${startDate?.toISOString() || "all"}:${endDate?.toISOString() || "all"}`;

    return this.get(cacheKey, {
      useMemoryCache: false,
      ttlSeconds: this.GROUP_EVENTS_TTL,
    });
  }

  static async setGroupEvents(
    groupId: string,
    params: GetGroupEventsParams,
    data: {
      events: Event[];
      nextCursor?: string;
      prevCursor?: string;
    },
    ttlSeconds: number = this.GROUP_EVENTS_TTL,
  ): Promise<void> {
    const {
      query,
      categoryId,
      cursor,
      limit = 10,
      direction = "forward",
      startDate,
      endDate,
    } = params;
    const cacheKey = `${this.GROUP_EVENTS_PREFIX}${groupId}:${query || "all"}:${categoryId || "all"}:${cursor || "start"}:${limit}:${direction}:${startDate?.toISOString() || "all"}:${endDate?.toISOString() || "all"}`;

    await this.set(cacheKey, data, {
      useMemoryCache: false,
      ttlSeconds,
    });
  }

  // Cache invalidation methods
  static async invalidateGroup(groupId: string): Promise<void> {
    const patterns = [
      `${this.GROUP_PREFIX}${groupId}`,
      `${this.GROUP_PUBLIC_PREFIX}*`,
      `${this.GROUP_USER_PREFIX}*`,
      `${this.GROUP_MEMBERS_PREFIX}${groupId}:*`,
      `${this.GROUP_EVENTS_PREFIX}${groupId}:*`,
      `${this.GROUP_SEARCH_PREFIX}*`,
      `${this.RECENT_GROUPS_PREFIX}*`,
      `${this.NEARBY_GROUPS_PREFIX}*`,
    ];

    await Promise.all(
      patterns.map((pattern) => this.invalidateByPattern(pattern)),
    );
  }

  static async invalidateUserGroups(userId: string): Promise<void> {
    await this.invalidateByPattern(`${this.GROUP_USER_PREFIX}${userId}:*`);
  }

  static async invalidateSearchCaches(): Promise<void> {
    await this.invalidateByPattern(`${this.GROUP_SEARCH_PREFIX}*`);
  }

  static async invalidateRecentGroupsCache(): Promise<void> {
    await this.invalidateByPattern(`${this.RECENT_GROUPS_PREFIX}*`);
  }

  static async invalidateNearbyGroupsCache(): Promise<void> {
    await this.invalidateByPattern(`${this.NEARBY_GROUPS_PREFIX}*`);
  }

  static async invalidateAllGroupCaches(): Promise<void> {
    const patterns = [
      this.GROUP_PREFIX,
      this.GROUP_MEMBERS_PREFIX,
      this.GROUP_SEARCH_PREFIX,
      this.GROUP_PUBLIC_PREFIX,
      this.GROUP_EVENTS_PREFIX,
      this.GROUP_USER_PREFIX,
      this.RECENT_GROUPS_PREFIX,
      this.NEARBY_GROUPS_PREFIX,
    ];

    await Promise.all(
      patterns.map((pattern) => this.invalidateByPattern(`${pattern}*`)),
    );
  }

  static async getRecentGroups(
    params: {
      categoryId?: string;
      minMemberCount?: number;
      maxDistance?: number;
      userCoordinates?: { lat: number; lng: number };
      cursor?: string;
      limit?: number;
      direction?: "forward" | "backward";
    } = {},
  ): Promise<{
    groups: Group[];
    nextCursor?: string;
    prevCursor?: string;
  } | null> {
    const cacheKey =
      this.RECENT_GROUPS_PREFIX +
      (Object.keys(params).length > 0
        ? this.generateCacheKey(params as Record<string, unknown>)
        : "default");
    const cached = await this.get<string>(cacheKey, {
      useMemoryCache: true,
      ttlSeconds: this.CACHE_TTL,
    });
    return cached ? JSON.parse(cached) : null;
  }

  static async setRecentGroups(
    params: {
      categoryId?: string;
      minMemberCount?: number;
      maxDistance?: number;
      userCoordinates?: { lat: number; lng: number };
      cursor?: string;
      limit?: number;
      direction?: "forward" | "backward";
    },
    data: {
      groups: Group[];
      nextCursor?: string;
      prevCursor?: string;
    },
  ): Promise<void> {
    const cacheKey = this.RECENT_GROUPS_PREFIX + this.generateCacheKey(params);
    await this.set(cacheKey, JSON.stringify(data), {
      useMemoryCache: true,
      ttlSeconds: this.CACHE_TTL,
    });
  }

  static async getNearbyGroups(params: {
    coordinates: { lat: number; lng: number };
    maxDistance?: number;
    categoryId?: string;
    minMemberCount?: number;
    cursor?: string;
    limit?: number;
    direction?: "forward" | "backward";
  }): Promise<{
    groups: GroupWithDistance[];
    nextCursor?: string;
    prevCursor?: string;
  } | null> {
    const cacheKey = this.NEARBY_GROUPS_PREFIX + this.generateCacheKey(params);
    return this.get(cacheKey, {
      useMemoryCache: true,
      ttlSeconds: this.CACHE_TTL,
    });
  }

  static async setNearbyGroups(
    params: {
      coordinates: { lat: number; lng: number };
      maxDistance?: number;
      categoryId?: string;
      minMemberCount?: number;
      cursor?: string;
      limit?: number;
      direction?: "forward" | "backward";
    },
    data: {
      groups: GroupWithDistance[];
      nextCursor?: string;
      prevCursor?: string;
    },
  ): Promise<void> {
    const cacheKey = this.NEARBY_GROUPS_PREFIX + this.generateCacheKey(params);
    await this.set(cacheKey, data, {
      useMemoryCache: true,
      ttlSeconds: this.CACHE_TTL,
    });
  }

  private static generateCacheKey(params: Record<string, unknown>): string {
    return Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
      .join("|");
  }
}
