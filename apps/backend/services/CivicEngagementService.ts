import { Repository } from "typeorm";
import {
  CivicEngagement,
  CivicEngagementStatus,
} from "../entities/CivicEngagement";
import type {
  CreateCivicEngagementInput,
  UpdateCivicEngagementInput,
  CivicEngagementFilters,
  CivicEngagementStats,
} from "../types/civicEngagement";
import type { RedisService } from "./shared/RedisService";
import type { IEmbeddingService } from "./event-processing/interfaces/IEmbeddingService";
import {
  generateCivicEngagementEmbedding,
  prepareCivicEngagementUpdateData,
} from "../utils/civicEngagementUtils";
import pgvector from "pgvector";

export class CivicEngagementService {
  constructor(
    private readonly civicEngagementRepository: Repository<CivicEngagement>,
    private readonly redisService: RedisService,
    private readonly embeddingService?: IEmbeddingService,
  ) {}

  async createCivicEngagement(
    input: CreateCivicEngagementInput,
  ): Promise<CivicEngagement> {
    // Generate embedding if embedding service is available
    let embedding: number[] | undefined;
    if (this.embeddingService) {
      const dataWithEmbedding = await generateCivicEngagementEmbedding(
        input as CreateCivicEngagementInput & { embedding?: number[] },
        this.embeddingService,
      );
      embedding = dataWithEmbedding.embedding;
    }

    const civicEngagement = this.civicEngagementRepository.create(input);

    // Convert embedding array to SQL format if present
    if (embedding && embedding.length > 0) {
      civicEngagement.embedding = pgvector.toSql(embedding);
    }

    const saved = await this.civicEngagementRepository.save(civicEngagement);

    // Publish to Redis for real-time updates
    await this.redisService.publish("civic_engagement_changes", {
      data: {
        operation: "CREATE",
        record: saved,
        userId: saved.creatorId,
      },
    });

    return saved;
  }

  async updateCivicEngagement(
    id: string,
    input: UpdateCivicEngagementInput,
  ): Promise<CivicEngagement> {
    const civicEngagement = await this.civicEngagementRepository.findOne({
      where: { id },
      relations: ["creator"],
    });

    if (!civicEngagement) {
      throw new Error("Civic engagement not found");
    }

    // Generate embedding if embedding service is available and content changed
    let embedding: number[] | undefined;
    if (this.embeddingService && (input.title || input.description)) {
      const updateDataWithEmbedding = await prepareCivicEngagementUpdateData(
        input as UpdateCivicEngagementInput & { embedding?: number[] },
        this.embeddingService,
      );
      embedding = updateDataWithEmbedding.embedding;
    }

    // Update fields
    Object.assign(civicEngagement, input);

    // Convert embedding array to SQL format if present
    if (embedding && embedding.length > 0) {
      civicEngagement.embedding = pgvector.toSql(embedding);
    }

    // Handle status changes
    if (
      input.status === CivicEngagementStatus.IMPLEMENTED &&
      !civicEngagement.implementedAt
    ) {
      civicEngagement.implementedAt = new Date();
    }

    const updated = await this.civicEngagementRepository.save(civicEngagement);

    // Publish update
    await this.redisService.publish("civic_engagement_changes", {
      data: {
        operation: "UPDATE",
        record: updated,
        userId: updated.creatorId,
      },
    });

    return updated;
  }

  async searchCivicEngagements(
    query: string,
    limit: number = 10,
  ): Promise<{ items: CivicEngagement[]; total: number }> {
    if (!this.embeddingService) {
      // Fallback to text search if no embedding service
      return this.getCivicEngagements({ search: query, limit });
    }

    try {
      // Generate embedding for the search query
      const queryEmbedding = await this.embeddingService.getEmbedding(query);

      // Build query with semantic search
      const queryBuilder = this.civicEngagementRepository
        .createQueryBuilder("ce")
        .leftJoinAndSelect("ce.creator", "creator")
        .where("ce.embedding IS NOT NULL")
        .addSelect(
          "(1 - (ce.embedding <-> :embedding)::float)",
          "similarity_score",
        )
        .setParameter("embedding", queryEmbedding)
        .orderBy("similarity_score", "DESC")
        .limit(limit);

      const items = await queryBuilder.getMany();
      const total = await queryBuilder.getCount();

      return { items, total };
    } catch (error) {
      console.error("Error in semantic search:", error);
      // Fallback to text search
      return this.getCivicEngagements({ search: query, limit });
    }
  }

