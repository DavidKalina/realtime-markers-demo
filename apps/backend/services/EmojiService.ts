import AppDataSource from "../data-source";
import { Emoji } from "../entities/Emoji";
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
        { searchQuery: `%${searchQuery}%` },
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

    queryBuilder
      .orderBy("emoji.rank", "DESC")
      .addOrderBy("emoji.id", "ASC")
      .take(limit);

    const emojis = await queryBuilder.getMany();

    // Cache the results
    await CacheService.setCachedData(
      cacheKey,
      JSON.stringify(emojis),
      EmojiService.EMOJI_LIST_TTL,
    );

    return emojis;
  }

  async createEmoji(emojiData: {
    emoji: string;
    name: string;
    category_id?: string | null;
    keywords: string[];
    rank?: number;
  }): Promise<Emoji> {
    const emoji = this.emojiRepository.create(emojiData);
    const savedEmoji = await this.emojiRepository.save(emoji);

    // Invalidate relevant caches
    await this.invalidateEmojiCaches();

    return savedEmoji;
  }

  async updateEmoji(
    id: number,
    emojiData: Partial<Emoji>,
  ): Promise<Emoji | null> {
    console.log("[] Updating emoji ID:", id, "with data:", emojiData);
    await this.emojiRepository.update(id, emojiData);
    const emoji = await this.emojiRepository.findOneBy({ id });

    if (emoji) {
      // Invalidate relevant caches
      await this.invalidateEmojiCaches();
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
      // Invalidate relevant caches
      await this.invalidateEmojiCaches();
    } else {
      console.log("[EmojiService] Emoji not found for deletion, ID:", id);
    }

    return success;
  }

  private async invalidateEmojiCaches(): Promise<void> {
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
