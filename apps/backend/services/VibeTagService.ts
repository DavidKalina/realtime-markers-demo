import { DataSource, Repository } from "typeorm";
import { EventVibeTag, VibeTag } from "@realtime-markers/database";

export interface VibeTagSummary {
  tag: VibeTag;
  count: number;
  userHasTagged: boolean;
}

export interface VibeTagService {
  addTag(userId: string, eventId: string, tag: VibeTag): Promise<void>;
  removeTag(userId: string, eventId: string, tag: VibeTag): Promise<void>;
  getTagsForEvent(eventId: string, userId?: string): Promise<VibeTagSummary[]>;
}

export class VibeTagServiceImpl implements VibeTagService {
  private repository: Repository<EventVibeTag>;

  constructor(private dataSource: DataSource) {
    this.repository = dataSource.getRepository(EventVibeTag);
  }

  async addTag(userId: string, eventId: string, tag: VibeTag): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(EventVibeTag)
      .values({ userId, eventId, tag })
      .orIgnore()
      .execute();
  }

  async removeTag(
    userId: string,
    eventId: string,
    tag: VibeTag,
  ): Promise<void> {
    await this.repository.delete({ userId, eventId, tag });
  }

  async getTagsForEvent(
    eventId: string,
    userId?: string,
  ): Promise<VibeTagSummary[]> {
    const results = await this.repository
      .createQueryBuilder("vt")
      .select("vt.tag", "tag")
      .addSelect("COUNT(*)::int", "count")
      .where("vt.event_id = :eventId", { eventId })
      .groupBy("vt.tag")
      .orderBy("count", "DESC")
      .getRawMany<{ tag: VibeTag; count: number }>();

    if (!userId) {
      return results.map((r) => ({
        tag: r.tag,
        count: r.count,
        userHasTagged: false,
      }));
    }

    // Check which tags the current user has added
    const userTags = await this.repository.find({
      where: { eventId, userId },
      select: ["tag"],
    });
    const userTagSet = new Set(userTags.map((t) => t.tag));

    return results.map((r) => ({
      tag: r.tag,
      count: r.count,
      userHasTagged: userTagSet.has(r.tag),
    }));
  }
}

export function createVibeTagService(deps: {
  dataSource: DataSource;
}): VibeTagService {
  return new VibeTagServiceImpl(deps.dataSource);
}
