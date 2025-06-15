import { Level } from "../../entities/Level";
import { createCacheService } from "./CacheService";
import { Redis } from "ioredis";

interface UserLevelInfo {
  currentLevel: number;
  currentTitle: string;
  totalXp: number;
  nextLevelXp: number;
  progress: number;
}

export interface LevelingCacheService {
  getLevels(): Promise<Level[] | null>;
  setLevels(levels: Level[]): Promise<void>;
  getUserLevelInfo(userId: string): Promise<UserLevelInfo | null>;
  setUserLevelInfo(userId: string, info: UserLevelInfo): Promise<void>;
  getUserXp(userId: string): Promise<number | null>;
  setUserXp(userId: string, xp: number): Promise<void>;
  invalidateUserCaches(userId: string): Promise<void>;
  invalidateLevelCaches(): Promise<void>;
}

export class LevelingCacheServiceImpl implements LevelingCacheService {
  private static readonly LEVELS_PREFIX = "levels:";
  private static readonly USER_LEVEL_PREFIX = "user_level:";
  private static readonly USER_XP_PREFIX = "user_xp:";
  private static readonly DEFAULT_TTL = 300; // 5 minutes
  private static readonly LEVELS_TTL = 3600; // 1 hour
  private cacheService: ReturnType<typeof createCacheService>;

  constructor(cacheService: ReturnType<typeof createCacheService>) {
    this.cacheService = cacheService;
  }

  /**
   * Get all levels with caching
   */
  async getLevels(): Promise<Level[] | null> {
    return this.cacheService.get<Level[]>(
      `${LevelingCacheServiceImpl.LEVELS_PREFIX}all`,
      {
        useMemoryCache: true,
        ttlSeconds: LevelingCacheServiceImpl.LEVELS_TTL,
      },
    );
  }

  /**
   * Cache all levels
   */
  async setLevels(levels: Level[]): Promise<void> {
    await this.cacheService.set(
      `${LevelingCacheServiceImpl.LEVELS_PREFIX}all`,
      levels,
      {
        useMemoryCache: true,
        ttlSeconds: LevelingCacheServiceImpl.LEVELS_TTL,
      },
    );
  }

  /**
   * Get user's level information
   */
  async getUserLevelInfo(userId: string): Promise<UserLevelInfo | null> {
    return this.cacheService.get<UserLevelInfo>(
      `${LevelingCacheServiceImpl.USER_LEVEL_PREFIX}${userId}`,
      {
        useMemoryCache: true,
        ttlSeconds: LevelingCacheServiceImpl.DEFAULT_TTL,
      },
    );
  }

  /**
   * Cache user's level information
   */
  async setUserLevelInfo(userId: string, info: UserLevelInfo): Promise<void> {
    await this.cacheService.set(
      `${LevelingCacheServiceImpl.USER_LEVEL_PREFIX}${userId}`,
      info,
      {
        useMemoryCache: true,
        ttlSeconds: LevelingCacheServiceImpl.DEFAULT_TTL,
      },
    );
  }

  /**
   * Get user's XP
   */
  async getUserXp(userId: string): Promise<number | null> {
    return this.cacheService.get<number>(
      `${LevelingCacheServiceImpl.USER_XP_PREFIX}${userId}`,
      {
        useMemoryCache: true,
        ttlSeconds: LevelingCacheServiceImpl.DEFAULT_TTL,
      },
    );
  }

  /**
   * Cache user's XP
   */
  async setUserXp(userId: string, xp: number): Promise<void> {
    await this.cacheService.set(
      `${LevelingCacheServiceImpl.USER_XP_PREFIX}${userId}`,
      xp,
      {
        useMemoryCache: true,
        ttlSeconds: LevelingCacheServiceImpl.DEFAULT_TTL,
      },
    );
  }

  /**
   * Invalidate all caches for a user
   */
  async invalidateUserCaches(userId: string): Promise<void> {
    await Promise.all([
      this.cacheService.invalidate(
        `${LevelingCacheServiceImpl.USER_LEVEL_PREFIX}${userId}`,
      ),
      this.cacheService.invalidate(
        `${LevelingCacheServiceImpl.USER_XP_PREFIX}${userId}`,
      ),
    ]);
  }

  /**
   * Invalidate all level caches
   */
  async invalidateLevelCaches(): Promise<void> {
    await this.cacheService.invalidate(
      `${LevelingCacheServiceImpl.LEVELS_PREFIX}all`,
    );
  }
}

/**
 * Factory function to create a LevelingCacheService instance
 */
export function createLevelingCacheService(
  redis?: Redis,
): LevelingCacheService {
  const cacheService = createCacheService(redis);
  return new LevelingCacheServiceImpl(cacheService);
}
