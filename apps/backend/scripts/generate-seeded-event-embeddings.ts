#!/usr/bin/env bun

import "reflect-metadata";
import { initializeDatabase } from "../data-source";
import { Event } from "@realtime-markers/database";
import { DataSource, In } from "typeorm";
import { createEmbeddingService } from "../services/shared/EmbeddingService";
import { createEmbeddingCacheService } from "../services/shared/EmbeddingCacheService";
import { createOpenAIService } from "../services/shared/OpenAIService";
import { createConfigService } from "../services/shared/ConfigService";
import { createOpenAICacheService } from "../services/shared/OpenAICacheService";
import { createRedisService } from "../services/shared/RedisService";
import pgvector from "pgvector";
import Redis from "ioredis";

// Seeded event IDs from the migration
const SEEDED_EVENT_IDS = [
  "550e8400-e29b-41d4-a716-446655440101", // Frederick In Flight
  "550e8400-e29b-41d4-a716-446655440102", // Chainsaws & Chuckwagons
  "550e8400-e29b-41d4-a716-446655440103", // Miners Day
  "550e8400-e29b-41d4-a716-446655440104", // Tiny Terror Town
  "550e8400-e29b-41d4-a716-446655440105", // Festival of Lights
  "550e8400-e29b-41d4-a716-446655440106", // Community Tour & Talk
  "550e8400-e29b-41d4-a716-446655440107", // Carbon Valley Memorial Day Ceremony
];

async function generateSeededEventEmbeddings() {
  console.log("🔍 Generating embeddings for seeded events...\n");

  let dataSource: DataSource | null = null;
  let redis: Redis | null = null;

  try {
    // Set up environment for local execution
    if (!process.env.DATABASE_URL) {
      console.log(
        "No DATABASE_URL found, checking for local database connection...",
      );
      // Try to construct DATABASE_URL from individual environment variables
      const postgresUser = process.env.POSTGRES_USER || "postgres";
      const postgresPassword = "GdKv8p2aBX4tYwNe5rMjF9sQzH3cJ6L7";
      const postgresDb = process.env.POSTGRES_DB || "markersdb";

      if (postgresPassword) {
        process.env.DATABASE_URL = `postgresql://${postgresUser}:${postgresPassword}@localhost:5432/${postgresDb}?schema=public`;
        console.log("✅ Set DATABASE_URL for local connection");
      } else {
        throw new Error("POSTGRES_PASSWORD environment variable is required");
      }
    } else {
      // If DATABASE_URL exists but points to Docker service, replace with localhost
      if (process.env.DATABASE_URL.includes("postgres:5432")) {
        process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
          "postgres:5432",
          "localhost:5432",
        );
        console.log(
          "✅ Updated DATABASE_URL to use localhost for local execution",
        );
      }
    }

    // Initialize database connection
    console.log("1. Initializing database connection...");
    dataSource = await initializeDatabase();
    console.log("✅ Database connection established\n");

    // Initialize Redis
    console.log("2. Initializing Redis...");
    redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: () => true,
      enableOfflineQueue: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      lazyConnect: true,
    });
    console.log("✅ Redis connection established\n");

    // Initialize services
    console.log("3. Initializing services...");
    const configService = createConfigService();
    const redisService = createRedisService(redis);
    const openAICacheService = createOpenAICacheService();
    const openAIService = createOpenAIService({
      redisService,
      openAICacheService,
    });
    const embeddingCacheService = createEmbeddingCacheService({
      configService,
    });
    const embeddingService = createEmbeddingService({
      openAIService,
      configService,
      embeddingCacheService,
    });
    console.log("✅ Services initialized\n");

    // Get event repository
    const eventRepository = dataSource.getRepository(Event);

    // Fetch seeded events
    console.log("4. Fetching seeded events...");
    const seededEvents = await eventRepository.find({
      where: { id: In(SEEDED_EVENT_IDS) },
      relations: ["categories"],
    });

    if (seededEvents.length === 0) {
      console.log("❌ No seeded events found in database");
      return;
    }

    console.log(`✅ Found ${seededEvents.length} seeded events\n`);

    // Process each event
    for (let i = 0; i < seededEvents.length; i++) {
      const event = seededEvents[i];
      console.log(`5.${i + 1} Processing event: ${event.title}`);

      // Check if event already has an embedding
      if (event.embedding) {
        console.log(`   ⏭️  Event already has embedding, skipping`);
        continue;
      }

      try {
        // Create text for embedding using the same format as EventProcessingService
        const textForEmbedding = `
          TITLE: ${event.title} ${event.title} ${event.title}
          EMOJI: ${event.emoji || "📍"} - ${event.emojiDescription || ""}
          CATEGORIES: ${event.categories?.map((c) => c.name).join(", ") || ""}
          DESCRIPTION: ${event.description || ""}
          LOCATION: ${event.address || ""}
          LOCATION_NOTES: ${event.locationNotes || ""}
        `.trim();

        console.log(
          `   📝 Generating embedding for text: "${textForEmbedding.substring(0, 100)}..."`,
        );

        // Generate embedding
        const embedding = await embeddingService.getEmbedding(textForEmbedding);

        // Convert to SQL format for database storage
        const embeddingSql = pgvector.toSql(embedding);

        // Update the event with the embedding
        event.embedding = embeddingSql;
        await eventRepository.save(event);

        console.log(
          `   ✅ Generated embedding (${embedding.length} dimensions)`,
        );
      } catch (error) {
        console.error(
          `   ❌ Error generating embedding for ${event.title}:`,
          error,
        );
      }
    }

    console.log("\n🎯 Summary:");
    console.log(
      `✅ Successfully processed ${seededEvents.length} seeded events`,
    );
    console.log("✅ Embeddings generated and stored in database");
  } catch (error) {
    console.error("❌ Script failed:", error);
    process.exit(1);
  } finally {
    if (dataSource) {
      await dataSource.destroy();
    }
    if (redis) {
      await redis.disconnect();
    }
    process.exit(0);
  }
}

// Run the script
generateSeededEventEmbeddings();
