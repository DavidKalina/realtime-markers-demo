import { Category } from "../../entities/Category";
import { CacheService } from "./CacheService";

export class CategoryCacheService extends CacheService {
  private static readonly CACHE_PREFIX = "category:";
  private static readonly LIST_PREFIX = "category-list:";
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly SHORT_TTL = 300; // 5 minutes

  static async getCategory(id: string): Promise<Category | null> {
    return this.get<Category>(`${this.CACHE_PREFIX}${id}`, {
      useMemoryCache: true,
      ttlSeconds: this.DEFAULT_TTL,
    });
  }

  static async setCategory(
    category: Category,
    ttlSeconds: number = this.DEFAULT_TTL,
  ): Promise<void> {
    await this.set(`${this.CACHE_PREFIX}${category.id}`, category, {
      useMemoryCache: true,
      ttlSeconds,
    });
  }

  static async invalidateCategory(id: string): Promise<void> {
    await this.invalidate(`${this.CACHE_PREFIX}${id}`);
  }

  static async getCategoryList(): Promise<Category[] | null> {
    return this.get<Category[]>(`${this.LIST_PREFIX}all`, {
      useMemoryCache: true,
      ttlSeconds: this.DEFAULT_TTL,
    });
  }

  static async setCategoryList(
    categories: Category[],
    ttlSeconds: number = this.DEFAULT_TTL,
  ): Promise<void> {
    await this.set(`${this.LIST_PREFIX}all`, categories, {
      useMemoryCache: true,
      ttlSeconds,
    });
  }

  static async invalidateCategoryList(): Promise<void> {
    await this.invalidate(`${this.LIST_PREFIX}all`);
  }

  static async invalidateAllCategories(): Promise<void> {
    // Invalidate both individual categories and the category list
    await Promise.all([
      this.invalidateByPattern(`${this.CACHE_PREFIX}*`),
      this.invalidateCategoryList(),
    ]);
  }
}
