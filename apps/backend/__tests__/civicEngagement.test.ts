import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { DataSource } from "typeorm";
import {
  CivicEngagement,
  CivicEngagementType,
  CivicEngagementStatus,
} from "@realtime-markers/database";
import { CivicEngagementService } from "../services/CivicEngagementService";
import { createRedisService } from "../services/shared/RedisService";
import Redis from "ioredis";

describe("CivicEngagement", () => {
  let dataSource: DataSource;
  let civicEngagementService: CivicEngagementService;
  let redisClient: Redis;

  beforeEach(async () => {
    // Create test database connection
    dataSource = new DataSource({
      type: "postgres",
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      entities: [CivicEngagement],
      synchronize: true, // For testing only
      dropSchema: true, // For testing only
    });

    await dataSource.initialize();

    // Create Redis client for testing
    redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    const redisService = createRedisService(redisClient);

    // Create service
    const civicEngagementRepository = dataSource.getRepository(CivicEngagement);
    civicEngagementService = new CivicEngagementService(
      civicEngagementRepository,
      redisService,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
    await redisClient.quit();
  });

  describe("createCivicEngagement", () => {
    it("should create a new civic engagement", async () => {
      const input = {
        title: "Test Feedback",
        description: "This is a test feedback",
        type: CivicEngagementType.POSITIVE_FEEDBACK,
        creatorId: "test-user-id",
      };

      const result = await civicEngagementService.createCivicEngagement(input);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.title).toBe(input.title);
      expect(result.description).toBe(input.description);
      expect(result.type).toBe(input.type);
      expect(result.status).toBe(CivicEngagementStatus.PENDING);
      expect(result.creatorId).toBe(input.creatorId);
    });

    it("should create an idea", async () => {
      const input = {
        title: "New Park Idea",
        description: "We should build a new park downtown",
        type: CivicEngagementType.IDEA,
        creatorId: "test-user-id",
      };

      const result = await civicEngagementService.createCivicEngagement(input);

      expect(result).toBeDefined();
      expect(result.type).toBe(CivicEngagementType.IDEA);
    });

    it("should create negative feedback", async () => {
      const input = {
        title: "Pothole Issue",
        description: "There's a large pothole on Main Street",
        type: CivicEngagementType.NEGATIVE_FEEDBACK,
        creatorId: "test-user-id",
      };

      const result = await civicEngagementService.createCivicEngagement(input);

      expect(result).toBeDefined();
      expect(result.type).toBe(CivicEngagementType.NEGATIVE_FEEDBACK);
    });
  });

  describe("getCivicEngagements", () => {
    beforeEach(async () => {
      // Create test data
      await civicEngagementService.createCivicEngagement({
        title: "Positive Feedback 1",
        type: CivicEngagementType.POSITIVE_FEEDBACK,
        creatorId: "user1",
      });

      await civicEngagementService.createCivicEngagement({
        title: "Idea 1",
        type: CivicEngagementType.IDEA,
        creatorId: "user2",
      });

      await civicEngagementService.createCivicEngagement({
        title: "Negative Feedback 1",
        type: CivicEngagementType.NEGATIVE_FEEDBACK,
        creatorId: "user3",
      });
    });

    it("should get all civic engagements", async () => {
      const result = await civicEngagementService.getCivicEngagements({});

      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it("should filter by type", async () => {
      const result = await civicEngagementService.getCivicEngagements({
        type: [CivicEngagementType.POSITIVE_FEEDBACK],
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe(CivicEngagementType.POSITIVE_FEEDBACK);
    });

    it("should filter by multiple types", async () => {
      const result = await civicEngagementService.getCivicEngagements({
        type: [CivicEngagementType.POSITIVE_FEEDBACK, CivicEngagementType.IDEA],
      });

      expect(result.items).toHaveLength(2);
      expect(
        result.items.every(
          (item) =>
            item.type === CivicEngagementType.POSITIVE_FEEDBACK ||
            item.type === CivicEngagementType.IDEA,
        ),
      ).toBe(true);
    });
  });

  describe("getStats", () => {
    beforeEach(async () => {
      // Create test data
      await civicEngagementService.createCivicEngagement({
        title: "Positive Feedback 1",
        type: CivicEngagementType.POSITIVE_FEEDBACK,
        creatorId: "user1",
      });

      await civicEngagementService.createCivicEngagement({
        title: "Positive Feedback 2",
        type: CivicEngagementType.POSITIVE_FEEDBACK,
        creatorId: "user2",
      });

      await civicEngagementService.createCivicEngagement({
        title: "Idea 1",
        type: CivicEngagementType.IDEA,
        creatorId: "user3",
      });
    });

    it("should return correct stats", async () => {
      const stats = await civicEngagementService.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byType[CivicEngagementType.POSITIVE_FEEDBACK]).toBe(2);
      expect(stats.byType[CivicEngagementType.IDEA]).toBe(1);
      expect(stats.byType[CivicEngagementType.NEGATIVE_FEEDBACK]).toBe(0);
      expect(stats.byStatus[CivicEngagementStatus.PENDING]).toBe(3);
    });
  });
});
