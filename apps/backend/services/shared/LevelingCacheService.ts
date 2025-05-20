import { Level } from "../../entities/Level";
import { CacheService } from "./CacheService";

interface UserLevelInfo {
  currentLevel: number;
  currentTitle: string;
  totalXp: number;
  nextLevelXp: number;
  progress: number;
}

export class LevelingCacheService extends CacheService {
  private static readonly LEVELS_PREFIX = "levels:";
  private static readonly USER_LEVEL_PREFIX = "user_level:";
  private static readonly USER_XP_PREFIX = "user_xp:";
  private static readonly DEFAULT_TTL = 300; // 5 minutes
  private static readonly LEVELS_TTL = 3600; // 1 hour

  /**
   * Get all levels with caching
   */
  static async getLevels(): Promise<Level[] | null> {
    return this.get<Level[]>(`${this.LEVELS_PREFIX}all`, {
      useMemoryCache: true,
      ttlSeconds: this.LEVELS_TTL,
    });
  }

  /**
   * Cache all levels
   */
  static async setLevels(levels: Level[]): Promise<void> {
    await this.set(`${this.LEVELS_PREFIX}all`, levels, {
      useMemoryCache: true,
      ttlSeconds: this.LEVELS_TTL,
    });
  }

  /**
   * Get user's level information
   */
  static async getUserLevelInfo(userId: string): Promise<UserLevelInfo | null> {
    return this.get<UserLevelInfo>(`${this.USER_LEVEL_PREFIX}${userId}`, {
      useMemoryCache: true,
      ttlSeconds: this.DEFAULT_TTL,
    });
  }

  /**
   * Cache user's level information
   */
  static async setUserLevelInfo(
    userId: string,
    info: UserLevelInfo,
  ): Promise<void> {
    await this.set(`${this.USER_LEVEL_PREFIX}${userId}`, info, {
      useMemoryCache: true,
      ttlSeconds: this.DEFAULT_TTL,
    });
  }

  /**
   * Get user's XP
   */
  static async getUserXp(userId: string): Promise<number | null> {
    return this.get<number>(`${this.USER_XP_PREFIX}${userId}`, {
      useMemoryCache: true,
      ttlSeconds: this.DEFAULT_TTL,
    });
  }

  /**
   * Cache user's XP
   */
  static async setUserXp(userId: string, xp: number): Promise<void> {
    await this.set(`${this.USER_XP_PREFIX}${userId}`, xp, {
      useMemoryCache: true,
      ttlSeconds: this.DEFAULT_TTL,
    });
  }

  /**
   * Invalidate all caches for a user
   */
  static async invalidateUserCaches(userId: string): Promise<void> {
    await Promise.all([
      this.invalidate(`${this.USER_LEVEL_PREFIX}${userId}`),
      this.invalidate(`${this.USER_XP_PREFIX}${userId}`),
    ]);
  }

  /**
   * Invalidate all level caches
   */
  static async invalidateLevelCaches(): Promise<void> {
    await this.invalidate(`${this.LEVELS_PREFIX}all`);
  }
}
