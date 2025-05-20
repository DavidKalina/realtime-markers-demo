import { CacheService } from "./CacheService";
import type { ImageProcessingResult } from "../event-processing/dto/ImageProcessingResult";

export class ImageProcessingCacheService extends CacheService {
  private static readonly CACHE_PREFIX = "vision:";
  private static readonly DEFAULT_TTL = 24 * 60 * 60; // 24 hours in seconds

  /**
   * Get cached image processing result
   */
  static async getProcessingResult(
    cacheKey: string,
  ): Promise<ImageProcessingResult | null> {
    return this.get<ImageProcessingResult>(`${this.CACHE_PREFIX}${cacheKey}`, {
      useMemoryCache: false,
      ttlSeconds: this.DEFAULT_TTL,
    });
  }

  /**
   * Cache image processing result
   */
  static async setProcessingResult(
    cacheKey: string,
    result: ImageProcessingResult,
    ttlSeconds: number = this.DEFAULT_TTL,
  ): Promise<void> {
    await this.set(`${this.CACHE_PREFIX}${cacheKey}`, result, {
      useMemoryCache: false,
      ttlSeconds,
    });
  }

  /**
   * Invalidate cached processing result
   */
  static async invalidateProcessingResult(cacheKey: string): Promise<void> {
    await this.invalidate(`${this.CACHE_PREFIX}${cacheKey}`);
  }

  /**
   * Invalidate all cached processing results
   */
  static async invalidateAllProcessingResults(): Promise<void> {
    await this.invalidateByPattern(`${this.CACHE_PREFIX}*`);
  }
}
