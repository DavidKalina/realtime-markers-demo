#!/usr/bin/env bun

import "reflect-metadata";
import { initializeDatabase } from "../data-source";
import { CivicEngagement } from "@realtime-markers/database";
import { DataSource } from "typeorm";
import { createEmbeddingService } from "../services/shared/EmbeddingService";
import { createEmbeddingCacheService } from "../services/shared/EmbeddingCacheService";
import { createOpenAIService } from "../services/shared/OpenAIService";
import { createConfigService } from "../services/shared/ConfigService";
import { createOpenAICacheService } from "../services/shared/OpenAICacheService";
import { createRedisService } from "../services/shared/RedisService";
import pgvector from "pgvector";
import Redis from "ioredis";

async function generateCivicEngagementEmbeddings() {
  let dataSource: DataSource | undefined;
  let redis: Redis | undefined;

  try {
    console.log("🚀 Starting civic engagement embedding generation...\n");

    // Step 1: Initialize database connection
    console.log("1. Initializing database connection...");
    dataSource = await initializeDatabase();
    console.log("✅ Database connection established\n");

    // Step 2: Initialize Redis connection
    console.log("2. Initializing Redis connection...");
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

    // Get civic engagement repository
    const civicEngagementRepository = dataSource.getRepository(CivicEngagement);

    // Fetch all civic engagements
    console.log("4. Fetching civic engagements...");
    const civicEngagements = await civicEngagementRepository.find({
      relations: ["creator"],
    });

    if (civicEngagements.length === 0) {
      console.log("❌ No civic engagements found in database");
      return;
    }

    console.log(`✅ Found ${civicEngagements.length} civic engagements\n`);

    // Process each civic engagement
    for (let i = 0; i < civicEngagements.length; i++) {
      const civicEngagement = civicEngagements[i];
      console.log(
        `5.${i + 1} Processing civic engagement: ${civicEngagement.title}`,
      );

      // Check if civic engagement already has an embedding
      if (civicEngagement.embedding) {
        console.log(`   ⏭️  Civic engagement already has embedding, skipping`);
        continue;
      }

      try {
        // Create text for embedding using the same format as CivicEngagementProcessingService
        const textForEmbedding = `
          TITLE: ${civicEngagement.title} ${civicEngagement.title} ${civicEngagement.title}
          TYPE: ${civicEngagement.type}
          DESCRIPTION: ${civicEngagement.description || ""}
          LOCATION: ${civicEngagement.address || ""}
          LOCATION_NOTES: ${civicEngagement.locationNotes || ""}
        `.trim();

        console.log(
          `   📝 Generating embedding for text: "${textForEmbedding.substring(0, 100)}..."`,
        );

        // Generate embedding
        const embedding = await embeddingService.getEmbedding(textForEmbedding);

        // Convert to SQL format for database storage
        const embeddingSql = pgvector.toSql(embedding);

        // Update the civic engagement with the embedding
        civicEngagement.embedding = embeddingSql;
        await civicEngagementRepository.save(civicEngagement);

        console.log(
          `   ✅ Generated embedding (${embedding.length} dimensions)`,
        );
      } catch (error) {
        console.error(
          `   ❌ Error generating embedding for ${civicEngagement.title}:`,
          error,
        );
      }
    }

    console.log("\n🎯 Summary:");
    console.log(
      `✅ Successfully processed ${civicEngagements.length} civic engagements`,
    );
    console.log("✅ Embeddings generated and stored in database");
  } catch (error) {
    console.error("❌ Script failed:", error);
    process.exit(1);
  } finally {
    // Clean up connections
    if (dataSource) {
      await dataSource.destroy();
    }
    if (redis) {
      await redis.quit();
    }
  }
}

// Run the script
generateCivicEngagementEmbeddings()
  .then(() => {
    console.log("🎉 Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });
