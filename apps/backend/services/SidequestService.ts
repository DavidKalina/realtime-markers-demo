import { type DataSource, Not, IsNull, In, MoreThan, MoreThanOrEqual } from "typeorm";
import {
  Sidequest,
  SidequestRejection,
  RejectionReason,
  Objective,
  SidequestStatus,
  User,
} from "../entities";
import type { OpenAIService } from "./shared/OpenAIService";
import type { EmbeddingService } from "./shared/EmbeddingService";
import type { RedisService } from "./shared/RedisService";
import type { ComfortZoneService } from "./ComfortZoneService";
import type { CoverageService } from "./CoverageService";
import type { ResonanceService } from "./ResonanceService";
import type { PathwayService } from "./PathwayService";

export type {
  SidequestProgressCallback,
  PrescribeQuestInput,
} from "./SidequestPrescriptionService";

export interface PopularStop {
  venueName: string;
  venueCategory: string | null;
  emoji: string | null;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
  googleRating: number | null;
  frequency: number;
  completions: number;
  completionRate: number;
  score: number;
}

export type ListByUserSort = "newest" | "oldest" | "upcoming" | "top_rated";
export type ListByUserStatus = "completed" | "upcoming";

export interface ListByUserOptions {
  limit?: number;
  cursor?: string;
  sort?: ListByUserSort;
  intention?: string;
  status?: ListByUserStatus;
}

export interface InternalSidequest {
  id: string;
  title: string | null;
  summary: string | null;
  city: string;
  categories: string[];
  embedding: string | null;
  entryLatitude: number | null;
  entryLongitude: number | null;
  rating: number | null;
  timesAdopted: number;
  items: {
    id: string;
    title: string;
    emoji: string | null;
    latitude: number | null;
    longitude: number | null;
    venueCategory: string | null;
    sortOrder: number;
  }[];
}

export interface BrowsePublishedOptions {
  city: string;
  intention?: string;
  sort?: "popular" | "recent" | "top_rated";
  limit?: number;
  cursor?: string;
  excludeUserId?: string;
}

export interface BrowseSidequest {
  id: string;
  title: string | null;
  summary: string | null;
  city: string;
  intention: string | null;
  rating: number | null;
  timesAdopted: number;
  itemCount: number;
  creatorFirstName: string | null;
  completedAt: string;
  items: {
    emoji: string | null;
    title: string;
    venueName: string | null;
  }[];
}

export interface DeckStats {
  totalCards: number;
  cardsPlayed: number;
  cardsActive: number;
  cardsInDeck: number;
  newThisWeek: number;
  byTier: { tier: string; label: string; count: number }[];
  byStatus: { status: string; label: string; count: number }[];
  recentCards: { name: string; tier: string; daysAgo: number }[];
}

interface SidequestServiceDeps {
  dataSource: DataSource;
  openAIService: OpenAIService;
  embeddingService?: EmbeddingService;
  redisService?: RedisService;
  comfortZoneService?: ComfortZoneService;
  coverageService?: CoverageService;
  resonanceService?: ResonanceService;
  pathwayService?: PathwayService;
}

export class SidequestService {
  private dataSource: DataSource;
  private openAIService: OpenAIService;
  private embeddingService?: EmbeddingService;
  private redisService?: RedisService;
  private comfortZoneService?: ComfortZoneService;
  private coverageService?: CoverageService;
  private resonanceService?: ResonanceService;
  private pathwayService?: PathwayService;

  constructor(deps: SidequestServiceDeps) {
    this.dataSource = deps.dataSource;
    this.openAIService = deps.openAIService;
    this.embeddingService = deps.embeddingService;
    this.redisService = deps.redisService;
    this.comfortZoneService = deps.comfortZoneService;
    this.coverageService = deps.coverageService;
    this.resonanceService = deps.resonanceService;
    this.pathwayService = deps.pathwayService;
  }

