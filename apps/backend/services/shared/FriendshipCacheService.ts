import { User } from "../../entities/User";
import { Friendship } from "../../entities/Friendship";
import { createCacheService } from "./CacheService";
import { Redis } from "ioredis";

type FriendRequestType = "incoming" | "outgoing";

export interface FriendshipCacheService {
  getFriends(userId: string): Promise<User[] | null>;
  setFriends(
    userId: string,
    friends: User[],
    ttlSeconds?: number,
  ): Promise<void>;
  getFriendRequests(
    userId: string,
    type: FriendRequestType,
  ): Promise<Friendship[] | null>;
  setFriendRequests(
    userId: string,
    type: FriendRequestType,
    requests: Friendship[],
    ttlSeconds?: number,
  ): Promise<void>;
  invalidateUserCaches(userId: string): Promise<void>;
  invalidateFriendshipCaches(userId1: string, userId2: string): Promise<void>;
  invalidateAllFriendshipCaches(): Promise<void>;
}

export class FriendshipCacheServiceImpl implements FriendshipCacheService {
  private static readonly FRIENDS_PREFIX = "friends:";
  private static readonly FRIEND_REQUESTS_PREFIX = "friend-requests:";
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly SHORT_TTL = 300; // 5 minutes
  private cacheService: ReturnType<typeof createCacheService>;

  constructor(cacheService: ReturnType<typeof createCacheService>) {
    this.cacheService = cacheService;
  }

  async getFriends(userId: string): Promise<User[] | null> {
    return this.cacheService.get<User[]>(
      `${FriendshipCacheServiceImpl.FRIENDS_PREFIX}${userId}`,
      {
        useMemoryCache: true,
        ttlSeconds: FriendshipCacheServiceImpl.DEFAULT_TTL,
      },
    );
  }

  async setFriends(
    userId: string,
    friends: User[],
    ttlSeconds: number = FriendshipCacheServiceImpl.DEFAULT_TTL,
  ): Promise<void> {
    await this.cacheService.set(
      `${FriendshipCacheServiceImpl.FRIENDS_PREFIX}${userId}`,
      friends,
      {
        useMemoryCache: true,
        ttlSeconds,
      },
    );
  }

  async getFriendRequests(
    userId: string,
    type: FriendRequestType,
  ): Promise<Friendship[] | null> {
    return this.cacheService.get<Friendship[]>(
      `${FriendshipCacheServiceImpl.FRIEND_REQUESTS_PREFIX}${userId}:${type}`,
      {
        useMemoryCache: true,
        ttlSeconds: FriendshipCacheServiceImpl.SHORT_TTL,
      },
    );
  }

  async setFriendRequests(
    userId: string,
    type: FriendRequestType,
    requests: Friendship[],
    ttlSeconds: number = FriendshipCacheServiceImpl.SHORT_TTL,
  ): Promise<void> {
    await this.cacheService.set(
      `${FriendshipCacheServiceImpl.FRIEND_REQUESTS_PREFIX}${userId}:${type}`,
      requests,
      {
        useMemoryCache: true,
        ttlSeconds,
      },
    );
  }

  async invalidateUserCaches(userId: string): Promise<void> {
    await Promise.all([
      this.cacheService.invalidate(
        `${FriendshipCacheServiceImpl.FRIENDS_PREFIX}${userId}`,
      ),
      this.cacheService.invalidate(
        `${FriendshipCacheServiceImpl.FRIEND_REQUESTS_PREFIX}${userId}:incoming`,
      ),
      this.cacheService.invalidate(
        `${FriendshipCacheServiceImpl.FRIEND_REQUESTS_PREFIX}${userId}:outgoing`,
      ),
    ]);
  }

  async invalidateFriendshipCaches(
    userId1: string,
    userId2: string,
  ): Promise<void> {
    await Promise.all([
      this.invalidateUserCaches(userId1),
      this.invalidateUserCaches(userId2),
    ]);
  }

  async invalidateAllFriendshipCaches(): Promise<void> {
    await Promise.all([
      this.cacheService.invalidateByPattern(
        `${FriendshipCacheServiceImpl.FRIENDS_PREFIX}*`,
      ),
      this.cacheService.invalidateByPattern(
        `${FriendshipCacheServiceImpl.FRIEND_REQUESTS_PREFIX}*`,
      ),
    ]);
  }
}

/**
 * Factory function to create a FriendshipCacheService instance
 */
export function createFriendshipCacheService(
  redis?: Redis,
): FriendshipCacheService {
  const cacheService = createCacheService(redis);
  return new FriendshipCacheServiceImpl(cacheService);
}
