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

export class GroupCacheService extends CacheService {
  private static readonly GROUP_PREFIX = "group:";
  private static readonly GROUP_MEMBERS_PREFIX = "group:members:";
  private static readonly GROUP_SEARCH_PREFIX = "group:search:";
  private static readonly GROUP_PUBLIC_PREFIX = "group:public:";
  private static readonly GROUP_EVENTS_PREFIX = "group:events:";
  private static readonly GROUP_USER_PREFIX = "group:user:";

  // Cache TTLs
  private static readonly GROUP_TTL = 300; // 5 minutes
  private static readonly GROUP_SEARCH_TTL = 60; // 1 minute
  private static readonly GROUP_MEMBERS_TTL = 300; // 5 minutes
  private static readonly GROUP_EVENTS_TTL = 300; // 5 minutes

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
      `${this.GROUP_MEMBERS_PREFIX}${groupId}:*`,
      `${this.GROUP_EVENTS_PREFIX}${groupId}:*`,
    ];

    await Promise.all(
      patterns.map((pattern) => this.invalidateByPattern(pattern)),
    );
  }

  static async invalidateUserGroups(userId: string): Promise<void> {
    await this.invalidateByPattern(`${this.GROUP_USER_PREFIX}${userId}:*`);
  }

  static async invalidateSearchCaches(): Promise<void> {
    await Promise.all([
      this.invalidateByPattern(`${this.GROUP_SEARCH_PREFIX}*`),
      this.invalidateByPattern(`${this.GROUP_PUBLIC_PREFIX}*`),
    ]);
  }

  static async invalidateAllGroupCaches(): Promise<void> {
    await Promise.all([
      this.invalidateByPattern(`${this.GROUP_PREFIX}*`),
      this.invalidateByPattern(`${this.GROUP_MEMBERS_PREFIX}*`),
      this.invalidateByPattern(`${this.GROUP_SEARCH_PREFIX}*`),
      this.invalidateByPattern(`${this.GROUP_PUBLIC_PREFIX}*`),
      this.invalidateByPattern(`${this.GROUP_EVENTS_PREFIX}*`),
      this.invalidateByPattern(`${this.GROUP_USER_PREFIX}*`),
    ]);
  }
}
