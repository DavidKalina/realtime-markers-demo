import { CacheServiceImpl } from "./CacheService";
import type { ImageProcessingResult } from "../event-processing/dto/ImageProcessingResult";
import type { MultiEventProcessingResult } from "../event-processing/ImageProcessingService";

export interface ImageProcessingCacheService {
  getProcessingResult(cacheKey: string): Promise<ImageProcessingResult | null>;
  setProcessingResult(
    cacheKey: string,
    result: ImageProcessingResult,
    ttlSeconds?: number,
  ): Promise<void>;
  invalidateProcessingResult(cacheKey: string): Promise<void>;
  invalidateAllProcessingResults(): Promise<void>;
  getMultiEventResult(
    cacheKey: string,
  ): Promise<MultiEventProcessingResult | null>;
  setMultiEventResult(
    cacheKey: string,
    result: MultiEventProcessingResult,
    ttlSeconds?: number,
  ): Promise<void>;
  invalidateMultiEventResult(cacheKey: string): Promise<void>;
  invalidateAllMultiEventResults(): Promise<void>;
}

export class ImageProcessingCacheServiceImpl
  extends CacheServiceImpl
  implements ImageProcessingCacheService
{
  private static readonly CACHE_PREFIX = "vision:";
  private static readonly MULTI_EVENT_PREFIX = "multi-vision:";
  private static readonly DEFAULT_TTL = 24 * 60 * 60; // 24 hours in seconds

  /**
   * Get cached image processing result
   */
  async getProcessingResult(
    cacheKey: string,
  ): Promise<ImageProcessingResult | null> {
    return this.get<ImageProcessingResult>(
      `${ImageProcessingCacheServiceImpl.CACHE_PREFIX}${cacheKey}`,
      {
        useMemoryCache: false,
        ttlSeconds: ImageProcessingCacheServiceImpl.DEFAULT_TTL,
      },
    );
  }

  /**
   * Cache image processing result
   */
  async setProcessingResult(
    cacheKey: string,
    result: ImageProcessingResult,
    ttlSeconds: number = ImageProcessingCacheServiceImpl.DEFAULT_TTL,
  ): Promise<void> {
    await this.set(
      `${ImageProcessingCacheServiceImpl.CACHE_PREFIX}${cacheKey}`,
      result,
      {
        useMemoryCache: false,
        ttlSeconds,
      },
    );
  }

  /**
   * Invalidate cached processing result
   */
  async invalidateProcessingResult(cacheKey: string): Promise<void> {
    await this.invalidate(
      `${ImageProcessingCacheServiceImpl.CACHE_PREFIX}${cacheKey}`,
    );
  }

  /**
   * Invalidate all cached processing results
   */
  async invalidateAllProcessingResults(): Promise<void> {
    await this.invalidateByPattern(
      `${ImageProcessingCacheServiceImpl.CACHE_PREFIX}*`,
    );
  }

  /**
   * Get cached multi-event processing result
   */
  async getMultiEventResult(
    cacheKey: string,
  ): Promise<MultiEventProcessingResult | null> {
    return this.get<MultiEventProcessingResult>(
      `${ImageProcessingCacheServiceImpl.MULTI_EVENT_PREFIX}${cacheKey}`,
      {
        useMemoryCache: false,
        ttlSeconds: ImageProcessingCacheServiceImpl.DEFAULT_TTL,
      },
    );
  }

  /**
   * Cache multi-event processing result
   */
  async setMultiEventResult(
    cacheKey: string,
    result: MultiEventProcessingResult,
    ttlSeconds: number = ImageProcessingCacheServiceImpl.DEFAULT_TTL,
  ): Promise<void> {
    await this.set(
      `${ImageProcessingCacheServiceImpl.MULTI_EVENT_PREFIX}${cacheKey}`,
      result,
      {
        useMemoryCache: false,
        ttlSeconds,
      },
    );
  }

  /**
   * Invalidate cached multi-event processing result
   */
  async invalidateMultiEventResult(cacheKey: string): Promise<void> {
    await this.invalidate(
      `${ImageProcessingCacheServiceImpl.MULTI_EVENT_PREFIX}${cacheKey}`,
    );
  }

  /**
   * Invalidate all cached multi-event processing results
   */
  async invalidateAllMultiEventResults(): Promise<void> {
    await this.invalidateByPattern(
      `${ImageProcessingCacheServiceImpl.MULTI_EVENT_PREFIX}*`,
    );
  }
}

/**
 * Factory function to create an ImageProcessingCacheService instance
 */
export function createImageProcessingCacheService(): ImageProcessingCacheService {
  return new ImageProcessingCacheServiceImpl();
}
