import { type DataSource, Not, IsNull, In, MoreThan, MoreThanOrEqual } from "typeorm";
import {
  Sidequest,
  Objective,
  SidequestStatus,
  SidequestTier,
  User,
  normalizeCity,
  isCityNormalized,
} from "@realtime-markers/database";
import type { OpenAIService } from "./shared/OpenAIService";
import { OpenAIModel } from "./shared/OpenAIService";
import type {
  GoogleGeocodingService,
  VerifiedVenue,
} from "./shared/GoogleGeocodingService";
import type { OverpassService, Trail } from "./shared/OverpassService";
import type { IEmbeddingService } from "./shared/EmbeddingService";
import type { RedisService } from "./shared/RedisService";
import type { AgentCandidate } from "./shared/JobPipeline";
import { OpenAIResponsesAgent } from "./shared/OpenAIResponsesAgent";
import type { AgentToolResult } from "./shared/OpenAIResponsesAgent";
import type { ComfortZoneService } from "./ComfortZoneService";
import type { CoverageService } from "./CoverageService";
import type { ResonanceService } from "./ResonanceService";
import type { PathwayService } from "./PathwayService";

export type SidequestProgressCallback = (
  progress: number,
  label: string,
  candidates?: AgentCandidate[],
) => Promise<void>;

export interface PrescribeQuestInput {
  latitude: number;
  longitude: number;
  timezone?: string;
}

interface LLMItemRaw {
  t: string;
  d: string;
  e: string;
  ec: number | null;
  vn: string | null;
  va: string | null;
  eid: string | null;
  vc: string | null;
  hook: string | null;
  sa: string[] | null;
  jp: string | null;
  df: number | null;
}

interface LLMResponseRaw {
  t: string;
  s: string;
  items: LLMItemRaw[];
}

interface LLMItem {
  title: string;
  description: string;
  emoji: string;
  estimatedCost: number | null;
  venueName: string | null;
  venueAddress: string | null;
  eventId: string | null;
  venueCategory: string | null;
  hook: string | null;
  suggestedActivities: string[] | null;
  journalPrompt: string | null;
  difficulty: number | null;
}

interface LLMResponse {
  title: string;
  summary: string;
  items: LLMItem[];
}

function expandLLMResponse(raw: LLMResponseRaw): LLMResponse {
  return {
    title: raw.t,
    summary: raw.s,
    items: raw.items.map((i) => ({
      title: i.t,
      description: i.d,
      emoji: i.e,
      estimatedCost: i.ec,
      venueName: i.vn,
      venueAddress: i.va,
      eventId: i.eid,
      venueCategory: i.vc,
      hook: i.hook,
      suggestedActivities: i.sa ?? null,
      journalPrompt: i.jp ?? null,
      difficulty: i.df ?? null,
    })),
  };
}

interface GeocodedData {
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
  googleRating: number | null;
  canonicalAddress: string | null;
}

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

export interface SidequestService {
  listByUser(
    userId: string,
    options?: ListByUserOptions,
  ): Promise<{ data: Sidequest[]; nextCursor: string | null }>;
  getById(id: string, userId?: string): Promise<Sidequest | null>;
  deleteById(id: string, userId: string): Promise<boolean>;
  deleteByIds(ids: string[], userId: string): Promise<number>;
  generateShareToken(id: string, userId: string): Promise<string | null>;
  getByShareToken(shareToken: string): Promise<Sidequest | null>;
  getPopularStops(city: string, limit?: number): Promise<PopularStop[]>;
  rate(
    id: string,
    userId: string,
    rating: number,
    comment?: string,
  ): Promise<Sidequest | null>;
  countCreatedSince(userId: string, since: Date): Promise<number>;
  listCompleted(userId: string, limit?: number): Promise<Sidequest[]>;
  promote(id: string, userId: string): Promise<Sidequest>;
  getDeckStats(userId: string): Promise<DeckStats>;
  searchByUser(
    userId: string,
    query: string,
    limit?: number,
  ): Promise<Sidequest[]>;
  prescribeQuest(
    userId: string,
    input: PrescribeQuestInput,
    onProgress?: SidequestProgressCallback,
  ): Promise<Sidequest>;
  browsePublished(options: BrowsePublishedOptions): Promise<BrowseSidequest[]>;
  listPublishedInternal(
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
  }>;
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
  geocodingService: GoogleGeocodingService;
  overpassService: OverpassService;
  embeddingService?: IEmbeddingService;
  redisService?: RedisService;
  comfortZoneService?: ComfortZoneService;
  coverageService?: CoverageService;
  resonanceService?: ResonanceService;
  pathwayService?: PathwayService;
}

class SidequestServiceImpl implements SidequestService {
  private dataSource: DataSource;
  private openAIService: OpenAIService;
  private geocodingService: GoogleGeocodingService;
  private overpassService: OverpassService;
  private embeddingService?: IEmbeddingService;
  private redisService?: RedisService;
  private comfortZoneService?: ComfortZoneService;
  private coverageService?: CoverageService;
  private resonanceService?: ResonanceService;
  private pathwayService?: PathwayService;
  private agent: OpenAIResponsesAgent;

  constructor(deps: SidequestServiceDeps) {
    this.dataSource = deps.dataSource;
    this.openAIService = deps.openAIService;
    this.geocodingService = deps.geocodingService;
    this.overpassService = deps.overpassService;
    this.embeddingService = deps.embeddingService;
    this.redisService = deps.redisService;
    this.comfortZoneService = deps.comfortZoneService;
    this.coverageService = deps.coverageService;
    this.resonanceService = deps.resonanceService;
    this.pathwayService = deps.pathwayService;
    this.agent = new OpenAIResponsesAgent(deps.openAIService);
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
      qb.andWhere("s.completedAt IS NULL");
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

    const sidequest = await repo.findOne({
      where: { id, userId },
      select: ["id", "isPublished"],
    });

    const result = await repo.softDelete({ id, userId });
    const deleted = (result.affected ?? 0) > 0;

    if (deleted && sidequest?.isPublished) {
      this.publishChange({ id } as Sidequest, "DELETE").catch((err) => {
        console.error("[SidequestService] Failed to publish deletion:", err);
      });
    }

    return deleted;
  }

