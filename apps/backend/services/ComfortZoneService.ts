import { type DataSource, Not, IsNull } from "typeorm";
import { User, Objective, Sidequest } from "@realtime-markers/database";
import { type OpenAIService, OpenAIModel } from "./shared/OpenAIService";
import { analyzeJournalReflection } from "./ResonanceService";

const DEFAULT_COMFORT_RADIUS_MILES = 2.0;
const MIN_RADIUS_MILES = 0.5;
const MAX_RADIUS_MILES = 100;

// How much to expand per completed quest (before pace multiplier)
const BASE_EXPANSION_MILES = 0.3;

// Pace multipliers
const PACE_MULTIPLIERS: Record<string, number> = {
  gentle: 0.5,
  steady: 1.0,
  push_me: 1.8,
};

export interface ComfortZoneService {
  detectHomeAnchor(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<void>;
  getComfortZone(userId: string): Promise<ComfortZone>;
  recalculateRadius(userId: string): Promise<number>;
  getWorldSize(userId: string): Promise<WorldSize>;
  computeDistanceFromHome(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<number | null>;
  assignRarity(
    userId: string,
    distanceFromHome: number,
    venueCategory: string,
    isInCoverageGap?: boolean,
  ): Promise<string>;
  updateComfortProfile(
    userId: string,
    updates: {
      pacePreference?: string;
      comfortProfile?: { comfortZone: string; barriers: string; goals: string; goalTags?: string[] };
    },
  ): Promise<void>;
  updateObjectiveJournal(
    userId: string,
    objectiveId: string,
    updates: {
      journalEntry?: string;
      completedActivity?: string;
      photoUrl?: string;
      socialContext?: string;
    },
  ): Promise<boolean>;
}

export interface ComfortZone {
  homeLatitude: number | null;
  homeLongitude: number | null;
  comfortRadiusMiles: number;
  pacePreference: string;
  hasHomeAnchor: boolean;
}

export interface WorldSize {
  areaSqMiles: number;
  totalLocations: number;
  furthestMiles: number;
  uniqueCategories: number;
}

interface ComfortZoneServiceDeps {
  dataSource: DataSource;
  openAIService?: OpenAIService;
}

class ComfortZoneServiceImpl implements ComfortZoneService {
  private dataSource: DataSource;
  private openAIService?: OpenAIService;

  constructor(deps: ComfortZoneServiceDeps) {
    this.dataSource = deps.dataSource;
    this.openAIService = deps.openAIService;
  }

  async detectHomeAnchor(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ["id", "homeLatitude", "homeLongitude"],
    });

    if (!user) return;

    // Only set if not already established
    if (user.homeLatitude != null && user.homeLongitude != null) return;

    await this.dataSource.getRepository(User).update(
      { id: userId },
      {
        homeLatitude: latitude,
        homeLongitude: longitude,
        comfortRadiusMiles: DEFAULT_COMFORT_RADIUS_MILES,
      },
    );

    console.log(
      `[ComfortZone] Home anchor set for user ${userId}: ${latitude}, ${longitude}`,
    );
  }

