import type { MigrationInterface, QueryRunner } from "typeorm";
import {
  OpenAIModel,
  createOpenAIService,
  type OpenAIService,
} from "../services/shared/OpenAIService";
import { createOpenAICacheService } from "../services/shared/OpenAICacheService";
import { createRedisService } from "../services/shared/RedisService";
import Redis from "ioredis";

export class AddEmojiDescription1710000000000 implements MigrationInterface {
  name = "AddEmojiDescription1710000000000";

  private async updateEventDescription(
    queryRunner: QueryRunner,
    event: { id: string; emoji: string },
    openAIService: OpenAIService,
  ): Promise<void> {
    try {
      const response = await openAIService.executeChatCompletion({
        model: OpenAIModel.GPT4OMini,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that provides brief, accurate descriptions of emoji. Respond with ONLY the description, no additional text or punctuation.",
          },
          {
            role: "user",
            content: `What is a brief description of this emoji: ${event.emoji}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 20,
      });

      const emojiDescription = response.choices[0]?.message.content?.trim();
      if (!emojiDescription) {
        console.warn(`No description generated for emoji: ${event.emoji}`);
        return;
      }

      // Update using parameterized query
      await queryRunner.query(
        "UPDATE events SET emoji_description = $1 WHERE id = $2",
        [emojiDescription, event.id],
      );

      // Verify update
      const verifyResult = await queryRunner.query(
        "SELECT emoji_description FROM events WHERE id = $1",
        [event.id],
      );

      if (!verifyResult?.[0]?.emoji_description) {
        throw new Error(`Failed to update description for event ${event.id}`);
      }

      console.log(`✓ Updated ${event.emoji} → ${emojiDescription}`);
    } catch (error) {
      console.error(`Failed to process event ${event.id}:`, error);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log("Starting AddEmojiDescription migration...");

    // Create Redis client and services for migration
    const redisClient = new Redis({
      host: process.env.REDIS_HOST || "redis",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
    });

    const redisService = createRedisService(redisClient);
    const openAICacheService = createOpenAICacheService();
    const openAIService = createOpenAIService({
      redisService,
      openAICacheService,
    });

    // Add column if it doesn't exist
    await queryRunner.query(`
            ALTER TABLE events 
            ADD COLUMN IF NOT EXISTS emoji_description VARCHAR;
        `);

    // Process in smaller batches
    const batchSize = 10;
    let offset = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Get a batch of events
      const events = await queryRunner.query(
        `
                SELECT id, emoji 
                FROM events 
                WHERE emoji IS NOT NULL 
                AND (emoji_description IS NULL OR emoji_description = '')
                ORDER BY id
                LIMIT $1 OFFSET $2
            `,
        [batchSize, offset],
      );

      if (events.length === 0) {
        break;
      }

      console.log(`Processing batch of ${events.length} events...`);

      // Process events sequentially to avoid memory issues
      for (const event of events) {
        await this.updateEventDescription(queryRunner, event, openAIService);
        // Small delay between requests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      offset += events.length;
      console.log(`Processed ${offset} events so far`);
    }

    // Clean up Redis connection
    await redisClient.quit();

    const finalCount = await queryRunner.query(`
            SELECT COUNT(*) as count 
            FROM events 
            WHERE emoji_description IS NOT NULL
        `);
    console.log(
      "Migration completed. Total events with descriptions:",
      finalCount[0].count,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE events 
            DROP COLUMN IF EXISTS emoji_description;
        `);
  }
}
