import AppDataSource from "../data-source";
import { Emoji } from "../entities/Emoji";
import { Like } from "typeorm";
import { CacheService } from "./shared/CacheService";

export class EmojiService {
  private emojiRepository = AppDataSource.getRepository(Emoji);
  private static readonly EMOJI_LIST_TTL = 300; // 5 minutes
  private static readonly EMOJI_TTL = 3600; // 1 hour

  async getEmojis(params: {
    searchQuery?: string;
    categoryId?: number | null;
    limit?: number;
    lastEmojiId?: number | null;
  }): Promise<Emoji[]> {
    console.log("[EmojiService] Getting emojis with params:", params);
    const { searchQuery, categoryId, limit = 20, lastEmojiId } = params;

    // Generate cache key based on parameters
    const cacheKey = `emojis:${searchQuery || ""}:${categoryId || ""}:${limit}:${
      lastEmojiId || ""
    }`;
    console.log("[EmojiService] Generated cache key:", cacheKey);

    // Try to get from cache first
    const cached = await CacheService.getCachedData(cacheKey);
    if (cached) {
      console.log("[EmojiService] Cache hit for key:", cacheKey);
      return JSON.parse(cached);
    }
    console.log("[EmojiService] Cache miss for key:", cacheKey);

    const queryBuilder = this.emojiRepository.createQueryBuilder("emoji");

    if (searchQuery) {
      console.log("[EmojiService] Adding search query filter:", searchQuery);
      queryBuilder.where(
        "(emoji.name ILIKE :searchQuery OR emoji.keywords::text ILIKE :searchQuery)",
        { searchQuery: `%${searchQuery}%` }
      );
    }

    if (categoryId !== undefined && categoryId !== null) {
      console.log("[EmojiService] Adding category filter:", categoryId);
      queryBuilder.andWhere("emoji.category_id = :categoryId", { categoryId });
    } else if (categoryId === null) {
      console.log("[EmojiService] Filtering for emojis with no category");
      queryBuilder.andWhere("emoji.category_id IS NULL");
    }

    if (lastEmojiId) {
      console.log("[EmojiService] Adding pagination filter:", lastEmojiId);
      queryBuilder.andWhere("emoji.id > :lastEmojiId", { lastEmojiId });
    }

    queryBuilder.orderBy("emoji.rank", "DESC").addOrderBy("emoji.id", "ASC").take(limit);

    console.log("[EmojiService] Executing query with SQL:", queryBuilder.getSql());
    const emojis = await queryBuilder.getMany();
    console.log("[EmojiService] Retrieved", emojis.length, "emojis");

    // Cache the results
    await CacheService.setCachedData(cacheKey, JSON.stringify(emojis), EmojiService.EMOJI_LIST_TTL);
    console.log("[EmojiService] Cached results for key:", cacheKey);

    return emojis;
  }

  async createEmoji(emojiData: {
    emoji: string;
    name: string;
    category_id?: string | null;
    keywords: string[];
    rank?: number;
  }): Promise<Emoji> {
    console.log("[EmojiService] Creating new emoji:", emojiData);
    const emoji = this.emojiRepository.create(emojiData);
    const savedEmoji = await this.emojiRepository.save(emoji);
    console.log("[EmojiService] Created emoji with ID:", savedEmoji.id);

    // Invalidate relevant caches
    await this.invalidateEmojiCaches();
    console.log("[EmojiService] Invalidated emoji caches after creation");

    return savedEmoji;
  }

  async updateEmoji(id: number, emojiData: Partial<Emoji>): Promise<Emoji | null> {
    console.log("[EmojiService] Updating emoji ID:", id, "with data:", emojiData);
    await this.emojiRepository.update(id, emojiData);
    const emoji = await this.emojiRepository.findOneBy({ id });

    if (emoji) {
      console.log("[EmojiService] Successfully updated emoji ID:", id);
      // Invalidate relevant caches
      await this.invalidateEmojiCaches();
      console.log("[EmojiService] Invalidated emoji caches after update");
    } else {
      console.log("[EmojiService] Emoji not found for update, ID:", id);
    }

    return emoji;
  }

  async deleteEmoji(id: number): Promise<boolean> {
    console.log("[EmojiService] Deleting emoji ID:", id);
    const result = await this.emojiRepository.delete(id);
    const success = (result.affected ?? 0) > 0;

    if (success) {
      console.log("[EmojiService] Successfully deleted emoji ID:", id);
      // Invalidate relevant caches
      await this.invalidateEmojiCaches();
      console.log("[EmojiService] Invalidated emoji caches after deletion");
    } else {
      console.log("[EmojiService] Emoji not found for deletion, ID:", id);
    }

    return success;
  }

  private async invalidateEmojiCaches(): Promise<void> {
    console.log("[EmojiService] Starting cache invalidation");
    // Invalidate all emoji-related caches
    const keys = (await CacheService.getRedisClient()?.keys("emojis:*")) || [];
    if (keys.length > 0) {
      console.log("[EmojiService] Invalidating", keys.length, "cache keys");
      await CacheService.getRedisClient()?.del(...keys);
    } else {
      console.log("[EmojiService] No cache keys found to invalidate");
    }
  }
}
