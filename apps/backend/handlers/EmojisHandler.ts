import type { Context } from "hono";
import { EmojiService } from "../services/EmojiService";

export class EmojisHandler {
  private emojiService: EmojiService;

  constructor() {
    this.emojiService = new EmojiService();
  }

  async getEmojis(c: Context) {
    try {
      const search_query = c.req.query("search_query");
      const category_id = c.req.query("category_id");
      const limit = c.req.query("limit");
      const last_emoji_id = c.req.query("last_emoji_id");

      const emojis = await this.emojiService.getEmojis({
        searchQuery: search_query,
        categoryId: category_id ? Number(category_id) : null,
        limit: limit ? Number(limit) : undefined,
        lastEmojiId: last_emoji_id ? Number(last_emoji_id) : null,
      });

      return c.json(emojis);
    } catch (error) {
      console.error("Error in getEmojis:", error);
      return c.json({ error: "Failed to fetch emojis" }, 500);
    }
  }

  async createEmoji(c: Context) {
    try {
      const body = await c.req.json();
      const emoji = await this.emojiService.createEmoji(body);
      return c.json(emoji, 201);
    } catch (error) {
      console.error("Error in createEmoji:", error);
      return c.json({ error: "Failed to create emoji" }, 500);
    }
  }

  async updateEmoji(c: Context) {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const emoji = await this.emojiService.updateEmoji(Number(id), body);

      if (!emoji) {
        return c.json({ error: "Emoji not found" }, 404);
      }

      return c.json(emoji);
    } catch (error) {
      console.error("Error in updateEmoji:", error);
      return c.json({ error: "Failed to update emoji" }, 500);
    }
  }

  async deleteEmoji(c: Context) {
    try {
      const id = c.req.param("id");
      const success = await this.emojiService.deleteEmoji(Number(id));

      if (!success) {
        return c.json({ error: "Emoji not found" }, 404);
      }

      return c.body(null, 204);
    } catch (error) {
      console.error("Error in deleteEmoji:", error);
      return c.json({ error: "Failed to delete emoji" }, 500);
    }
  }
}