  async getCivicEngagements(filters: CivicEngagementFilters): Promise<{
    items: CivicEngagement[];
    total: number;
    hasMore: boolean;
  }> {
    const queryBuilder = this.civicEngagementRepository
      .createQueryBuilder("ce")
      .leftJoinAndSelect("ce.creator", "creator");

    // Apply filters
    if (filters.type?.length) {
      queryBuilder.andWhere("ce.type IN (:...types)", { types: filters.type });
    }

    if (filters.status?.length) {
      queryBuilder.andWhere("ce.status IN (:...statuses)", {
        statuses: filters.status,
      });
    }

    if (filters.creatorId) {
      queryBuilder.andWhere("ce.creatorId = :creatorId", {
        creatorId: filters.creatorId,
      });
    }

    if (filters.dateRange?.start) {
      queryBuilder.andWhere("ce.createdAt >= :startDate", {
        startDate: filters.dateRange.start,
      });
    }

    if (filters.dateRange?.end) {
      queryBuilder.andWhere("ce.createdAt <= :endDate", {
        endDate: filters.dateRange.end,
      });
    }

    if (filters.location) {
      queryBuilder.andWhere(
        "ST_DWithin(ce.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :radius)",
        {
          lng: filters.location.longitude,
          lat: filters.location.latitude,
          radius: filters.location.radius,
        },
      );
    }

    if (filters.search) {
      queryBuilder.andWhere(
        "(ce.title ILIKE :search OR ce.description ILIKE :search)",
        { search: `%${filters.search}%` },
      );
    }

    const total = await queryBuilder.getCount();

    // Apply pagination
    if (filters.limit) {
      queryBuilder.limit(filters.limit);
    }
    if (filters.offset) {
      queryBuilder.offset(filters.offset);
    }

    queryBuilder.orderBy("ce.createdAt", "DESC");

    const items = await queryBuilder.getMany();

    return {
      items,
      total,
      hasMore: filters.offset
        ? total > filters.offset + (filters.limit || 0)
        : false,
    };
  }

  async getCivicEngagementById(id: string): Promise<CivicEngagement | null> {
    return await this.civicEngagementRepository.findOne({
      where: { id },
      relations: ["creator"],
    });
  }

  async getNearbyCivicEngagements(
    latitude: number,
    longitude: number,
    radius?: number,
    filters?: Omit<CivicEngagementFilters, "location">,
  ): Promise<CivicEngagement[]> {
    const queryBuilder = this.civicEngagementRepository
      .createQueryBuilder("ce")
      .leftJoinAndSelect("ce.creator", "creator")
      .where(
        "ST_DWithin(ce.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :radius)",
        {
          lng: longitude,
          lat: latitude,
          radius: radius || 5000, // Default 5km radius
        },
      );

    // Apply additional filters
    if (filters?.type?.length) {
      queryBuilder.andWhere("ce.type IN (:...types)", { types: filters.type });
    }

    if (filters?.status?.length) {
      queryBuilder.andWhere("ce.status IN (:...statuses)", {
        statuses: filters.status,
      });
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        "(ce.title ILIKE :search OR ce.description ILIKE :search)",
        { search: `%${filters.search}%` },
      );
    }

    queryBuilder.orderBy("ce.createdAt", "DESC");

    return await queryBuilder.getMany();
  }

  async getStats(): Promise<CivicEngagementStats> {
    const stats = await this.civicEngagementRepository
      .createQueryBuilder("ce")
      .select(["ce.type", "ce.status"])
      .getRawMany();

    // Process stats
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let total = 0;

    stats.forEach((stat) => {
      total++;
      byType[stat.ce_type] = (byType[stat.ce_type] || 0) + 1;
      byStatus[stat.ce_status] = (byStatus[stat.ce_status] || 0) + 1;
    });

    return {
      total,
      byType,
      byStatus,
    };
  }

  async deleteCivicEngagement(id: string): Promise<void> {
    const civicEngagement = await this.civicEngagementRepository.findOne({
      where: { id },
    });

    if (!civicEngagement) {
      throw new Error("Civic engagement not found");
    }

    await this.civicEngagementRepository.remove(civicEngagement);

    // Publish deletion
    await this.redisService.publish("civic_engagement_changes", {
      data: {
        operation: "DELETE",
        record: civicEngagement,
        userId: civicEngagement.creatorId,
      },
    });
  }
}