  async deleteByIds(ids: string[], userId: string): Promise<number> {
    if (ids.length === 0) return 0;

    const repo = this.dataSource.getRepository(Sidequest);

    const sidequests = await repo.find({
      where: { id: In(ids), userId },
      select: ["id", "isPublished"],
    });

    const result = await repo.softDelete({ id: In(ids), userId });
    const deletedCount = result.affected ?? 0;

    for (const sq of sidequests) {
      if (sq.isPublished) {
        this.publishChange({ id: sq.id } as Sidequest, "DELETE").catch((err) => {
          console.error("[SidequestService] Failed to publish deletion:", err);
        });
      }
    }

    return deletedCount;
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

    const wasPublished = sidequest.isPublished;
    sidequest.rating = rating;
    if (comment) sidequest.ratingComment = comment;
    sidequest.isPublished = true;
    await repo.save(sidequest);

    if (!wasPublished) {
      this.publishChange(sidequest, "CREATE").catch((err) => {
        console.error("[SidequestService] Failed to publish change:", err);
      });
    }

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

    const tierOrder: SidequestTier[] = [
      SidequestTier.QUICK,
      SidequestTier.SWEET_SPOT,
      SidequestTier.BEST,
    ];
    const currentIdx = tierOrder.indexOf(
      sidequest.tier ?? SidequestTier.QUICK,
    );
    if (currentIdx >= tierOrder.length - 1) {
      throw new Error("Sidequest is already at the highest tier");
    }

    sidequest.tier = tierOrder[currentIdx + 1];
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

  private async validateAndEnrichObjectives(
    items: LLMItem[],
    verifiedVenues: VerifiedVenue[],
    city: string,
    cityCenter?: { lat: number; lng: number },
    trails: Trail[] = [],
    knownCityState?: string,
  ): Promise<{ item: LLMItem; geo: GeocodedData | null }[]> {
    const venueByName = new Map(
      verifiedVenues.map((v) => [v.name.toLowerCase(), v]),
    );
    const trailByName = new Map(trails.map((t) => [t.name.toLowerCase(), t]));

    const results: ({ item: LLMItem; geo: GeocodedData | null } | null)[] =
      await Promise.all(
        items.map(async (item) => {
          // Trail items: match against OSM trail data
          if (item.venueCategory === "trail" && item.venueName) {
            const matchedTrail = trailByName.get(item.venueName.toLowerCase());
            if (matchedTrail) {
              return {
                item,
                geo: {
                  latitude: matchedTrail.center[1],
                  longitude: matchedTrail.center[0],
                  googlePlaceId: null,
                  googleRating: null,
                  canonicalAddress: null,
                },
              };
            }
          }

          // Venue items: try fuzzy match against pre-fetched verified venues
          if (item.venueName) {
            const itemNameLower = item.venueName.toLowerCase().trim();
            // Exact match first
            let matched = venueByName.get(itemNameLower);
            // Fuzzy: check if any pre-fetched venue name contains or is contained by the item name
            if (!matched) {
              for (const [venueName, venue] of venueByName) {
                if (venueName.includes(itemNameLower) || itemNameLower.includes(venueName)) {
                  matched = venue;
                  break;
                }
              }
            }
            if (matched) {
              const [lng, lat] = matched.coordinates;
              return {
                item,
                geo: {
                  latitude: lat,
                  longitude: lng,
                  googlePlaceId: matched.placeId,
                  googleRating: matched.rating ?? null,
                  canonicalAddress: matched.address,
                },
              };
            }
          }

          // Not in pre-fetched list: verify via Google Places
          const searchQuery = item.venueName
            ? `${item.venueName} ${city}`
            : item.venueAddress
              ? `${item.venueAddress} ${city}`
              : null;

          if (!searchQuery) return { item, geo: null };

          try {
            const placeResult =
              await this.geocodingService.searchPlaceForFrontend(
                searchQuery,
                cityCenter,
                knownCityState,
              );

            if (placeResult.success && placeResult.place) {
              if (
                placeResult.place.businessStatus === "CLOSED_PERMANENTLY" ||
                placeResult.place.businessStatus === "CLOSED_TEMPORARILY"
              ) {
                console.log(
                  `[SidequestService] Dropping closed venue: "${item.venueName}" (${placeResult.place.businessStatus})`,
                );
                return null;
              }

              const [lng, lat] = placeResult.place.coordinates;
              return {
                item,
                geo: {
                  latitude: lat,
                  longitude: lng,
                  googlePlaceId: placeResult.place.placeId,
                  googleRating: placeResult.place.rating ?? null,
                  canonicalAddress: placeResult.place.address,
                },
              };
            }
          } catch {
            // Fall through to address geocoding
          }

          // Fallback: geocode the address directly
          if (item.venueAddress) {
            try {
              const [lng, lat] = await this.geocodingService.geocodeAddress(
                `${item.venueAddress}, ${city}`,
              );
              if (lat !== 0 || lng !== 0) {
                return {
                  item,
                  geo: {
                    latitude: lat,
                    longitude: lng,
                    googlePlaceId: null,
                    googleRating: null,
                    canonicalAddress: null,
                  },
                };
              }
            } catch {
              // Graceful failure
            }
          }

          console.log(
            `[SidequestService] Could not verify venue: "${item.venueName || item.venueAddress}" — keeping with no coordinates`,
          );
          return { item, geo: null };
        }),
      );

    return results.filter(
      (r): r is { item: LLMItem; geo: GeocodedData | null } => r !== null,
    );
  }

  private async generateEnhancements(
    sidequestId: string,
    objectives: Objective[],
  ): Promise<void> {
    const repo = this.dataSource.getRepository(Sidequest);
    const sidequest = await repo.findOne({ where: { id: sidequestId } });
    if (!sidequest) return;

    const updates: Partial<Sidequest> = {};

    // 1. Set entry point from first objective with coordinates
    const sortedObjectives = [...objectives].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const firstGeoObj = sortedObjectives.find(
      (obj) => obj.latitude != null && obj.longitude != null,
    );
    if (firstGeoObj) {
      updates.entryLatitude = firstGeoObj.latitude;
      updates.entryLongitude = firstGeoObj.longitude;
    }

    // 2. Generate embedding — weight categories and title heavily so
    //    searches like "coffee" or "longboarding" match well.
    if (this.embeddingService) {
      try {
        const categories = (sidequest.categories ?? []).join(", ");
        const title = sidequest.title || "";
        const stopsText = sortedObjectives
          .map(
            (obj) =>
              `${obj.title}${obj.venueCategory ? ` (${obj.venueCategory})` : ""}`,
          )
          .join(", ");
        const summary = sidequest.summary || "";

        // Repeat components to weight them: categories 6x, title 4x, stops 3x, summary 1x
        const parts: string[] = [];
        if (categories) parts.push(...Array(6).fill(categories));
        if (title) parts.push(...Array(4).fill(title));
        if (stopsText) parts.push(...Array(3).fill(stopsText));
        if (summary) parts.push(summary);

        const embeddingSql =
          await this.embeddingService.getEmbeddingSql(parts.join(". "));
        updates.embedding = embeddingSql;
      } catch (error) {
        console.error(
          `[SidequestService] Error generating embedding for ${sidequestId}:`,
          error,
        );
      }
    }

    // 3. Generate category tags (skip if already populated inline)
    if (!sidequest.categories || sidequest.categories.length === 0) {
      try {
        const stopsForCategories = sortedObjectives
          .map(
            (obj) =>
              `${obj.title}${obj.venueCategory ? ` (${obj.venueCategory})` : ""}${obj.description ? ` — ${obj.description}` : ""}`,
          )
          .join("; ");

        const completion = await this.openAIService.executeChatCompletion({
          model: OpenAIModel.GPT54Nano,
          messages: [
            {
              role: "system",
              content:
                'You generate category tags for sidequests. Return a JSON object with a "tags" key containing an array of 3-5 lowercase single-word tags that describe the sidequest\'s themes. Examples: {"tags": ["outdoor", "food", "culture", "nightlife", "art"]}. Respond with ONLY the JSON object.',
            },
            {
              role: "user",
              content: `Title: ${sidequest.title || "Untitled"}\nSummary: ${sidequest.summary || "N/A"}\nStops: ${stopsForCategories}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 100,
          response_format: { type: "json_object" },
        });

        const raw = completion.choices[0].message.content?.trim();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            const arr = Array.isArray(parsed) ? parsed : parsed.tags;
            if (Array.isArray(arr)) {
              updates.categories = arr
                .filter((t: unknown) => typeof t === "string")
                .slice(0, 5)
                .map((t: string) => t.toLowerCase());
            }
          } catch {
            console.warn(
              `[SidequestService] Failed to parse category tags: ${raw}`,
            );
          }
        }
      } catch (error) {
        console.error(
          `[SidequestService] Error generating categories for ${sidequestId}:`,
          error,
        );
      }
    }

    // 4. Find entry points for trails, parks, and attractions
    const entryPointCategories = ["trail", "park", "attraction"];
    const objectivesNeedingEntryPoints = sortedObjectives.filter(
      (obj) =>
        obj.latitude != null &&
        obj.longitude != null &&
        obj.venueCategory &&
        entryPointCategories.includes(obj.venueCategory),
    );

    if (objectivesNeedingEntryPoints.length > 0) {
      const objectiveRepo = this.dataSource.getRepository(Objective);
      const entryPointResults = await Promise.all(
        objectivesNeedingEntryPoints.map(async (obj) => {
          try {
            const entryPoint =
              await this.geocodingService.searchEntryPoint(
                Number(obj.latitude),
                Number(obj.longitude),
                obj.venueCategory!,
              );
            return { objId: obj.id, entryPoint };
          } catch (error) {
            console.warn(
              `[SidequestService] Entry point search failed for "${obj.title}":`,
              error,
            );
            return { objId: obj.id, entryPoint: null };
          }
        }),
      );

      for (const { objId, entryPoint } of entryPointResults) {
        if (entryPoint) {
          await objectiveRepo.update(objId, {
            entryLatitude: entryPoint.latitude,
            entryLongitude: entryPoint.longitude,
            entryPointName: entryPoint.name,
          });
        }
      }
    }

    // Save updates
    if (Object.keys(updates).length > 0) {
      await repo.update(sidequestId, updates as Record<string, unknown>);
    }

    // Publish to community map
    if (updates.entryLatitude != null && updates.entryLongitude != null) {
      const fresh = await repo.findOne({ where: { id: sidequestId } });
      if (fresh) {
        this.publishChange(fresh, "CREATE").catch((err) => {
          console.error(
            `[SidequestService] Failed to publish new sidequest ${sidequestId}:`,
            err,
          );
        });
      }
    }
  }

  private async countCompletedQuests(userId: string): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM sidequests WHERE user_id = $1 AND completed_at IS NOT NULL AND deleted_at IS NULL`,
      [userId],
    );
    return result[0]?.count ?? 0;
  }

  private projectPoint(
    lat: number,
    lng: number,
    bearingDeg: number,
    distanceMiles: number,
  ): { lat: number; lng: number } {
    const R = 3958.8; // Earth radius in miles
    const d = distanceMiles / R;
    const brng = (bearingDeg * Math.PI) / 180;
    const lat1 = (lat * Math.PI) / 180;
    const lng1 = (lng * Math.PI) / 180;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
      );

    return {
      lat: (lat2 * 180) / Math.PI,
      lng: (lng2 * 180) / Math.PI,
    };
  }

  private haversineDistanceMiles(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 3958.8;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async publishChange(
    sidequest: Sidequest,
    operation: "CREATE" | "UPDATE" | "DELETE",
  ): Promise<void> {
    if (!this.redisService) return;

    try {
      if (operation === "DELETE") {
        await this.redisService.publishMessage("sidequest_changes", {
          operation,
          record: { id: sidequest.id },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const full = await this.dataSource.getRepository(Sidequest).findOne({
        where: { id: sidequest.id },
        relations: ["objectives"],
      });

      if (!full) return;

      const objectives = (full.objectives || [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((obj) => ({
          id: obj.id,
          title: obj.title,
          emoji: obj.emoji ?? null,
          latitude: obj.latitude != null ? Number(obj.latitude) : null,
          longitude: obj.longitude != null ? Number(obj.longitude) : null,
          venueCategory: obj.venueCategory,
          sortOrder: obj.sortOrder,
        }));

      await this.redisService.publishMessage("sidequest_changes", {
        operation,
        record: {
          id: full.id,
          title: full.title,
          summary: full.summary,
          city: full.city,
          categories: full.categories,
          embedding: full.embedding,
          entryLatitude: full.entryLatitude != null ? Number(full.entryLatitude) : null,
          entryLongitude: full.entryLongitude != null ? Number(full.entryLongitude) : null,
          rating: full.rating != null ? Number(full.rating) : null,
          timesAdopted: full.timesAdopted,
          items: objectives,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[SidequestService] Error publishing change:", error);
    }
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
  // ─── Prescribed Quest (Wellness Pivot) ───────────────────────────

  async prescribeQuest(
    userId: string,
    input: PrescribeQuestInput,
    onProgress?: SidequestProgressCallback,
  ): Promise<Sidequest> {
    if (!this.comfortZoneService) {
      throw new Error("ComfortZoneService required for prescribeQuest");
    }

    const repo = this.dataSource.getRepository(Sidequest);
    const objectiveRepo = this.dataSource.getRepository(Objective);

    // 1. Get comfort zone + user profile
    const zone = await this.comfortZoneService.getComfortZone(userId);
    if (!zone.hasHomeAnchor) {
      // Set home from current location on first prescription
      await this.comfortZoneService.detectHomeAnchor(
        userId,
        input.latitude,
        input.longitude,
      );
    }

    // Recalculate radius based on history
    const radius = await this.comfortZoneService.recalculateRadius(userId);

    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: [
        "id",
        "homeLatitude",
        "homeLongitude",
        "comfortProfile",
        "onboardingProfile",
        "pacePreference",
        "behavioralProfile",
      ],
    });

    if (!user) throw new Error("User not found");

    const homeLat = Number(user.homeLatitude ?? input.latitude);
    const homeLng = Number(user.homeLongitude ?? input.longitude);

    // Detect if user is away from home (e.g. at work)
    const currentLat = input.latitude;
    const currentLng = input.longitude;
    const distFromHome = this.haversineDistanceMiles(
      homeLat,
      homeLng,
      currentLat,
      currentLng,
    );
    // If user is more than 2x their comfort radius from home, search near
    // their current location instead — they're clearly somewhere else
    const isAwayFromHome = distFromHome > radius * 2;
    let searchLat = isAwayFromHome ? currentLat : homeLat;
    let searchLng = isAwayFromHome ? currentLng : homeLng;

    // 2. Build behavioral context from history
    const historyContext = await this.buildPrescriptionContext(
      userId,
      user.behavioralProfile ?? null,
      user.comfortProfile?.goalTags ?? [],
    );

    // 2b. Build coverage context (Voronoi directional gaps + exploration profile)
    let coverageContext = "";
    let explorationProfileLabel = "";
    let expansionTarget = "";
    if (this.coverageService) {
      try {
        const coverage = await this.coverageService.buildLLMCoverageContext(userId);
        coverageContext = coverage.context;
        explorationProfileLabel = coverage.profile.label;

        // If there's a significant directional gap AND the user has grown enough,
        // compute a search target in that direction and shift the search location.
        // Force a fresh snapshot to avoid stale cache from early quests.
        const snapshot = await this.coverageService.recomputeSnapshot(userId);
        const completedCount = await this.countCompletedQuests(userId);
        const snapshotGaps = (snapshot.directionalGaps ?? []) as { direction: string; angleDeg: number; gapWidthDeg: number }[];
        console.log(`[prescribeQuest] Expansion check: ${completedCount} quests, radius ${radius.toFixed(1)}mi, ${snapshotGaps.length} gaps, clusters ${snapshot.clusterCount}`);
        if (snapshotGaps.length > 0) {
          console.log(`[prescribeQuest] Gaps: ${snapshotGaps.map(g => `${g.direction}(${g.gapWidthDeg.toFixed(0)}deg)`).join(", ")}`);
        }
        if (snapshotGaps.length > 0 && completedCount >= 5 && radius >= 2.5) {
          const biggestGap = [...snapshotGaps].sort((a, b) => b.gapWidthDeg - a.gapWidthDeg)[0];
          if (biggestGap.gapWidthDeg >= 45) {
            // Project a point at the edge of comfort radius in the gap direction
            const targetDistMiles = Math.max(4, radius * 0.85);
            const targetPoint = this.projectPoint(homeLat, homeLng, biggestGap.angleDeg, targetDistMiles);

            // Shift search location to the projected point
            searchLat = targetPoint.lat;
            searchLng = targetPoint.lng;

            // Re-geocode the new search location for the city name
            try {
              const targetCity = await this.geocodingService.reverseGeocodeCityState(
                targetPoint.lat,
                targetPoint.lng,
              );
              if (targetCity && targetCity !== "Unknown") {
                city = targetCity;
              }
            } catch {
              // Keep existing city name if geocode fails
            }

            console.log(
              `[prescribeQuest] Expansion: shifting search ${targetDistMiles.toFixed(1)}mi ${biggestGap.direction} ` +
              `to (${searchLat.toFixed(4)}, ${searchLng.toFixed(4)}) = "${city}" (gap ${biggestGap.gapWidthDeg.toFixed(0)}deg)`,
            );

            expansionTarget = `\nEXPANSION TARGET: The user has a ${biggestGap.gapWidthDeg.toFixed(0)}-degree unexplored gap to the ${biggestGap.direction.toUpperCase()}. ` +
              `You are searching ${targetDistMiles.toFixed(1)} miles ${biggestGap.direction} of their home. ` +
              `Search for venues near (${searchLat.toFixed(4)}, ${searchLng.toFixed(4)}) in or around "${city}". ` +
              `Do NOT search in Frederick — explore this new area.`;
          }
        }
      } catch (err) {
        console.error("[prescribeQuest] Coverage context failed:", err);
      }
    }

    // 2c. Build phase context from pathways (BFS/DFS)
    let phaseContext = "";
    if (this.pathwayService) {
      try {
        const phase = await this.pathwayService.getUserPhaseContext(userId);
        phaseContext = phase.recommendation;
      } catch (err) {
        console.error("[prescribeQuest] Phase context failed:", err);
      }
    }

    // 3. Reverse geocode for city (from search location, may be overridden by expansion target)
    let city = "Unknown";
    try {
      city = await this.geocodingService.reverseGeocodeCityState(
        searchLat,
        searchLng,
      );
    } catch {
      // Fall through with Unknown
    }

    // 4. Create the sidequest record
    const sidequest = repo.create({
      userId,
      city: normalizeCity(city),
      status: SidequestStatus.GENERATING,
      radiusMiles: radius,
      budgetMax: 0,
      activityTypes: user.onboardingProfile?.activities ?? [],
      prescribed: true,
      entryLatitude: searchLat,
      entryLongitude: searchLng,
    });
    await repo.save(sidequest);

    try {
      // 5. Generate via agent
      const allVenues: VerifiedVenue[] = [];
      const seenVenueIds = new Set<string>();
      const allTrails: Trail[] = [];
      const seenTrailIds = new Set<number>();

      const now = new Date();
      const hour = now.getHours();
      const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

      const pace = user.pacePreference ?? "steady";
      const comfortProfile = user.comfortProfile;

      const profileOneLiner: Record<string, string> = {
        early_explorer: "New user. Stay close, stay gentle. Build the habit of going out.",
        depth_focused: "Keeps returning to same spots. Nudge toward a new direction — even a familiar category in a new part of town counts.",
        breadth_focused: "Explores widely but doesn't revisit. If a cluster has repeat visits and diverse categories, prescribe a new experience there.",
        well_rounded: "Strong coverage. Challenge them — push further, try unusual categories, or explore the widest directional gap.",
      };

      const instructions = `You are a Comfort Zone Expansion Coach. You prescribe ONE location-based quest designed to gently expand this user's real world.

YOUR APPROACH:
- This is exposure therapy wrapped in adventure. The goal is to get the user slightly outside their comfort zone — not overwhelm them.
- Stretch on ONE dimension at a time: either further distance (familiar category) OR unfamiliar category (familiar distance). Never both.
- The user's current comfort radius is ${radius.toFixed(1)} miles from home. Use this as context, NOT as a target to push past.
- Keep it achievable. One stop. Low friction. The win is them going, not the venue being perfect.

EXPANSION PHILOSOPHY:
${phaseContext || "- Breadth-first by default. Push into unexplored directions until the user finds an area worth investing in.\n- Only go deeper in an area if the user has ORGANICALLY revisited it (multiple visits, diverse categories). That's the signal they found \"their place.\""}
- A comedy open mic across the street is more impactful than driving across the state for coffee. Distance is NOT progress — novelty is.
- Never prescribe further just because you can. The goal is meaningful expansion, not mileage.${explorationProfileLabel ? `\n- Exploration profile: ${explorationProfileLabel} — ${profileOneLiner[explorationProfileLabel] ?? ""}` : ""}

USER PROFILE:
- Home: (${homeLat.toFixed(4)}, ${homeLng.toFixed(4)})
- Currently near: ${city} (${searchLat.toFixed(4)}, ${searchLng.toFixed(4)})${isAwayFromHome ? ` — ${distFromHome.toFixed(1)} miles from home` : ""}
- Comfort radius: ${radius.toFixed(1)} miles
${isAwayFromHome ? "- USER IS AWAY FROM HOME. Search near their CURRENT location, not their home. Keep it easy — they're already out of their usual zone." : ""}
- Pace: ${pace === "gentle" ? "Gentle — ease them in, stay close, familiar categories" : pace === "push_me" ? "Push me — they want to be challenged, stretch further" : "Steady — balanced expansion, moderate stretches"}
${comfortProfile ? `- What keeps them from going out: "${comfortProfile.barriers}"` : ""}
${comfortProfile?.goalTags?.length ? `- Goals: ${comfortProfile.goalTags.join(", ")}` : ""}
${comfortProfile?.goals ? `- Additional context: "${comfortProfile.goals}"` : ""}
${user.onboardingProfile?.activities?.length ? `- Activities they enjoy: ${user.onboardingProfile.activities.join(", ")}` : ""}

${historyContext}
${coverageContext ? `\n${coverageContext}\n` : ""}${expansionTarget ? `\n${expansionTarget}\n` : ""}
TOOLS:
- web_search: discover interesting spots
- search_places: verify venues with Google Places (exact name, address, coordinates)
- search_trails: find trails/paths from OpenStreetMap
- submit_quest: finalize the quest (TERMINAL)

CONSTRAINTS:
- EXACTLY 1 stop. This is a single-destination quest.
- Use EXACT venue names and addresses from search_places results.
- For trails, use ONLY trails returned by search_trails.
- Current time: ${hour}:00, ${dayOfWeek} — don't pick closed venues.
- Title: 3-6 words, encouraging and warm (not clinical).
- Summary: 1-2 sentences framing why this quest matters for their growth.
- hook: why THIS spot expands their world (1 sentence).
- sa (suggested activities): 3-4 things they could do at this spot. Each should start with an emoji. Keep it casual and short. Example: ["🚶 Walk the loop", "📖 Bring a book", "📸 Snap a photo", "☕ Grab a drink"]. Not assignments — just ideas.
- jp (journal prompt): a reflective question for after the visit. Short, open-ended. Examples: "How did it feel being somewhere new?", "Would you come back?", "What surprised you?"
- df (difficulty): 1-5 integer. 1 = very easy (familiar, close, low effort), 3 = moderate stretch, 5 = big push. Based on distance from home relative to their comfort radius, category familiarity, and social demands of the venue.
${hour >= 22 || hour < 6 ? `\nLATE-NIGHT MODE: It's late — focus on 24-hour spots, scenic night walks/viewpoints, or a "plan for tomorrow morning" quest.` : ""}`;

      type Tool = import("openai/resources/responses/responses").Tool;
      const tools: Tool[] = [
        {
          type: "web_search",
          user_location: {
            type: "approximate",
            city,
            country: "US",
          },
          search_context_size: "medium",
        },
        {
          type: "function",
          name: "search_places",
          description:
            "Search Google Places for verified venues near a location. Returns name, address, coordinates, rating.",
          parameters: {
            type: "object" as const,
            properties: {
              query: {
                type: "string",
                description: "Search query (e.g. 'coffee shop', 'park', 'bookstore')",
              },
              near: {
                type: "string",
                description: "City/town to search near",
              },
            },
            required: ["query", "near"],
          },
          strict: false,
        },
        {
          type: "function",
          name: "search_trails",
          description:
            "Search for trails/paths near coordinates. Returns name, surface type, length, lighting.",
          parameters: {
            type: "object" as const,
            properties: {
              type: {
                type: "string",
                enum: ["paved", "hiking"],
                description: "Trail type",
              },
              lat: { type: "number", description: "Latitude" },
              lng: { type: "number", description: "Longitude" },
              radius_miles: {
                type: "number",
                description: "Search radius in miles (default 10)",
              },
            },
            required: ["type", "lat", "lng"],
          },
          strict: false,
        },
        {
          type: "function",
          name: "submit_quest",
          description: "Submit the final prescribed quest with exactly 1 stop.",
          parameters: {
            type: "object" as const,
            properties: {
              t: { type: "string", description: "Quest title (3-6 words)" },
              s: {
                type: "string",
                description: "Quest summary (1-2 sentences, frame why this matters)",
              },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    t: { type: "string", description: "Stop title" },
                    d: { type: "string", description: "Stop description" },
                    e: { type: "string", description: "Emoji" },
                    ec: {
                      type: ["number", "null"],
                      description: "Estimated cost",
                    },
                    vn: { type: "string", description: "Venue name (exact)" },
                    va: { type: "string", description: "Venue address (exact)" },
                    vc: {
                      type: "string",
                      description:
                        "Category: cafe|trail|park|restaurant|bar|museum|gallery|market|venue|attraction|other",
                    },
                    hook: {
                      type: "string",
                      description: "Why this spot expands their world",
                    },
                    sa: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "3-4 activity ideas, each starting with an emoji (e.g. '🚶 Walk the loop')",
                    },
                    jp: {
                      type: "string",
                      description:
                        "Journal prompt — reflective question for after the visit",
                    },
                    df: {
                      type: "number",
                      description:
                        "Difficulty 1-5. 1=very easy, 3=moderate stretch, 5=big push",
                    },
                  },
                  required: ["t", "d", "e", "ec", "vn", "va", "vc", "hook", "sa", "jp", "df"],
                },
                maxItems: 1,
                minItems: 1,
              },
            },
            required: ["t", "s", "items"],
          },
          strict: false,
        },
      ];

      // Tool handlers (reuse same patterns as generateSingleOption)
      const toolHandlers: Record<
        string,
        (args: Record<string, unknown>) => Promise<AgentToolResult>
      > = {
        search_places: async (args) => {
          const query = args.query as string;
          const near = args.near as string;
          try {
            const venues =
              await this.geocodingService.searchPlacesByCategory(
                query,
                near,
                undefined,
                5,
              );

            for (const v of venues) {
              if (!seenVenueIds.has(v.placeId)) {
                seenVenueIds.add(v.placeId);
                allVenues.push(v);
              }
            }

            const resultText =
              venues.length > 0
                ? venues
                    .map((v) => {
                      const [lng, lat] = v.coordinates;
                      return `- ${v.name} (${v.address}) [${lat.toFixed(4)},${lng.toFixed(4)}]${v.rating ? ` ★${v.rating}` : ""}`;
                    })
                    .join("\n")
                : "No results found for this search.";

            if (onProgress && venues.length > 0) {
              await onProgress(
                40,
                `Found ${venues.length} spots for "${query}"`,
                venues.map((v) => ({
                  name: v.name,
                  coordinates: v.coordinates,
                  type: "venue" as const,
                  rating: v.rating,
                  query,
                })),
              );
            }

            return { output: resultText };
          } catch (err) {
            return {
              output: `Search failed: ${err instanceof Error ? err.message : "unknown error"}`,
            };
          }
        },

        search_trails: async (args) => {
          const trailType = (args.type as string) || "paved";
          const searchLat = args.lat as number;
          const searchLng = args.lng as number;
          const searchRadiusMiles = (args.radius_miles as number) || 10;
          const searchRadiusMeters = searchRadiusMiles * 1609.34;

          try {
            const foundTrails =
              trailType === "hiking"
                ? await this.overpassService.fetchHikingTrails(
                    searchLat,
                    searchLng,
                    searchRadiusMeters,
                    10,
                  )
                : await this.overpassService.fetchPavedTrails(
                    searchLat,
                    searchLng,
                    searchRadiusMeters,
                    10,
                  );

            for (const t of foundTrails) {
              if (!seenTrailIds.has(t.id)) {
                seenTrailIds.add(t.id);
                allTrails.push(t);
              }
            }

            const resultText =
              foundTrails.length > 0
                ? foundTrails
                    .map((t) => {
                      const [tLng, tLat] = t.center;
                      const dist = this.haversineDistanceMiles(
                        searchLat,
                        searchLng,
                        tLat,
                        tLng,
                      );
                      return `- ${t.name} (${t.surface}, ${(t.lengthMeters / 1000).toFixed(1)}km${t.lit ? ", lit" : ""}) [${tLat.toFixed(4)},${tLng.toFixed(4)}] ~${dist.toFixed(1)}mi away`;
                    })
                    .join("\n")
                : `No ${trailType} trails found in this area.`;

            if (onProgress && foundTrails.length > 0) {
              await onProgress(
                40,
                `Discovered ${foundTrails.length} ${trailType} trails nearby`,
                foundTrails.map((t) => {
                  const [tLng, tLat] = t.center;
                  return {
                    name: t.name,
                    coordinates: t.center as [number, number],
                    type: "trail" as const,
                    distanceMiles: this.haversineDistanceMiles(
                      searchLat,
                      searchLng,
                      tLat,
                      tLng,
                    ),
                    query: `${trailType} trails`,
                  };
                }),
              );
            }

            return { output: resultText };
          } catch (err) {
            return {
              output: `Trail search failed: ${err instanceof Error ? err.message : "unknown error"}`,
            };
          }
        },

        submit_quest: async (args) => {
          const questData = args as unknown as LLMResponseRaw;

          // Enforce single stop
          if (questData.items && questData.items.length > 1) {
            questData.items = questData.items.slice(0, 1);
          }

          // Validate trail stops
          const trailItems = (questData.items || []).filter(
            (item) => item.vc === "trail",
          );
          for (const item of trailItems) {
            const itemName = (item.vn || "").toLowerCase().trim();
            const matched = allTrails.some((t) => {
              const trailName = t.name.toLowerCase().trim();
              return (
                trailName === itemName ||
                trailName.includes(itemName) ||
                itemName.includes(trailName)
              );
            });

            if (!matched && allTrails.length > 0) {
              const availableTrails = allTrails
                .slice(0, 5)
                .map((t) => t.name)
                .join(", ");
              return {
                output: "",
                rejection: `REJECTED: Trail "${item.vn}" was not found in your search_trails results. Available trails: ${availableTrails}. Call submit_quest again with a trail from that list.`,
              };
            }
          }

          return { output: "Quest accepted", terminal: true };
        },
      };

      const initialMessage = `Prescribe a comfort-zone expansion quest for this user.
${isAwayFromHome ? `They're currently in ${city}, about ${distFromHome.toFixed(1)} miles from home. Search near their CURRENT location.` : `Their home is in ${city}. Search within ~${radius.toFixed(0)} miles of their home location.`}
${user.onboardingProfile?.activities?.length ? `They enjoy: ${user.onboardingProfile.activities.join(", ")}` : "Surprise them with something approachable."}`;

      if (onProgress) {
        await onProgress(10, "Analyzing your comfort zone...");
      }

      const agentResult = await this.agent.run<LLMResponseRaw>(
        {
          instructions,
          tools,
          toolHandlers,
          maxRounds: 8,
          temperature: 0.8,
          maxOutputTokens: 2500,
          caller: "prescribe_quest",
        },
        initialMessage,
      );

      if (onProgress) {
        await onProgress(80, "Building your quest...");
      }

      const llmResult = expandLLMResponse(agentResult.result);

      // Validate and enrich objectives
      const cityCenter = { lat: homeLat, lng: homeLng };
      const validatedItems = await this.validateAndEnrichObjectives(
        llmResult.items,
        allVenues,
        city,
        cityCenter,
        allTrails,
        city,
      );

      // Compute distance from home for the primary objective
      const primaryItem = validatedItems[0];
      let distanceFromHome: number | undefined;
      const objLat = primaryItem?.geo?.latitude;
      const objLng = primaryItem?.geo?.longitude;
      if (objLat != null && objLng != null) {
        distanceFromHome = this.haversineDistanceMiles(
          homeLat,
          homeLng,
          objLat,
          objLng,
        );
      }

      // Assign rarity (with coverage gap boost)
      let rarity = "common";
      if (
        distanceFromHome != null &&
        primaryItem?.item.venueCategory
      ) {
        let inCoverageGap = false;
        if (this.coverageService && objLat && objLng) {
          try {
            inCoverageGap = await this.coverageService.isInCoverageGap(
              userId,
              objLat,
              objLng,
            );
          } catch {
            // Non-critical, proceed without boost
          }
        }
        rarity = await this.comfortZoneService!.assignRarity(
          userId,
          distanceFromHome,
          primaryItem.item.venueCategory,
          inCoverageGap,
        );
      }

      // Save objectives with new wellness fields
      const objectives = validatedItems.map((vi, idx) =>
        objectiveRepo.create({
          sidequestId: sidequest.id,
          sortOrder: idx,
          title: vi.item.title,
          description: vi.item.description,
          emoji: vi.item.emoji,
          estimatedCost: vi.item.estimatedCost ?? undefined,
          venueName: vi.item.venueName ?? undefined,
          venueAddress:
            vi.geo?.canonicalAddress ?? vi.item.venueAddress ?? undefined,
          venueCategory: vi.item.venueCategory ?? undefined,
          hook: vi.item.hook ?? undefined,
          latitude: vi.geo?.latitude ?? undefined,
          longitude: vi.geo?.longitude ?? undefined,
          suggestedActivities: vi.item.suggestedActivities ?? [],
          journalPrompt: vi.item.journalPrompt ?? undefined,
          difficulty: vi.item.difficulty ?? undefined,
        }),
      );
      await objectiveRepo.save(objectives);

      // Update sidequest with results
      sidequest.title = llmResult.title;
      sidequest.summary = llmResult.summary;
      sidequest.status = SidequestStatus.READY;
      sidequest.rarity = rarity;
      sidequest.distanceFromHome = distanceFromHome;

      // Generate category tags inline so the client always has them
      try {
        const stopsForCategories = objectives
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(
            (obj) =>
              `${obj.title}${obj.venueCategory ? ` (${obj.venueCategory})` : ""}${obj.description ? ` — ${obj.description}` : ""}`,
          )
          .join("; ");

        const catCompletion = await this.openAIService.executeChatCompletion({
          model: OpenAIModel.GPT54Nano,
          messages: [
            {
              role: "system",
              content:
                'You generate category tags for sidequests. Return a JSON object with a "tags" key containing an array of 3-5 lowercase single-word tags that describe the sidequest\'s themes. Examples: {"tags": ["outdoor", "food", "culture", "nightlife", "art"]}. Respond with ONLY the JSON object.',
            },
            {
              role: "user",
              content: `Title: ${sidequest.title || "Untitled"}\nSummary: ${sidequest.summary || "N/A"}\nStops: ${stopsForCategories}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 100,
          response_format: { type: "json_object" },
        });

        const raw = catCompletion.choices[0].message.content?.trim();
        if (raw) {
          const parsed = JSON.parse(raw);
          const arr = Array.isArray(parsed) ? parsed : parsed.tags;
          if (Array.isArray(arr)) {
            sidequest.categories = arr
              .filter((t: unknown) => typeof t === "string")
              .slice(0, 5)
              .map((t: string) => t.toLowerCase());
          }
        }
      } catch (catErr) {
        console.error(
          `[SidequestService] Failed to generate categories inline for ${sidequest.id}:`,
          catErr,
        );
      }

      await repo.save(sidequest);

      // Generate remaining enhancements async (embedding, entry points)
      this.generateEnhancements(sidequest.id, objectives).catch((err) => {
        console.error(
          `[SidequestService] Failed to generate enhancements for prescribed quest ${sidequest.id}:`,
          err,
        );
      });

      console.log(
        `[SidequestService] Prescribed quest ${sidequest.id} for user ${userId}: "${llmResult.title}" (${rarity}, ${distanceFromHome?.toFixed(1) ?? "?"}mi from home)`,
      );

      // Reload with objectives
      const loaded = await repo.findOne({
        where: { id: sidequest.id },
        relations: ["objectives"],
        order: { objectives: { sortOrder: "ASC" } },
      });
      return loaded ?? sidequest;
    } catch (error) {
      console.error("[SidequestService] Prescription failed:", error);
      sidequest.status = SidequestStatus.FAILED;
      await repo.save(sidequest);
      throw error;
    }
  }

  /**
   * Build context string for the prescription agent based on user's quest history.
   * Uses cached behavioral profile when available, falls back to raw queries.
   */
  private async buildPrescriptionContext(
    userId: string,
    behavioralProfile: { summary: string; generatedAt: string; questCount: number } | null,
    goalTags: string[] = [],
  ): Promise<string> {
    // Always fetch last 3 quests for recency (avoids immediate repeats)
    const recentQuests: {
      title: string;
      venue_category: string;
      distance_from_home: number;
    }[] = await this.dataSource.query(
      `
      SELECT
        s.title,
        o.venue_category,
        s.distance_from_home
      FROM sidequests s
      LEFT JOIN objectives o ON o.sidequest_id = s.id
      WHERE s.user_id = $1
        AND s.completed_at IS NOT NULL
        AND s.deleted_at IS NULL
      ORDER BY s.completed_at DESC
      LIMIT 3
      `,
      [userId],
    );

    // Always fetch category breakdown for diversity enforcement
    const categories: { venue_category: string; count: number }[] =
      await this.dataSource.query(
        `
      SELECT o.venue_category, COUNT(*)::int as count
      FROM objectives o
      JOIN sidequests s ON s.id = o.sidequest_id
      WHERE s.user_id = $1
        AND o.checked_in_at IS NOT NULL
        AND o.venue_category IS NOT NULL
      GROUP BY o.venue_category
      ORDER BY count DESC
      `,
        [userId],
      );

    const categoryDiversityBlock = this.buildCategoryDiversityBlock(categories);

    // Venue-level repeat intelligence
    const venueRepeats: { venue_name: string; visit_count: number; avg_rating: number; venue_category: string }[] =
      await this.dataSource.query(
        `SELECT
           o.venue_name,
           COUNT(*)::int AS visit_count,
           ROUND(AVG(s.rating)::numeric, 1)::float AS avg_rating,
           o.venue_category
         FROM objectives o
         JOIN sidequests s ON s.id = o.sidequest_id
         WHERE s.user_id = $1
           AND s.completed_at IS NOT NULL
           AND s.deleted_at IS NULL
           AND o.venue_name IS NOT NULL
         GROUP BY o.venue_name, o.venue_category
         HAVING COUNT(*) >= 2
         ORDER BY COUNT(*) DESC
         LIMIT 10`,
        [userId],
      );
    const venueBlock = this.buildVenueRepeatBlock(venueRepeats);

    // City visit counts for diminishing returns
    const cityVisits: { city: string; count: number }[] =
      await this.dataSource.query(
        `SELECT s.city, COUNT(*)::int as count
         FROM sidequests s
         WHERE s.user_id = $1
           AND s.completed_at IS NOT NULL
           AND s.deleted_at IS NULL
           AND s.city IS NOT NULL
         GROUP BY s.city
         ORDER BY count DESC`,
        [userId],
      );
    const cityBlock = this.buildCityDiminishingBlock(cityVisits);

    // Quest arc narrative
    const arcNarrative = await this.buildArcNarrative(userId);

    // If we have a cached behavioral profile, use it
    if (behavioralProfile && behavioralProfile.questCount > 0) {
      const recentList = recentQuests
        .map(
          (q) =>
            `- "${q.title}" (${q.venue_category ?? "unknown"}, ${q.distance_from_home ? Number(q.distance_from_home).toFixed(1) + "mi" : "?mi"})`,
        )
        .join("\n");

      return `BEHAVIORAL PROFILE (based on ${behavioralProfile.questCount} quests, updated ${behavioralProfile.generatedAt}):
${behavioralProfile.summary}
${arcNarrative ? `\nJOURNEY ARC: ${arcNarrative}` : ""}

MOST RECENT QUESTS (avoid repeating these):
${recentList || "(none)"}

${categoryDiversityBlock}
${venueBlock}
${cityBlock}

${await this.buildSocialContext(userId, goalTags)}`;
    }

    // Fallback for new users or pre-migration users: raw query approach
    if (recentQuests.length === 0) {
      return "HISTORY: This is a new user — no completed quests yet. Start gentle and close to home.";
    }

    const recentList = recentQuests
      .map(
        (q) =>
          `- "${q.title}" (${q.venue_category ?? "unknown"}, ${q.distance_from_home ? Number(q.distance_from_home).toFixed(1) + "mi" : "?mi"})`,
      )
      .join("\n");

    return `HISTORY (last ${recentQuests.length} quests):
${recentList}
${arcNarrative ? `\nJOURNEY ARC: ${arcNarrative}` : ""}

${categoryDiversityBlock}
${venueBlock}
${cityBlock}

PRESCRIPTION STRATEGY: Look at their history and prescribe something that meaningfully expands — a new category, a further distance, or an area of town they haven't explored.

${await this.buildSocialContext(userId, goalTags)}`;
  }

  private async buildSocialContext(userId: string, goalTags: string[] = []): Promise<string> {
    const wantsSocial = goalTags.includes("socialize");
    const wantsSkill = goalTags.includes("new_skill");
    const wantsFitness = goalTags.includes("fitness");

    const socialCounts: { social_context: string; count: number }[] =
      await this.dataSource.query(
        `
        SELECT o.social_context, COUNT(*)::int as count
        FROM objectives o
        JOIN sidequests s ON s.id = o.sidequest_id
        WHERE s.user_id = $1
          AND o.checked_in_at IS NOT NULL
          AND o.social_context IS NOT NULL
        GROUP BY o.social_context
        ORDER BY count DESC
        `,
        [userId],
      );

    // No social data yet — only give goal-based guidance
    if (socialCounts.length === 0) {
      if (!wantsSocial && !wantsSkill && !wantsFitness) return "";
      const lines: string[] = [];
      if (wantsSocial) lines.push("SOCIAL GOAL: This user wants to meet people. As they build consistency, start weaving in venues with natural social opportunities (busy cafes, farmer's markets, community events). Don't push group activities until they have a few completions under their belt.");
      if (wantsSkill) lines.push("SKILL GOAL: This user wants to pick up a new skill. When they're ready, consider workshops, classes, or maker spaces — but start with low-commitment options (drop-in, free, no signup).");
      if (wantsFitness) lines.push("FITNESS GOAL: This user wants to get active. Trails and parks are a natural start. As they build the habit, consider group fitness (run clubs, outdoor yoga, climbing gyms).");
      return lines.join("\n");
    }

    const total = socialCounts.reduce((sum, c) => sum + c.count, 0);
    const breakdown = socialCounts
      .map((c) => `${c.social_context}: ${c.count}`)
      .join(", ");

    const soloCount = socialCounts.find((c) => c.social_context === "solo")?.count ?? 0;
    const groupCount = socialCounts.find((c) => c.social_context === "group_activity")?.count ?? 0;
    const metNewCount = socialCounts.find((c) => c.social_context === "met_someone_new")?.count ?? 0;
    const withSomeoneCount = socialCounts.find((c) => c.social_context === "with_someone")?.count ?? 0;
    const socialCount = groupCount + metNewCount + withSomeoneCount;

    const lines: string[] = [`SOCIAL PATTERN (${total} check-ins with social data): ${breakdown}`];

    if (total >= 3 && socialCount === 0 && wantsSocial) {
      lines.push("This user wants to meet people but goes solo every time. Prescribe venues with natural social opportunities (busy cafes, farmer's markets, group fitness classes, community events). Don't force it — just create the conditions.");
    } else if (total >= 5 && groupCount === 0 && soloCount > socialCount && (wantsSocial || wantsSkill || wantsFitness)) {
      lines.push("This user mostly goes solo with occasional company. They haven't tried a group activity yet. If they seem ready (consistent habit, comfortable with the area), a low-pressure group option could be a meaningful stretch — a free outdoor yoga class, a run club, trivia night as a spectator.");
    } else if (groupCount >= 2 || metNewCount >= 2) {
      lines.push("This user is socially active — they've done group activities or met new people. They're comfortable in social settings. Consider prescribing experiences that deepen community connection: recurring events, classes, or spots where they'd become a regular.");
    }

    return lines.join("\n");
  }

  private buildCategoryDiversityBlock(
    categories: { venue_category: string; count: number }[],
  ): string {
    if (categories.length === 0) return "";

    const total = categories.reduce((sum, c) => sum + c.count, 0);
    const categoryList = categories
      .map((c) => `${c.venue_category}: ${c.count}`)
      .join(", ");

    const lines: string[] = [`CATEGORY BREAKDOWN (${total} completed): ${categoryList}`];

    const top = categories[0];
    const topPct = Math.round((top.count / total) * 100);

    // Hard block if one category dominates — kicks in early
    if (top.count >= 2 && topPct >= 40) {
      lines.push(
        `⚠️ CATEGORY OVERLOAD: "${top.venue_category}" accounts for ${topPct}% of all quests (${top.count}/${total}). ` +
        `DO NOT prescribe "${top.venue_category}" this time. Choose a DIFFERENT category. ` +
        `Search for: trail, park, museum, gallery, market, venue, fitness, restaurant, bar — anything they haven't tried or have tried less.`,
      );
    } else if (top.count >= 2 && topPct >= 30) {
      lines.push(
        `NOTE: "${top.venue_category}" is becoming dominant (${top.count}/${total}). Strongly prefer a different category this time.`,
      );
    }

    // Suggest untried categories
    const tried = new Set(categories.map((c) => c.venue_category));
    const allCategories = ["cafe", "trail", "park", "restaurant", "bar", "museum", "gallery", "market", "venue", "attraction"];
    const untried = allCategories.filter((c) => !tried.has(c));
    if (untried.length > 0) {
      lines.push(`UNTRIED CATEGORIES: ${untried.join(", ")} — prioritize exploring these.`);
    }

    return lines.join("\n");
  }

  private async buildArcNarrative(userId: string): Promise<string> {
    // Get journey milestones
    const milestones: {
      total: number;
      first_category: string | null;
      first_city: string | null;
      latest_category: string | null;
      latest_city: string | null;
      unique_cities: number;
      unique_categories: number;
      first_social: string | null;
      latest_social: string | null;
    }[] = await this.dataSource.query(
      `WITH ordered AS (
        SELECT
          o.venue_category,
          s.city,
          o.social_context,
          s.completed_at,
          ROW_NUMBER() OVER (ORDER BY s.completed_at ASC) as rn_asc,
          ROW_NUMBER() OVER (ORDER BY s.completed_at DESC) as rn_desc
        FROM sidequests s
        JOIN objectives o ON o.sidequest_id = s.id
        WHERE s.user_id = $1 AND s.completed_at IS NOT NULL AND s.deleted_at IS NULL
      )
      SELECT
        (SELECT COUNT(*) FROM ordered) as total,
        (SELECT venue_category FROM ordered WHERE rn_asc = 1) as first_category,
        (SELECT city FROM ordered WHERE rn_asc = 1) as first_city,
        (SELECT venue_category FROM ordered WHERE rn_desc = 1) as latest_category,
        (SELECT city FROM ordered WHERE rn_desc = 1) as latest_city,
        (SELECT COUNT(DISTINCT city) FROM ordered) as unique_cities,
        (SELECT COUNT(DISTINCT venue_category) FROM ordered WHERE venue_category IS NOT NULL) as unique_categories,
        (SELECT social_context FROM ordered WHERE social_context IS NOT NULL ORDER BY rn_asc LIMIT 1) as first_social,
        (SELECT social_context FROM ordered WHERE social_context IS NOT NULL ORDER BY rn_desc LIMIT 1) as latest_social`,
      [userId],
    );

    const m = milestones[0];
    if (!m || m.total < 3) return "";

    const parts: string[] = [];

    // Opening: where they started
    parts.push(`This user started with ${m.first_category ?? "a"} quest in ${m.first_city ?? "their hometown"}`);

    // Social arc
    if (m.first_social && m.latest_social && m.first_social !== m.latest_social) {
      const socialLabels: Record<string, string> = {
        solo: "going solo",
        with_someone: "bringing someone along",
        met_someone_new: "meeting new people",
        group_activity: "doing group activities",
      };
      parts.push(
        `went from ${socialLabels[m.first_social] ?? m.first_social} to ${socialLabels[m.latest_social] ?? m.latest_social}`,
      );
    }

    // Expansion
    if (Number(m.unique_cities) > 1) {
      parts.push(`has explored ${m.unique_cities} cities and ${m.unique_categories} categories`);
    } else {
      parts.push(`has tried ${m.unique_categories} different categories`);
    }

    // Current
    parts.push(`and most recently visited a ${m.latest_category ?? "venue"} in ${m.latest_city ?? "their area"}`);

    return parts.join(", ") + ". Frame this quest as the next chapter in their story.";
  }

  private buildCityDiminishingBlock(
    cities: { city: string; count: number }[],
  ): string {
    if (cities.length === 0) return "";

    const total = cities.reduce((sum, c) => sum + c.count, 0);
    if (total < 5) return ""; // Too early to enforce

    const lines: string[] = [];
    const topCity = cities[0];
    const topPct = Math.round((topCity.count / total) * 100);

    const cityList = cities.map((c) => `${c.city}: ${c.count}`).join(", ");
    lines.push(`CITY VISITS (${total} total): ${cityList}`);

    if (topCity.count >= 5 && topPct >= 40) {
      const underexplored = cities.filter((c) => c.count <= 2).map((c) => c.city);
      lines.push(
        `"${topCity.city}" has ${topPct}% of all quests (${topCity.count}/${total}). ` +
        `Prioritize venues in other cities to spread exploration.` +
        (underexplored.length > 0 ? ` Underexplored: ${underexplored.join(", ")}.` : ""),
      );
    }

    return lines.join("\n");
  }

  private buildVenueRepeatBlock(
    venues: { venue_name: string; visit_count: number; avg_rating: number; venue_category: string }[],
  ): string {
    if (venues.length === 0) return "";

    const lines: string[] = ["VENUE REPEATS:"];

    for (const v of venues) {
      const isHighResonance = v.avg_rating >= 4;
      const isLowResonance = v.avg_rating < 3;

      if (v.visit_count >= 4 && isLowResonance) {
        // Lazy repeat — block it
        lines.push(
          `⚠️ "${v.venue_name}" (${v.venue_category}) — ${v.visit_count} visits, avg rating ${v.avg_rating}. ` +
          `This is a low-resonance repeat. DO NOT send them here again. Find a different ${v.venue_category} or a new category entirely.`,
        );
      } else if (v.visit_count >= 3 && !isHighResonance) {
        // Mediocre repeat — discourage
        lines.push(
          `"${v.venue_name}" (${v.venue_category}) — ${v.visit_count} visits, avg rating ${v.avg_rating}. ` +
          `Becoming repetitive without strong signal. Prefer a different venue this time.`,
        );
      } else if (v.visit_count >= 3 && isHighResonance) {
        // Genuine anchor — allow but throttle
        lines.push(
          `"${v.venue_name}" (${v.venue_category}) — ${v.visit_count} visits, avg rating ${v.avg_rating}. ` +
          `This is a high-value anchor for the user. They can return occasionally, but alternate with new venues to keep expanding.`,
        );
      }
    }

    return lines.length > 1 ? lines.join("\n") : "";
  }

  private async computeResonanceAndPathway(
    sidequestId: string,
    userId: string,
  ): Promise<void> {
    if (!this.resonanceService || !this.pathwayService) return;

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
    );

    if (result) {
      console.log(
        `[SidequestService] Resonance ${resonance.score.toFixed(3)} for quest ${sidequestId}, ` +
        `pathway "${result.pathway.themeLabel}" (${result.pathway.phase}, ${result.isNew ? "new" : "updated"})`,
      );
    }
  }
}

export function createSidequestService(
  deps: SidequestServiceDeps,
): SidequestService {
  return new SidequestServiceImpl(deps);
}
