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

export class CivicEngagementService {
  constructor(
    private readonly civicEngagementRepository: Repository<CivicEngagement>,
    private readonly redisService: RedisService,
  ) {}

  async createCivicEngagement(
    input: CreateCivicEngagementInput,
  ): Promise<CivicEngagement> {
    const civicEngagement = this.civicEngagementRepository.create(input);
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

    // Update fields
    Object.assign(civicEngagement, input);

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
