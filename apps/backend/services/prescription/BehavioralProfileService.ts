import type { DataSource } from "typeorm";

import { User } from "../../entities/User";
import type {
  BehavioralAggregates,
  BehavioralProfileV1,
  BehavioralProfileV2,
} from "../../entities/User";
import { isBehavioralProfileV2 } from "../../entities/User";
import type { OpenAIService } from "../shared/OpenAIService";
import { OpenAIModel } from "../shared/OpenAIService";

/**
 * Transitional adapter — renders either profile shape into the legacy
 * `{ summary, generatedAt, questCount }` form expected by call sites
 * that haven't been migrated yet. Delete once all callers consume v2 directly.
 */
export function renderLegacyProfile(
  p: BehavioralProfileV1 | BehavioralProfileV2 | null | undefined,
): { summary: string; generatedAt: string; questCount: number } | null {
  if (!p) return null;
  if (!isBehavioralProfileV2(p)) {
    return {
      summary: p.summary,
      generatedAt: p.generatedAt,
      questCount: p.questCount,
    };
  }
  const summary = [
    p.capabilityArc,
    p.categoryAffinity,
    p.venueAffinity,
    p.travelWillingness,
    p.blockerPattern,
  ]
    .filter((s) => s && s.length > 0)
    .join("\n\n");
  return {
    summary,
    generatedAt: p.generatedAt,
    questCount: p.questCount,
  };
}

const MIN_QUESTS_FOR_PROFILE = 2;
const TOP_CATEGORIES_LIMIT = 5;
const TOP_VENUES_LIMIT = 5;
const REJECTED_VENUES_LIMIT = 10;
const ANCHORS_LIMIT = 10;
const RECENT_TRAVEL_WINDOW = 16;
const ANCHOR_MIN_VISITS = 2;
const ANCHOR_MIN_RATING = 3.5;
const NARRATIVE_RECENT_QUESTS = 10;

interface NarrativeSlots {
  capabilityArc: string;
  categoryAffinity: string;
  venueAffinity: string;
  travelWillingness: string;
  blockerPattern: string;
}

interface NarrativeContext {
  primaryGoal: string | null;
  pacePreference: string | null;
  recentQuests: {
    title: string;
    venueName: string | null;
    venueCategory: string | null;
    rating: number | null;
    distanceMiles: number | null;
    completedAt: string;
  }[];
}