  async getComfortZone(userId: string): Promise<ComfortZone> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: [
        "id",
        "homeLatitude",
        "homeLongitude",
        "comfortRadiusMiles",
        "pacePreference",
      ],
    });

    if (!user) {
      return {
        homeLatitude: null,
        homeLongitude: null,
        comfortRadiusMiles: DEFAULT_COMFORT_RADIUS_MILES,
        pacePreference: "steady",
        hasHomeAnchor: false,
      };
    }

    return {
      homeLatitude: user.homeLatitude ? Number(user.homeLatitude) : null,
      homeLongitude: user.homeLongitude ? Number(user.homeLongitude) : null,
      comfortRadiusMiles: Number(
        user.comfortRadiusMiles ?? DEFAULT_COMFORT_RADIUS_MILES,
      ),
      pacePreference: user.pacePreference ?? "steady",
      hasHomeAnchor: user.homeLatitude != null && user.homeLongitude != null,
    };
  }

  /**
   * Recalculate comfort radius based on completed quest history.
   *
   * Strategy: start at default, grow by BASE_EXPANSION * pace for each
   * completed quest, weighted by recent completion rate.
   * If user missed 2+ weeks, contract slightly toward default to ease
   * them back in.
   */
  async recalculateRadius(userId: string): Promise<number> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: [
        "id",
        "pacePreference",
        "currentStreak",
        "lastStreakWeek",
        "comfortRadiusMiles",
      ],
    });

    if (!user) return DEFAULT_COMFORT_RADIUS_MILES;

    // Count completed prescribed quests
    const completedCount = await this.dataSource
      .getRepository(Sidequest)
      .count({
        where: {
          userId,
          prescribed: true,
          completedAt: Not(IsNull()),
        },
      });

    const pace = PACE_MULTIPLIERS[user.pacePreference ?? "steady"] ?? 1.0;
    let radius =
      DEFAULT_COMFORT_RADIUS_MILES +
      completedCount * BASE_EXPANSION_MILES * pace;

    // Contract if inactive (streak broken for 2+ weeks)
    if (user.lastStreakWeek) {
      const weeksSinceLast = this.weeksSince(user.lastStreakWeek);
      if (weeksSinceLast >= 2) {
        // Shrink toward default by 20% per missed week beyond 1, floor at default
        const contractionFactor = Math.max(0.3, 1 - 0.2 * (weeksSinceLast - 1));
        radius = Math.max(
          DEFAULT_COMFORT_RADIUS_MILES,
          radius * contractionFactor,
        );
      }
    }

    radius = Math.min(MAX_RADIUS_MILES, Math.max(MIN_RADIUS_MILES, radius));

    await this.dataSource
      .getRepository(User)
      .update({ id: userId }, { comfortRadiusMiles: radius });

    return radius;
  }

  /**
   * World Size: convex hull area of all completed objective locations.
   * Uses PostGIS ST_ConvexHull + ST_Area for the polygon calculation.
   */
  async getWorldSize(userId: string): Promise<WorldSize> {
    // Get area via PostGIS convex hull of all checked-in objective locations
    const areaResult: { area_sq_miles: number; total_locations: number }[] =
      await this.dataSource.query(
        `
      WITH checked_points AS (
        SELECT o.latitude, o.longitude
        FROM objectives o
        JOIN sidequests s ON s.id = o.sidequest_id
        WHERE s.user_id = $1
          AND o.checked_in_at IS NOT NULL
          AND o.latitude IS NOT NULL
          AND o.longitude IS NOT NULL
      )
      SELECT
        CASE WHEN COUNT(*) < 3 THEN 0
        ELSE
          ST_Area(
            ST_ConvexHull(
              ST_Collect(
                ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
              )::geometry
            )::geography
          ) / 2589988.11
        END AS area_sq_miles,
        COUNT(*) AS total_locations
      FROM checked_points
      `,
        [userId],
      );

    // Furthest distance from home
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ["id", "homeLatitude", "homeLongitude"],
    });

    let furthestMiles = 0;
    if (user?.homeLatitude != null && user?.homeLongitude != null) {
      const furthestResult: { max_distance_miles: number }[] =
        await this.dataSource.query(
          `
        SELECT COALESCE(
          MAX(
            ST_Distance(
              ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
              ST_SetSRID(ST_MakePoint(o.longitude, o.latitude), 4326)::geography
            ) / 1609.344
          ), 0
        ) AS max_distance_miles
        FROM objectives o
        JOIN sidequests s ON s.id = o.sidequest_id
        WHERE s.user_id = $1
          AND o.checked_in_at IS NOT NULL
          AND o.latitude IS NOT NULL
          AND o.longitude IS NOT NULL
        `,
          [userId, user.homeLongitude, user.homeLatitude],
        );
      furthestMiles = Number(furthestResult[0]?.max_distance_miles ?? 0);
    }

    // Unique categories
    const categoryResult: { unique_categories: number }[] =
      await this.dataSource.query(
        `
      SELECT COUNT(DISTINCT o.venue_category) AS unique_categories
      FROM objectives o
      JOIN sidequests s ON s.id = o.sidequest_id
      WHERE s.user_id = $1
        AND o.checked_in_at IS NOT NULL
        AND o.venue_category IS NOT NULL
      `,
        [userId],
      );

    return {
      areaSqMiles: Number(areaResult[0]?.area_sq_miles ?? 0),
      totalLocations: Number(areaResult[0]?.total_locations ?? 0),
      furthestMiles: Math.round(furthestMiles * 10) / 10,
      uniqueCategories: Number(categoryResult[0]?.unique_categories ?? 0),
    };
  }

  async computeDistanceFromHome(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<number | null> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ["id", "homeLatitude", "homeLongitude"],
    });

    if (!user?.homeLatitude || !user?.homeLongitude) return null;

    return haversineDistanceMiles(
      Number(user.homeLatitude),
      Number(user.homeLongitude),
      latitude,
      longitude,
    );
  }

  /**
   * Assign rarity based on how far outside the comfort zone the quest is
   * and whether the category is new to the user.
   */
  async assignRarity(
    userId: string,
    distanceFromHome: number,
    venueCategory: string,
    isInCoverageGap?: boolean,
  ): Promise<string> {
    const zone = await this.getComfortZone(userId);
    const radius = zone.comfortRadiusMiles;

    // Check if this category is new for the user
    const categoryCount: { count: number }[] = await this.dataSource.query(
      `
      SELECT COUNT(*) as count
      FROM objectives o
      JOIN sidequests s ON s.id = o.sidequest_id
      WHERE s.user_id = $1
        AND o.checked_in_at IS NOT NULL
        AND o.venue_category = $2
      `,
      [userId, venueCategory],
    );
    const isNewCategory = Number(categoryCount[0]?.count ?? 0) === 0;

    const distanceRatio = distanceFromHome / Math.max(radius, 0.1);

    // Both dimensions stretched
    let rarity: string;
    if (distanceRatio > 1.5 && isNewCategory) rarity = "legendary";
    else if (distanceRatio > 1.3 || (distanceRatio > 1.0 && isNewCategory))
      rarity = "epic";
    else if (distanceRatio > 1.0 || isNewCategory) rarity = "rare";
    else if (distanceRatio > 0.7) rarity = "uncommon";
    else rarity = "common";

    // Boost rarity by one tier if quest is in a coverage gap (unexplored direction)
    if (isInCoverageGap) {
      const tiers = ["common", "uncommon", "rare", "epic", "legendary"];
      const idx = tiers.indexOf(rarity);
      if (idx < tiers.length - 1) rarity = tiers[idx + 1];
    }

    return rarity;
  }

  async updateComfortProfile(
    userId: string,
    updates: {
      pacePreference?: string;
      comfortProfile?: { comfortZone: string; barriers: string; goals: string; goalTags?: string[] };
    },
  ): Promise<void> {
    const fields: Record<string, unknown> = {};
    if (updates.pacePreference) fields.pacePreference = updates.pacePreference;
    if (updates.comfortProfile) {
      fields.comfortProfile = Object.fromEntries(
        Object.entries(updates.comfortProfile).map(([k, v]) => [
          k,
          typeof v === "string" ? v.trim() : v,
        ]),
      ) as typeof updates.comfortProfile;
    }

    if (Object.keys(fields).length > 0) {
      await this.dataSource.getRepository(User).update({ id: userId }, fields);
    }
  }

  async updateObjectiveJournal(
    userId: string,
    objectiveId: string,
    updates: {
      journalEntry?: string;
      completedActivity?: string;
      photoUrl?: string;
      socialContext?: string;
    },
  ): Promise<boolean> {
    // Verify ownership via sidequest
    const objective = await this.dataSource.getRepository(Objective).findOne({
      where: { id: objectiveId },
      relations: ["sidequest"],
    });

    if (!objective) return false;

    const sidequest = objective.sidequest as Sidequest;
    if (sidequest.userId !== userId) return false;

    const fields: Record<string, unknown> = {};
    if (updates.journalEntry !== undefined)
      fields.journalEntry = updates.journalEntry;
    if (updates.completedActivity !== undefined)
      fields.completedActivity = updates.completedActivity;
    if (updates.photoUrl !== undefined) fields.photoUrl = updates.photoUrl;
    if (updates.socialContext !== undefined) fields.socialContext = updates.socialContext;

    if (Object.keys(fields).length > 0) {
      await this.dataSource
        .getRepository(Objective)
        .update({ id: objectiveId }, fields);
    }

    // Fire async LLM journal analysis (non-blocking)
    const journalText = updates.journalEntry ?? objective.journalEntry;
    if (journalText && this.openAIService) {
      this.analyzeJournalAsync(objectiveId, journalText).catch((err) =>
        console.error(`[ComfortZoneService] Journal analysis failed for ${objectiveId}:`, err),
      );
    }

    return true;
  }

  private async analyzeJournalAsync(objectiveId: string, journalEntry: string): Promise<void> {
    if (!this.openAIService) return;

    const analysis = await analyzeJournalReflection(this.openAIService, journalEntry);

    await this.dataSource.getRepository(Objective).update(
      { id: objectiveId },
      {
        reflectionDepth: analysis.depth,
        reflectionSentiment: analysis.sentiment,
        reflectionTags: analysis.tags,
      },
    );
  }

  private weeksSince(lastStreakWeek: string): number {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const currentMonday = new Date(now);
    currentMonday.setDate(diff);
    const currentMondayStr = currentMonday.toISOString().slice(0, 10);

    const a = new Date(lastStreakWeek).getTime();
    const b = new Date(currentMondayStr).getTime();
    return Math.round(Math.abs(b - a) / (7 * 24 * 60 * 60 * 1000));
  }
}

function haversineDistanceMiles(
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

export function createComfortZoneService(
  deps: ComfortZoneServiceDeps,
): ComfortZoneService {
  return new ComfortZoneServiceImpl(deps);
}
