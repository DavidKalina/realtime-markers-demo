import { Category } from "@realtime-markers/database";
import { createCacheService } from "./CacheService";
import { Redis } from "ioredis";

export interface CategoryCacheService {
  getCategory(id: string): Promise<Category | null>;
  setCategory(category: Category, ttlSeconds?: number): Promise<void>;
  invalidateCategory(id: string): Promise<void>;
  getCategoryList(): Promise<Category[] | null>;
  setCategoryList(categories: Category[], ttlSeconds?: number): Promise<void>;
  invalidateCategoryList(): Promise<void>;
  invalidateAllCategories(): Promise<void>;
}

export class CategoryCacheServiceImpl implements CategoryCacheService {
  private static readonly CACHE_PREFIX = "category:";
  private static readonly LIST_PREFIX = "category-list:";
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly SHORT_TTL = 300; // 5 minutes
  private cacheService: ReturnType<typeof createCacheService>;

  constructor(cacheService: ReturnType<typeof createCacheService>) {
    this.cacheService = cacheService;
  }

  async getCategory(id: string): Promise<Category | null> {
    return this.cacheService.get<Category>(
      `${CategoryCacheServiceImpl.CACHE_PREFIX}${id}`,
      {
        useMemoryCache: true,
        ttlSeconds: CategoryCacheServiceImpl.DEFAULT_TTL,
      },
    );
  }

  async setCategory(
    category: Category,
    ttlSeconds: number = CategoryCacheServiceImpl.DEFAULT_TTL,
  ): Promise<void> {
    await this.cacheService.set(
      `${CategoryCacheServiceImpl.CACHE_PREFIX}${category.id}`,
      category,
      {
        useMemoryCache: true,
        ttlSeconds,
      },
    );
  }

  async invalidateCategory(id: string): Promise<void> {
    await this.cacheService.invalidate(
      `${CategoryCacheServiceImpl.CACHE_PREFIX}${id}`,
    );
  }

  async getCategoryList(): Promise<Category[] | null> {
    return this.cacheService.get<Category[]>(
      `${CategoryCacheServiceImpl.LIST_PREFIX}all`,
      {
        useMemoryCache: true,
        ttlSeconds: CategoryCacheServiceImpl.DEFAULT_TTL,
      },
    );
  }

  async setCategoryList(
    categories: Category[],
    ttlSeconds: number = CategoryCacheServiceImpl.DEFAULT_TTL,
  ): Promise<void> {
    await this.cacheService.set(
      `${CategoryCacheServiceImpl.LIST_PREFIX}all`,
      categories,
      {
        useMemoryCache: true,
        ttlSeconds,
      },
    );
  }

  async invalidateCategoryList(): Promise<void> {
    await this.cacheService.invalidate(
      `${CategoryCacheServiceImpl.LIST_PREFIX}all`,
    );
  }

  async invalidateAllCategories(): Promise<void> {
    // Invalidate both individual categories and the category list
    await Promise.all([
      this.cacheService.invalidateByPattern(
        `${CategoryCacheServiceImpl.CACHE_PREFIX}*`,
      ),
      this.invalidateCategoryList(),
    ]);
  }
}

/**
 * Factory function to create a CategoryCacheService instance
 */
export function createCategoryCacheService(
  redis?: Redis,
): CategoryCacheService {
  const cacheService = createCacheService(redis);
  return new CategoryCacheServiceImpl(cacheService);
}
