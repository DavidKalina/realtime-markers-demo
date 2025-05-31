import { CacheService } from "./CacheService";
import type { ImageProcessingResult } from "../event-processing/dto/ImageProcessingResult";
import type { MultiEventProcessingResult } from "../event-processing/ImageProcessingService";

export class ImageProcessingCacheService extends CacheService {
  private static readonly CACHE_PREFIX = "vision:";
  private static readonly MULTI_EVENT_PREFIX = "multi-vision:";
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

  /**
   * Get cached multi-event processing result
   */
  static async getMultiEventResult(
    cacheKey: string,
  ): Promise<MultiEventProcessingResult | null> {
    return this.get<MultiEventProcessingResult>(
      `${this.MULTI_EVENT_PREFIX}${cacheKey}`,
      {
        useMemoryCache: false,
        ttlSeconds: this.DEFAULT_TTL,
      },
    );
  }

  /**
   * Cache multi-event processing result
   */
  static async setMultiEventResult(
    cacheKey: string,
    result: MultiEventProcessingResult,
    ttlSeconds: number = this.DEFAULT_TTL,
  ): Promise<void> {
    await this.set(`${this.MULTI_EVENT_PREFIX}${cacheKey}`, result, {
      useMemoryCache: false,
      ttlSeconds,
    });
  }

  /**
   * Invalidate cached multi-event processing result
   */
  static async invalidateMultiEventResult(cacheKey: string): Promise<void> {
    await this.invalidate(`${this.MULTI_EVENT_PREFIX}${cacheKey}`);
  }

  /**
   * Invalidate all cached multi-event processing results
   */
  static async invalidateAllMultiEventResults(): Promise<void> {
    await this.invalidateByPattern(`${this.MULTI_EVENT_PREFIX}*`);
  }
}