  async listByUser(
    userId: string,
    options: ListByUserOptions = {},
  ): Promise<{ data: Sidequest[]; nextCursor: string | null }> {
    const { limit = 20, cursor, sort = "newest", intention, status } = options;

    const qb = this.dataSource
      .getRepository(Sidequest)
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.objectives", "obj")
      .where("s.user_id = :userId", { userId })
      .andWhere("s.parent_id IS NULL");

    if (intention) {
      qb.andWhere("s.intention = :intention", { intention });
    }
    if (status === "completed") {
      qb.andWhere("s.completedAt IS NOT NULL");
    } else if (status === "upcoming") {
      // Must be READY — a GENERATING shell is not a real prescription yet
      // and would leak into Today's Rep / the deck as an empty row.
      qb.andWhere("s.completedAt IS NULL");
      qb.andWhere("s.status = :readyStatus", { readyStatus: SidequestStatus.READY });
    }

    if (sort === "oldest") {
      if (cursor) {
        const [cursorDate, cursorId] = cursor.split("|");
        qb.andWhere(
          "(s.createdAt > :cursorDate OR (s.createdAt = :cursorDate AND s.id > :cursorId))",
          { cursorDate, cursorId },
        );
      }
      qb.orderBy("s.createdAt", "ASC").addOrderBy("s.id", "ASC");
    } else if (sort === "top_rated") {
      if (cursor) {
        const [cursorRating, cursorId] = cursor.split("|");
        const ratingVal =
          cursorRating === "null" ? null : Number(cursorRating);
        if (ratingVal === null) {
          qb.andWhere("(s.rating IS NULL AND s.id < :cursorId)", {
            cursorId,
          });
        } else {
          qb.andWhere(
            "(s.rating < :cursorRating OR (s.rating = :cursorRating AND s.id < :cursorId) OR s.rating IS NULL)",
            { cursorRating: ratingVal, cursorId },
          );
        }
      }
      qb.orderBy("s.rating", "DESC", "NULLS LAST").addOrderBy("s.id", "DESC");
    } else {
      // newest (default)
      if (cursor) {
        const [cursorDate, cursorId] = cursor.split("|");
        qb.andWhere(
          "(s.createdAt < :cursorDate OR (s.createdAt = :cursorDate AND s.id < :cursorId))",
          { cursorDate, cursorId },
        );
      }
      qb.orderBy("s.createdAt", "DESC").addOrderBy("s.id", "DESC");
    }

    qb.take(limit + 1);

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const last = data[data.length - 1];
      if (sort === "oldest" || sort === "newest") {
        nextCursor = `${last.createdAt.toISOString()}|${last.id}`;
      } else if (sort === "top_rated") {
        nextCursor = `${last.rating ?? "null"}|${last.id}`;
      }
    }

