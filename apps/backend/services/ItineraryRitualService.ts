import type { DataSource } from "typeorm";
import { ItineraryRitual } from "@realtime-markers/database";

export interface CreateRitualInput {
  name: string;
  emoji: string;
  budgetMin: number;
  budgetMax: number;
  durationHours: number;
  activityTypes: string[];
  stopCount: number;
  categoryNames: string[];
}

export interface UpdateRitualInput {
  name?: string;
  emoji?: string;
  budgetMin?: number;
  budgetMax?: number;
  durationHours?: number;
  activityTypes?: string[];
  stopCount?: number;
  categoryNames?: string[];
}

export interface ItineraryRitualService {
  create(userId: string, input: CreateRitualInput): Promise<ItineraryRitual>;
  listByUser(userId: string): Promise<ItineraryRitual[]>;
  getById(id: string, userId: string): Promise<ItineraryRitual | null>;
  update(
    id: string,
    userId: string,
    input: UpdateRitualInput,
  ): Promise<ItineraryRitual | null>;
  deleteById(id: string, userId: string): Promise<boolean>;
  recordUsage(id: string, userId: string): Promise<void>;
}

class ItineraryRitualServiceImpl implements ItineraryRitualService {
  private dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  async create(
    userId: string,
    input: CreateRitualInput,
  ): Promise<ItineraryRitual> {
    const repo = this.dataSource.getRepository(ItineraryRitual);
    const ritual = repo.create({
      userId,
      name: input.name,
      emoji: input.emoji,
      budgetMin: input.budgetMin,
      budgetMax: input.budgetMax,
      durationHours: input.durationHours,
      activityTypes: input.activityTypes,
      stopCount: input.stopCount,
      categoryNames: input.categoryNames,
    });
    return repo.save(ritual);
  }

  async listByUser(userId: string): Promise<ItineraryRitual[]> {
    return this.dataSource.getRepository(ItineraryRitual).find({
      where: { userId },
      order: { usageCount: "DESC", createdAt: "DESC" },
    });
  }

  async getById(id: string, userId: string): Promise<ItineraryRitual | null> {
    return this.dataSource.getRepository(ItineraryRitual).findOne({
      where: { id, userId },
    });
  }

  async update(
    id: string,
    userId: string,
    input: UpdateRitualInput,
  ): Promise<ItineraryRitual | null> {
    const repo = this.dataSource.getRepository(ItineraryRitual);
    const ritual = await repo.findOne({ where: { id, userId } });
    if (!ritual) return null;

    if (input.name !== undefined) ritual.name = input.name;
    if (input.emoji !== undefined) ritual.emoji = input.emoji;
    if (input.budgetMin !== undefined) ritual.budgetMin = input.budgetMin;
    if (input.budgetMax !== undefined) ritual.budgetMax = input.budgetMax;
    if (input.durationHours !== undefined)
      ritual.durationHours = input.durationHours;
    if (input.activityTypes !== undefined)
      ritual.activityTypes = input.activityTypes;
    if (input.stopCount !== undefined) ritual.stopCount = input.stopCount;
    if (input.categoryNames !== undefined)
      ritual.categoryNames = input.categoryNames;

    return repo.save(ritual);
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    const result = await this.dataSource
      .getRepository(ItineraryRitual)
      .delete({ id, userId });
    return (result.affected ?? 0) > 0;
  }

  async recordUsage(id: string, userId: string): Promise<void> {
    await this.dataSource
      .getRepository(ItineraryRitual)
      .createQueryBuilder()
      .update()
      .set({
        usageCount: () => "usage_count + 1",
        lastUsedAt: new Date(),
      })
      .where("id = :id AND user_id = :userId", { id, userId })
      .execute();
  }
}

export function createItineraryRitualService(deps: {
  dataSource: DataSource;
}): ItineraryRitualService {
  return new ItineraryRitualServiceImpl(deps.dataSource);
}