export class BehavioralProfileService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly openAIService: OpenAIService,
  ) {}

  /**
   * Refresh the cached profile for a user. Called on quest completion.
   * Returns null if there isn't enough history yet.
   */
  async refresh(userId: string): Promise<BehavioralProfileV2 | null> {
    const aggregates = await this.computeAggregates(userId);
    if (aggregates.completedCount < MIN_QUESTS_FOR_PROFILE) return null;

    const prev = await this.loadPrevProfile(userId);
    const narrativeCtx = await this.loadNarrativeContext(userId);
    const slots = await this.generateNarrative(prev, aggregates, narrativeCtx);
    if (!slots) return null;

    const profile: BehavioralProfileV2 = {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      questCount: aggregates.completedCount,
      ...slots,
      aggregates,
    };

    await this.dataSource
      .getRepository(User)
      .update({ id: userId }, { behavioralProfile: profile });

    return profile;
  }

  // ─── Deterministic aggregates ────────────────────────────────────

  async computeAggregates(userId: string): Promise<BehavioralAggregates> {
    const [
      counts,
      topCategories,
      topVenues,
      rejectedVenues,
      travel,
      anchors,
    ] = await Promise.all([
      this.queryCounts(userId),
      this.queryTopCategories(userId),
      this.queryTopVenues(userId),
      this.queryRejectedVenues(userId),
      this.queryTravelRange(userId),
      this.queryAnchors(userId),
    ]);

    return {
      completedCount: counts.completedCount,
      avgRating: counts.avgRating,
      topCategories,
      topVenues,
      rejectedVenues,
      travelRange: travel,
      anchors,
    };
  }

  private async queryCounts(
    userId: string,
  ): Promise<{ completedCount: number; avgRating: number | null }> {
    const rows: { completed_count: number; avg_rating: number | null }[] =
      await this.dataSource.query(
        `SELECT
           COUNT(*)::int AS completed_count,
           AVG(rating)::float AS avg_rating
         FROM sidequests
         WHERE user_id = $1
           AND completed_at IS NOT NULL
           AND deleted_at IS NULL`,
        [userId],
      );
    const row = rows[0];
    return {
      completedCount: row?.completed_count ?? 0,
      avgRating: row?.avg_rating ?? null,
    };
  }

  private async queryTopCategories(
    userId: string,
  ): Promise<BehavioralAggregates["topCategories"]> {
    const rows: {
      category: string;
      count: number;
      avg_rating: number | null;
    }[] = await this.dataSource.query(
      `SELECT
         o.venue_category AS category,
         COUNT(*)::int AS count,
         ROUND(AVG(s.rating)::numeric, 1)::float AS avg_rating
       FROM objectives o
       JOIN sidequests s ON s.id = o.sidequest_id
       WHERE s.user_id = $1
         AND s.completed_at IS NOT NULL
         AND s.deleted_at IS NULL
         AND o.venue_category IS NOT NULL
       GROUP BY o.venue_category
       ORDER BY count DESC
       LIMIT $2`,
      [userId, TOP_CATEGORIES_LIMIT],
    );
    return rows.map((r) => ({
      category: r.category,
      count: r.count,
      avgRating: r.avg_rating,
    }));
  }

  private async queryTopVenues(
    userId: string,
  ): Promise<BehavioralAggregates["topVenues"]> {
    const rows: {
      venue_name: string;
      count: number;
      avg_rating: number | null;
      last_visited_at: Date;
    }[] = await this.dataSource.query(
      `SELECT
         o.venue_name AS venue_name,
         COUNT(*)::int AS count,
         ROUND(AVG(s.rating)::numeric, 1)::float AS avg_rating,
         MAX(s.completed_at) AS last_visited_at
       FROM objectives o
       JOIN sidequests s ON s.id = o.sidequest_id
       WHERE s.user_id = $1
         AND s.completed_at IS NOT NULL
         AND s.deleted_at IS NULL
         AND o.venue_name IS NOT NULL
       GROUP BY o.venue_name
       ORDER BY count DESC, MAX(s.completed_at) DESC
       LIMIT $2`,
      [userId, TOP_VENUES_LIMIT],
    );
    return rows.map((r) => ({
      venueName: r.venue_name,
      count: r.count,
      avgRating: r.avg_rating,
      lastVisitedAt:
        r.last_visited_at instanceof Date
          ? r.last_visited_at.toISOString()
          : String(r.last_visited_at),
    }));
  }

  private async queryRejectedVenues(
    userId: string,
  ): Promise<BehavioralAggregates["rejectedVenues"]> {
    const rows: { venue_name: string; venue_category: string | null }[] =
      await this.dataSource.query(
        `SELECT DISTINCT o.venue_name, o.venue_category
         FROM objectives o
         JOIN sidequests s ON s.id = o.sidequest_id
         WHERE s.user_id = $1
           AND s.completed_at IS NOT NULL
           AND s.deleted_at IS NULL
           AND o.venue_name IS NOT NULL
           AND o.would_return = false
           AND NOT EXISTS (
             SELECT 1 FROM objectives o2
             JOIN sidequests s2 ON s2.id = o2.sidequest_id
             WHERE o2.venue_name = o.venue_name AND s2.user_id = $1
               AND o2.would_return = true
               AND s2.completed_at > s.completed_at
           )
         ORDER BY o.venue_name
         LIMIT $2`,
        [userId, REJECTED_VENUES_LIMIT],
      );
    return rows.map((r) => ({
      name: r.venue_name,
      category: r.venue_category,
    }));
  }

  private async queryTravelRange(
    userId: string,
  ): Promise<BehavioralAggregates["travelRange"]> {
    const rows: {
      median_miles: number | null;
      max_miles: number | null;
      recent_max_miles: number | null;
    }[] = await this.dataSource.query(
      `WITH ranked AS (
         SELECT
           distance_from_home::float AS d,
           ROW_NUMBER() OVER (ORDER BY completed_at DESC) AS rn
         FROM sidequests
         WHERE user_id = $1
           AND completed_at IS NOT NULL
           AND deleted_at IS NULL
           AND distance_from_home IS NOT NULL
       )
       SELECT
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY d)::float AS median_miles,
         MAX(d)::float AS max_miles,
         MAX(d) FILTER (WHERE rn <= $2)::float AS recent_max_miles
       FROM ranked`,
      [userId, RECENT_TRAVEL_WINDOW],
    );
    const row = rows[0];
    return {
      medianMiles: row?.median_miles ?? 0,
      maxMiles: row?.max_miles ?? 0,
      recentMaxMiles: row?.recent_max_miles ?? 0,
    };
  }

  private async queryAnchors(userId: string): Promise<string[]> {
    const rows: { venue_name: string }[] = await this.dataSource.query(
      `SELECT o.venue_name AS venue_name
       FROM objectives o
       JOIN sidequests s ON s.id = o.sidequest_id
       WHERE s.user_id = $1
         AND s.completed_at IS NOT NULL
         AND s.deleted_at IS NULL
         AND o.venue_name IS NOT NULL
       GROUP BY o.venue_name
       HAVING COUNT(*) >= $2 AND AVG(s.rating) >= $3
       ORDER BY COUNT(*) DESC, AVG(s.rating) DESC
       LIMIT $4`,
      [userId, ANCHOR_MIN_VISITS, ANCHOR_MIN_RATING, ANCHORS_LIMIT],
    );
    return rows.map((r) => r.venue_name);
  }

  // ─── LLM narrative pass ──────────────────────────────────────────

  private async loadPrevProfile(
    userId: string,
  ): Promise<BehavioralProfileV2 | null> {
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: userId }, select: ["id", "behavioralProfile"] });
    return isBehavioralProfileV2(user?.behavioralProfile)
      ? user!.behavioralProfile
      : null;
  }

  private async loadNarrativeContext(
    userId: string,
  ): Promise<NarrativeContext> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ["id", "comfortProfile", "pacePreference"],
    });

    const recent: {
      title: string;
      venue_name: string | null;
      venue_category: string | null;
      rating: number | null;
      distance_from_home: number | null;
      completed_at: Date;
    }[] = await this.dataSource.query(
      `SELECT
         s.title,
         o.venue_name,
         o.venue_category,
         s.rating,
         s.distance_from_home::float AS distance_from_home,
         s.completed_at
       FROM sidequests s
       LEFT JOIN objectives o ON o.sidequest_id = s.id
       WHERE s.user_id = $1
         AND s.completed_at IS NOT NULL
         AND s.deleted_at IS NULL
       ORDER BY s.completed_at DESC
       LIMIT $2`,
      [userId, NARRATIVE_RECENT_QUESTS],
    );

    return {
      primaryGoal: user?.comfortProfile?.primaryGoal ?? null,
      pacePreference: user?.pacePreference ?? null,
      recentQuests: recent.map((r) => ({
        title: r.title,
        venueName: r.venue_name,
        venueCategory: r.venue_category,
        rating: r.rating,
        distanceMiles: r.distance_from_home,
        completedAt:
          r.completed_at instanceof Date
            ? r.completed_at.toISOString()
            : String(r.completed_at),
      })),
    };
  }

  private async generateNarrative(
    prev: BehavioralProfileV2 | null,
    aggregates: BehavioralAggregates,
    ctx: NarrativeContext,
  ): Promise<NarrativeSlots | null> {
    const recentList = ctx.recentQuests
      .map(
        (q) =>
          `- "${q.title}" — ${q.venueName ?? "?"} (${q.venueCategory ?? "?"})${q.rating ? `, ${q.rating}★` : ""}${q.distanceMiles != null ? `, ${q.distanceMiles.toFixed(1)}mi` : ""}`,
      )
      .join("\n");

    const prevSlots = prev
      ? {
          capabilityArc: prev.capabilityArc,
          categoryAffinity: prev.categoryAffinity,
          venueAffinity: prev.venueAffinity,
          travelWillingness: prev.travelWillingness,
          blockerPattern: prev.blockerPattern,
        }
      : null;

    const prompt = `You distill a user's quest history into a behavioral profile that another AI uses to prescribe their next quest. Output VALID JSON ONLY with exactly these 5 string keys:

- capabilityArc: 1-3 sentences. Where the user is in their growth journey. Are they activating? Building micro-conversations? Drilling a specific skill?
- categoryAffinity: 1-3 sentences. What kinds of venues/contexts they lean into vs. cooled on. Reference specific categories from the aggregates.
- venueAffinity: 1-3 sentences. Their anchor venues, frequent repeats, and rejected venues. Reference specific venue names.
- travelWillingness: 1-2 sentences. Observed travel range using the numbers from aggregates.
- blockerPattern: 1-2 sentences. Recurring failure modes if any. If none, say exactly "No recurring blocker pattern."

Each slot must be SHORT, SPECIFIC, and grounded in the aggregates and recent quests. No generic encouragement. Write as notes for another AI, not for the user.

USER GOAL: ${ctx.primaryGoal ?? "(unknown)"}
USER PACE: ${ctx.pacePreference ?? "(unknown)"}

AGGREGATES (deterministic facts — source of truth):
${JSON.stringify(aggregates, null, 2)}

LAST ${ctx.recentQuests.length} QUESTS (most recent first):
${recentList || "(none)"}

PREVIOUS PROFILE (for continuity — update or supersede):
${prevSlots ? JSON.stringify(prevSlots, null, 2) : "(none yet)"}

Return JSON only. No prose, no markdown fences.`;

    const completion = await this.openAIService.executeChatCompletion(
      {
        model: OpenAIModel.GPT54Nano,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.3,
        response_format: { type: "json_object" },
      },
      "behavioral-profile-narrative",
    );

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      const slots: NarrativeSlots = {
        capabilityArc: stringSlot(parsed.capabilityArc),
        categoryAffinity: stringSlot(parsed.categoryAffinity),
        venueAffinity: stringSlot(parsed.venueAffinity),
        travelWillingness: stringSlot(parsed.travelWillingness),
        blockerPattern: stringSlot(parsed.blockerPattern),
      };
      const allFilled = (Object.values(slots) as string[]).every(
        (s) => s.length > 0,
      );
      return allFilled ? slots : null;
    } catch {
      return null;
    }
  }
}

function stringSlot(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