    return { data, nextCursor };
  }

  async searchByUser(
    userId: string,
    query: string,
    limit = 20,
  ): Promise<Sidequest[]> {
    if (!this.embeddingService) {
      // Fallback: simple ILIKE search on title/summary
      return this.dataSource
        .getRepository(Sidequest)
        .createQueryBuilder("s")
        .leftJoinAndSelect("s.objectives", "obj")
        .where("s.user_id = :userId", { userId })
        .andWhere("s.parent_id IS NULL")
        .andWhere("s.status = :status", { status: "READY" })
        .andWhere(
          "(s.title ILIKE :q OR s.summary ILIKE :q)",
          { q: `%${query}%` },
        )
        .orderBy("s.createdAt", "DESC")
        .take(limit)
        .getMany();
    }

    const queryEmbeddingSql = await this.embeddingService.getEmbeddingSql(query);

    // Use raw SQL for pgvector ordering — TypeORM's query builder
    // can't parse the ::vector cast in orderBy expressions.
    // Cosine distance threshold: 0 = identical, 2 = opposite. 0.55 keeps only
    // genuinely relevant matches.
    const MAX_DISTANCE = 0.55;
    const rawRows: { id: string }[] = await this.dataSource.query(
      `SELECT s.id
       FROM sidequests s
       WHERE s.user_id = $1
         AND s.parent_id IS NULL
         AND s.status = 'READY'
         AND s.embedding IS NOT NULL
         AND s.deleted_at IS NULL
         AND (s.embedding::vector <=> $2::vector) < $4
       ORDER BY s.embedding::vector <=> $2::vector ASC
       LIMIT $3`,
      [userId, queryEmbeddingSql, limit, MAX_DISTANCE],
    );

    if (rawRows.length === 0) return [];

    const ids = rawRows.map((r) => r.id);
    const rows = await this.dataSource
      .getRepository(Sidequest)
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.objectives", "obj")
      .whereInIds(ids)
      .getMany();

    // Preserve the similarity ordering from the raw query
    const idOrder = new Map(ids.map((id, i) => [id, i]));
    rows.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

    return rows;
  }

  async getById(id: string, userId?: string): Promise<Sidequest | null> {
    const where: Record<string, string> = { id };
    if (userId) where.userId = userId;
    return this.dataSource.getRepository(Sidequest).findOne({
      where,
      relations: ["objectives"],
      order: { objectives: { sortOrder: "ASC" } },
    });
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    const repo = this.dataSource.getRepository(Sidequest);

    const result = await repo.softDelete({ id, userId });
    return (result.affected ?? 0) > 0;
  }

  async deleteByIds(ids: string[], userId: string): Promise<number> {
    if (ids.length === 0) return 0;

    const repo = this.dataSource.getRepository(Sidequest);

    const result = await repo.softDelete({ id: In(ids), userId });
    return result.affected ?? 0;
  }

  /**
   * Record a calibration-feedback rejection on a prescribed sidequest and
   * soft-delete it so it doesn't clutter the user's queue. The rejected
   * venue is denormalized into the rejection row so the strategist can
   * recalibrate without reloading the sidequest.
   *
   * Returns null if the sidequest isn't found, not owned by the user, or
   * has already been activated/completed (rejections only apply pre-start).
   */
  async recordRejection(
    sidequestId: string,
    userId: string,
    reason: RejectionReason,
    note?: string,
  ): Promise<SidequestRejection | null> {
    const sidequestRepo = this.dataSource.getRepository(Sidequest);
    const sidequest = await sidequestRepo.findOne({
      where: { id: sidequestId, userId },
      relations: ["objectives"],
      order: { objectives: { sortOrder: "ASC" } },
    });

    if (!sidequest || sidequest.completedAt) return null;

    const firstObjective = sidequest.objectives?.[0];

    const rejectionRepo = this.dataSource.getRepository(SidequestRejection);
    const rejection = rejectionRepo.create({
      sidequestId,
      userId,
      reason,
      venueName: firstObjective?.venueName,
      venueCategory: firstObjective?.venueCategory,
      note,
    });
    await rejectionRepo.save(rejection);

    await sidequestRepo.softDelete({ id: sidequestId, userId });

    return rejection;
  }

  async generateShareToken(id: string, userId: string): Promise<string | null> {
    const repo = this.dataSource.getRepository(Sidequest);
    const sidequest = await repo.findOne({ where: { id, userId } });
    if (!sidequest) return null;

    if (sidequest.shareToken) return sidequest.shareToken;

    const shareToken = crypto.randomUUID();
    await repo.update({ id }, { shareToken });
    return shareToken;
  }

  async getByShareToken(shareToken: string): Promise<Sidequest | null> {
    return this.dataSource.getRepository(Sidequest).findOne({
      where: { shareToken, status: SidequestStatus.READY },
      relations: ["objectives"],
      order: { objectives: { sortOrder: "ASC" } },
    });
  }

  async rate(
    id: string,
    userId: string,
    rating: number,
    comment?: string,
  ): Promise<Sidequest | null> {
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return null;
    }

    const repo = this.dataSource.getRepository(Sidequest);
    const sidequest = await repo.findOne({ where: { id, userId } });

    if (!sidequest || !sidequest.completedAt) return null;

    sidequest.rating = rating;
    if (comment) sidequest.ratingComment = comment;
    sidequest.isPublished = true;
    await repo.save(sidequest);

    // Compute resonance and detect/update pathways after rating
    if (this.resonanceService && this.pathwayService) {
      this.computeResonanceAndPathway(id, userId).catch((err) => {
        console.error("[SidequestService] Resonance/pathway update failed:", err);
      });
    }

    return sidequest;
  }

  async countCreatedSince(userId: string, since: Date): Promise<number> {
    return this.dataSource.getRepository(Sidequest).count({
      where: {
        userId,
        status: SidequestStatus.READY,
        createdAt: MoreThanOrEqual(since),
      },
    });
  }

  async listCompleted(userId: string, limit = 20): Promise<Sidequest[]> {
    return this.dataSource.getRepository(Sidequest).find({
      where: { userId, completedAt: Not(IsNull()) },
      relations: ["objectives"],
      order: { completedAt: "DESC" },
      take: limit,
    });
  }

  async listUnrated(userId: string, limit = 5): Promise<Sidequest[]> {
    return this.dataSource
      .getRepository(Sidequest)
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.objectives", "obj")
      .where("s.user_id = :userId", { userId })
      .andWhere("s.completed_at IS NOT NULL")
      .andWhere("s.rating IS NULL")
      .andWhere("s.parent_id IS NULL")
      .orderBy("s.completed_at", "DESC")
      .take(limit)
      .getMany();
  }

  async listPendingCapture(userId: string, limit = 3): Promise<Sidequest[]> {
    // Find completed quests where at least one objective was checked in
    // but the user skipped the reflection capture (no wouldReturn AND no journalEntry)
    return this.dataSource
      .getRepository(Sidequest)
      .createQueryBuilder("s")
      .innerJoinAndSelect("s.objectives", "obj")
      .where("s.user_id = :userId", { userId })
      .andWhere("s.completed_at IS NOT NULL")
      .andWhere("s.parent_id IS NULL")
      .andWhere("obj.checked_in_at IS NOT NULL")
      .andWhere("obj.would_return IS NULL")
      .andWhere("obj.journal_entry IS NULL")
      .orderBy("s.completed_at", "DESC")
      .take(limit)
      .getMany();
  }

  async promote(id: string, userId: string): Promise<Sidequest> {
    const repo = this.dataSource.getRepository(Sidequest);
    const sidequest = await repo.findOne({
      where: { id, userId },
      relations: ["objectives"],
    });

    if (!sidequest) {
      throw new Error("Sidequest not found");
    }
    if (!sidequest.completedAt) {
      throw new Error("Sidequest is not completed");
    }
    if (sidequest.promotedAt) {
      throw new Error("Sidequest is already promoted");
    }

    // Compute growth-based rarity from resonance + reflection tags
    if (this.comfortZoneService && this.resonanceService) {
      const resonance = await this.resonanceService.computeResonanceForSidequest(id);
      const obj = sidequest.objectives?.[0];
      const reflectionTags: string[] = obj?.reflectionTags ?? [];

      // Check if quest is in a coverage gap
      let isInCoverageGap = false;
      if (this.coverageService && obj?.latitude && obj?.longitude) {
        try {
          isInCoverageGap = await this.coverageService.isInCoverageGap(
            userId,
            Number(obj.latitude),
            Number(obj.longitude),
          );
        } catch { /* ignore */ }
      }

      const growthRarity = this.comfortZoneService.computeGrowthRarity(
        resonance?.score ?? 0,
        reflectionTags,
        isInCoverageGap,
      );
      sidequest.rarity = growthRarity;
    }

    sidequest.promotedAt = new Date();
    await repo.save(sidequest);

    return sidequest;
  }

  async browsePublished(
    options: BrowsePublishedOptions,
  ): Promise<BrowseSidequest[]> {
    const {
      city,
      intention,
      sort = "popular",
      limit = 20,
      cursor,
      excludeUserId,
    } = options;

    const qb = this.dataSource
      .getRepository(Sidequest)
      .createQueryBuilder("s")
      .innerJoin(User, "u", "u.id = s.user_id")
      .leftJoinAndSelect("s.objectives", "obj")
      .where("s.is_published = true")
      .andWhere("s.city = :city", { city })
      .andWhere("s.status = :status", { status: SidequestStatus.READY });

    if (excludeUserId) {
      qb.andWhere("s.user_id != :excludeUserId", { excludeUserId });
    }

    if (intention) {
      qb.andWhere("s.intention = :intention", { intention });
    }

    if (cursor) {
      const [cursorDate, cursorId] = cursor.split("|");
      qb.andWhere(
        "(s.completed_at < :cursorDate OR (s.completed_at = :cursorDate AND s.id < :cursorId))",
        { cursorDate, cursorId },
      );
    }

    qb.addSelect("u.first_name", "creatorFirstName");

    switch (sort) {
      case "recent":
        qb.orderBy("s.completed_at", "DESC").addOrderBy("s.id", "DESC");
        break;
      case "top_rated":
        qb.orderBy("s.rating", "DESC").addOrderBy("s.id", "DESC");
        break;
      case "popular":
      default:
        qb.addSelect(
          "s.times_adopted * 2 + COALESCE(s.rating, 0)",
          "popularity_score",
        );
        qb.orderBy("popularity_score", "DESC").addOrderBy("s.id", "DESC");
        break;
    }

    qb.take(limit);

    const { raw, entities } = await qb.getRawAndEntities();

    const firstNameMap = new Map<string, string | null>();
    for (const row of raw) {
      firstNameMap.set(row.s_id, row.creatorFirstName || null);
    }

    return entities.map((sq) => {
      const objectives = (sq.objectives || [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .slice(0, 3);
      return {
        id: sq.id,
        title: sq.title || null,
        summary: sq.summary || null,
        city: sq.city,
        intention: sq.intention || null,
        rating: sq.rating ?? null,
        timesAdopted: sq.timesAdopted,
        itemCount: (sq.objectives || []).length,
        creatorFirstName: firstNameMap.get(sq.id) ?? null,
        completedAt: sq.completedAt
          ? sq.completedAt.toISOString()
          : "",
        items: objectives.map((obj) => ({
          emoji: obj.emoji || null,
          title: obj.title,
          venueName: obj.venueName || null,
        })),
      };
    });
  }

  async getPopularStops(city: string, limit = 15): Promise<PopularStop[]> {
    const rows: {
      venue_name: string;
      venue_category: string | null;
      emoji: string | null;
      latitude: string | null;
      longitude: string | null;
      google_place_id: string | null;
      google_rating: string | null;
      frequency: string;
      completions: string;
    }[] = await this.dataSource.query(
      `
      SELECT
        o.venue_name,
        MODE() WITHIN GROUP (ORDER BY o.venue_category) AS venue_category,
        MODE() WITHIN GROUP (ORDER BY o.emoji) AS emoji,
        AVG(o.latitude)::numeric(10,7) AS latitude,
        AVG(o.longitude)::numeric(10,7) AS longitude,
        NULL AS google_place_id,
        NULL AS google_rating,
        COUNT(*)::int AS frequency,
        COUNT(o.checked_in_at)::int AS completions
      FROM objectives o
      JOIN sidequests s ON s.id = o.sidequest_id
      WHERE LOWER(s.city) = LOWER($1)
        AND s.status = 'READY'
        AND o.venue_name IS NOT NULL
      GROUP BY LOWER(o.venue_name), o.venue_name
      HAVING COUNT(*) >= 2
      ORDER BY
        COUNT(*)::float
        * POWER(COUNT(o.checked_in_at)::float / GREATEST(COUNT(*), 1), 2)
        DESC
      LIMIT $2
      `,
      [city, limit],
    );

    return rows.map((r) => {
      const frequency = Number(r.frequency);
      const completions = Number(r.completions);
      const completionRate = frequency > 0 ? completions / frequency : 0;
      return {
        venueName: r.venue_name,
        venueCategory: r.venue_category,
        emoji: r.emoji,
        latitude: r.latitude ? Number(r.latitude) : null,
        longitude: r.longitude ? Number(r.longitude) : null,
        googlePlaceId: r.google_place_id,
        googleRating: r.google_rating ? Number(r.google_rating) : null,
        frequency,
        completions,
        completionRate: Math.round(completionRate * 100) / 100,
        score:
          Math.round(frequency * completionRate * completionRate * 100) / 100,
      };
    });
  }

  async listPublishedInternal(
    page: number,
    pageSize: number,
  ): Promise<{
    sidequests: InternalSidequest[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    const offset = (page - 1) * pageSize;
    const repo = this.dataSource.getRepository(Sidequest);

    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const where = [
      { isPublished: true, status: SidequestStatus.READY },
      {
        status: SidequestStatus.READY,
        entryLatitude: Not(IsNull()),
        createdAt: MoreThan(recentCutoff),
      },
    ];

    const [sidequests, total] = await Promise.all([
      repo.find({
        where,
        relations: ["objectives"],
        order: { updatedAt: "DESC", objectives: { sortOrder: "ASC" } },
        skip: offset,
        take: pageSize,
      }),
      repo.count({ where }),
    ]);

    const results: InternalSidequest[] = sidequests.map((sq) => ({
      id: sq.id,
      title: sq.title || null,
      summary: sq.summary || null,
      city: sq.city,
      categories: sq.categories || [],
      embedding: sq.embedding || null,
      entryLatitude: sq.entryLatitude != null ? Number(sq.entryLatitude) : null,
      entryLongitude:
        sq.entryLongitude != null ? Number(sq.entryLongitude) : null,
      rating: sq.rating ?? null,
      timesAdopted: sq.timesAdopted,
      items: (sq.objectives || []).map((obj) => ({
        id: obj.id,
        title: obj.title,
        emoji: obj.emoji || null,
        latitude: obj.latitude != null ? Number(obj.latitude) : null,
        longitude: obj.longitude != null ? Number(obj.longitude) : null,
        venueCategory: obj.venueCategory || null,
        sortOrder: obj.sortOrder,
      })),
    }));

    return {
      sidequests: results,
      pagination: {
        page,
        pageSize,
        total,
        hasMore: offset + pageSize < total,
      },
    };
  }


  async getDeckStats(userId: string): Promise<DeckStats> {
    const repo = this.dataSource.getRepository(Sidequest);

    // All user's top-level READY sidequests (selected cards)
    const cards = await repo.find({
      where: {
        userId,
        status: SidequestStatus.READY,
        parentId: IsNull(),
      },
      relations: ["objectives"],
      order: { createdAt: "DESC" },
    });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let completed = 0;
    let active = 0;
    let unplayed = 0;
    let newThisWeek = 0;
    const tierCounts: Record<string, number> = { QUICK: 0, SWEET_SPOT: 0, BEST: 0 };

    for (const card of cards) {
      // Tier
      if (card.tier && tierCounts[card.tier] !== undefined) {
        tierCounts[card.tier]++;
      }

      // Status
      if (card.completedAt) {
        completed++;
      } else if (card.objectives?.some((o) => o.checkedInAt)) {
        active++;
      } else {
        unplayed++;
      }

      // New this week
      if (card.createdAt >= weekAgo) {
        newThisWeek++;
      }
    }

    const totalCards = cards.length;

    // Recent cards (last 5 added)
    const recentCards = cards.slice(0, 5).map((card) => {
      const diffMs = now.getTime() - card.createdAt.getTime();
      const daysAgo = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
      return {
        name: card.title || "Untitled Quest",
        tier: card.tier || "QUICK",
        daysAgo,
      };
    });

    return {
      totalCards,
      cardsPlayed: completed,
      cardsActive: active,
      cardsInDeck: unplayed,
      newThisWeek,
      byTier: [
        { tier: "QUICK", label: "Quick & Easy", count: tierCounts.QUICK },
        { tier: "SWEET_SPOT", label: "Sweet Spot", count: tierCounts.SWEET_SPOT },
        { tier: "BEST", label: "Best Package", count: tierCounts.BEST },
      ],
      byStatus: [
        { status: "completed", label: "Completed", count: completed },
        { status: "active", label: "Active", count: active },
        { status: "unplayed", label: "Unplayed", count: unplayed },
      ],
      recentCards,
    };
  }
  /**
   * Aggregate completed reps per capacity track for a user. Returns rows only
   * for tracks with at least one completion — the client fills in the rest so
   * the user always sees all 9 tracks.
   */
  async getCapacityReps(userId: string): Promise<
    {
      track: string;
      count: number;
      fullCount: number;
      smallerCount: number;
      tinyCount: number;
      lastCompletedAt: string | null;
    }[]
  > {
    // Join only the primary objective (sort_order = 0) so legacy multi-objective
    // quests don't overcount as multiple reps. One sidequest = one rep.
    const rows: {
      track: string;
      count: string;
      full_count: string;
      smaller_count: string;
      tiny_count: string;
      last_completed_at: Date | null;
    }[] = await this.dataSource.query(
      `SELECT
         s.capacity_track AS track,
         COUNT(DISTINCT s.id) AS count,
         SUM(CASE WHEN o.completed_version = 'full' THEN 1 ELSE 0 END) AS full_count,
         SUM(CASE WHEN o.completed_version = 'smaller' THEN 1 ELSE 0 END) AS smaller_count,
         SUM(CASE WHEN o.completed_version = 'tiny' THEN 1 ELSE 0 END) AS tiny_count,
         MAX(s.completed_at) AS last_completed_at
       FROM sidequests s
       LEFT JOIN objectives o ON o.sidequest_id = s.id AND o.sort_order = 0
       WHERE s.user_id = $1
         AND s.completed_at IS NOT NULL
         AND s.deleted_at IS NULL
         AND s.capacity_track IS NOT NULL
       GROUP BY s.capacity_track
       ORDER BY count DESC`,
      [userId],
    );

    return rows.map((r) => ({
      track: r.track,
      count: Number(r.count),
      fullCount: Number(r.full_count ?? 0),
      smallerCount: Number(r.smaller_count ?? 0),
      tinyCount: Number(r.tiny_count ?? 0),
      lastCompletedAt: r.last_completed_at ? r.last_completed_at.toISOString() : null,
    }));
  }

  // prescribeQuest and its helpers have been extracted to SidequestPrescriptionService


  /**
   * Compute resonance + detect/update pathway for a sidequest. Public so
   * capture/journal handlers can trigger a richer recompute AFTER the user
   * saves their journal data — otherwise the first trigger (at completion
   * time) sees mostly empty signal. Idempotent at the DB layer; safe to
   * call multiple times per quest (completion, capture, rating).
   */
  async computeResonanceAndPathway(
    sidequestId: string,
    userId: string,
  ): Promise<void> {
    if (!this.resonanceService || !this.pathwayService) return;

    // Ensure reflection analysis + expectancy violation are up-to-date before
    // resonance is scored. Delegated to ComfortZoneService so there's one
    // owner for journal-analysis side effects (tags, sentiment, depth, and
    // the expectancy-violation bookkeeping that feeds inhibitory-learning UX).
    const sq = await this.dataSource.getRepository(Sidequest).findOne({
      where: { id: sidequestId },
      relations: ["objectives"],
    });
    const firstObj = sq?.objectives?.[0];
    if (firstObj?.journalEntry && this.comfortZoneService) {
      try {
        await this.comfortZoneService.analyzeJournal(firstObj.id, firstObj.journalEntry);
      } catch (err) {
        console.error("[SidequestService] Journal analysis failed:", err);
      }
    }

    const resonance = await this.resonanceService.computeResonanceForSidequest(sidequestId);
    if (!resonance) return;

    // Get the sidequest's first objective for category + difficulty
    const sidequest = await this.dataSource.getRepository(Sidequest).findOne({
      where: { id: sidequestId },
      relations: ["objectives"],
    });
    if (!sidequest) return;

    const obj = sidequest.objectives?.[0];
    const venueCategory = obj?.venueCategory ?? "other";
    const difficulty = obj?.difficulty ?? 1;

    const result = await this.pathwayService.detectOrCreatePathway(
      userId,
      sidequestId,
      venueCategory,
      difficulty,
      resonance,
      obj?.wouldReturn ?? undefined,
    );

    if (result) {
      console.log(
        `[SidequestService] Resonance ${resonance.score.toFixed(3)} for quest ${sidequestId}, ` +
        `pathway "${result.pathway.themeLabel}" (${result.pathway.phase}, ${result.isNew ? "new" : "updated"})`,
      );
    }
  }
}

