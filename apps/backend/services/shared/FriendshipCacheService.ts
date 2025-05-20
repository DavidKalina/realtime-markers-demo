import { User } from "../../entities/User";
import { Friendship } from "../../entities/Friendship";
import { CacheService } from "./CacheService";

type FriendRequestType = "incoming" | "outgoing";

export class FriendshipCacheService extends CacheService {
  private static readonly FRIENDS_PREFIX = "friends:";
  private static readonly FRIEND_REQUESTS_PREFIX = "friend-requests:";
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly SHORT_TTL = 300; // 5 minutes

  static async getFriends(userId: string): Promise<User[] | null> {
    return this.get<User[]>(`${this.FRIENDS_PREFIX}${userId}`, {
      useMemoryCache: true,
      ttlSeconds: this.DEFAULT_TTL,
    });
  }

  static async setFriends(
    userId: string,
    friends: User[],
    ttlSeconds: number = this.DEFAULT_TTL,
  ): Promise<void> {
    await this.set(`${this.FRIENDS_PREFIX}${userId}`, friends, {
      useMemoryCache: true,
      ttlSeconds,
    });
  }

  static async getFriendRequests(
    userId: string,
    type: FriendRequestType,
  ): Promise<Friendship[] | null> {
    return this.get<Friendship[]>(
      `${this.FRIEND_REQUESTS_PREFIX}${userId}:${type}`,
      {
        useMemoryCache: true,
        ttlSeconds: this.SHORT_TTL,
      },
    );
  }

  static async setFriendRequests(
    userId: string,
    type: FriendRequestType,
    requests: Friendship[],
    ttlSeconds: number = this.SHORT_TTL,
  ): Promise<void> {
    await this.set(
      `${this.FRIEND_REQUESTS_PREFIX}${userId}:${type}`,
      requests,
      {
        useMemoryCache: true,
        ttlSeconds,
      },
    );
  }

  static async invalidateUserCaches(userId: string): Promise<void> {
    await Promise.all([
      this.invalidate(`${this.FRIENDS_PREFIX}${userId}`),
      this.invalidate(`${this.FRIEND_REQUESTS_PREFIX}${userId}:incoming`),
      this.invalidate(`${this.FRIEND_REQUESTS_PREFIX}${userId}:outgoing`),
    ]);
  }

  static async invalidateFriendshipCaches(
    userId1: string,
    userId2: string,
  ): Promise<void> {
    await Promise.all([
      this.invalidateUserCaches(userId1),
      this.invalidateUserCaches(userId2),
    ]);
  }

  static async invalidateAllFriendshipCaches(): Promise<void> {
    await Promise.all([
      this.invalidateByPattern(`${this.FRIENDS_PREFIX}*`),
      this.invalidateByPattern(`${this.FRIEND_REQUESTS_PREFIX}*`),
    ]);
  }
}
