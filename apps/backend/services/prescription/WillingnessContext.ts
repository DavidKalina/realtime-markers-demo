/**
 * WillingnessContext — what the user has actually been willing to do.
 *
 * Distance is calculated and stored per-quest but, before this module, was
 * never read back. The harness had defensive willingness logic (clamp distance
 * down on TOO_FAR rejections) but no offensive logic (push out when the local
 * map is exhausted). This module aggregates completed-quest distances into a
 * belief the strategist + search envelope + writer can reason from.
 *
 * The signal is observed-only — it never asserts what the user *would* do,
 * only what they have done. Self-reported reachMode lives on the User entity.
 */

import type { DataSource } from "typeorm";

interface WillingnessRow {
  distance_from_home: number | string | null;
  rating: number | null;
  completed_at: Date | null;
}

export type WillingnessSignal =
  /** <5 completed quests; not enough data to read posture. */
  | "untested"
  /** 5+ quests, never exceeded the local ceiling voluntarily. */
  | "local_only"
  /** Has voluntarily completed at least one nearby rep (>=local ceiling). */
  | "nearby_capable"
  /** Has voluntarily completed at least one regional rep (>=nearby ceiling). */
  | "regional_capable";

const LOCAL_CEILING_MILES = 4;
const NEARBY_CEILING_MILES = 12;
const STRETCH_REP_FLOOR_MILES = 8;

export interface WillingnessContext {
  totalCompletedQuests: number;
  maxObservedTravelMiles: number;
  recentMaxTravelMiles: number;
  recentMedianTravelMiles: number;
  completedLocalCount: number;
  completedNearbyCount: number;
  completedRegionalCount: number;
  avgRatingByBucket: {
    local: number | null;
    nearby: number | null;
    regional: number | null;
  };
  recentStretchRepCount: number;
  questsSinceStretchRep: number | null;
  willingnessSignal: WillingnessSignal;
  hasEverTraveledNearby: boolean;
  hasEverTraveledRegional: boolean;
  promptBlock: string;
}

export async function buildWillingnessContext(input: {
  dataSource: DataSource;
  userId: string;
  completedQuestCount: number;
}): Promise<WillingnessContext> {
  const rows: WillingnessRow[] = await input.dataSource.query(
    `SELECT
       s.distance_from_home,
       s.rating,
       s.completed_at
     FROM sidequests s
     WHERE s.user_id = $1
       AND s.deleted_at IS NULL
       AND s.completed_at IS NOT NULL
     ORDER BY s.completed_at DESC
     LIMIT 16`,
    [input.userId],
  );

  const distancesAll = rows.map(coerceDistance);
  const distances = distancesAll.filter(
    (value): value is number => value != null,
  );

  const totalCompletedQuests = input.completedQuestCount;
  const maxObservedTravelMiles =
    distances.length > 0 ? Math.max(...distances) : 0;

  const recent5Distances = distancesAll.slice(0, 5).filter(
    (value): value is number => value != null,
  );
  const recentMaxTravelMiles =
    recent5Distances.length > 0 ? Math.max(...recent5Distances) : 0;
  const recentMedianTravelMiles =
    recent5Distances.length > 0 ? median(recent5Distances) : 0;

  let completedLocalCount = 0;
  let completedNearbyCount = 0;
  let completedRegionalCount = 0;
  const ratingsByBucket = {
    local: [] as number[],
    nearby: [] as number[],
    regional: [] as number[],
  };
  for (const row of rows.slice(0, 8)) {
    const dist = coerceDistance(row);
    if (dist == null) continue;
    if (dist < LOCAL_CEILING_MILES) {
      completedLocalCount += 1;
      if (row.rating != null) ratingsByBucket.local.push(row.rating);
    } else if (dist < NEARBY_CEILING_MILES) {
      completedNearbyCount += 1;
      if (row.rating != null) ratingsByBucket.nearby.push(row.rating);
    } else {
      completedRegionalCount += 1;
      if (row.rating != null) ratingsByBucket.regional.push(row.rating);
    }
  }

  const recentStretchRepCount = distancesAll
    .slice(0, 5)
    .filter(
      (value): value is number =>
        value != null && value >= STRETCH_REP_FLOOR_MILES,
    ).length;

  let questsSinceStretchRep: number | null = null;
  for (let i = 0; i < distancesAll.length; i += 1) {
    const dist = distancesAll[i];
    if (dist != null && dist >= STRETCH_REP_FLOOR_MILES) {
      questsSinceStretchRep = i;
      break;
    }
  }

  const hasEverTraveledNearby = distances.some(
    (d) => d >= LOCAL_CEILING_MILES,
  );
  const hasEverTraveledRegional = distances.some(
    (d) => d >= NEARBY_CEILING_MILES,
  );

  const willingnessSignal: WillingnessSignal =
    totalCompletedQuests < 5
      ? "untested"
      : hasEverTraveledRegional
        ? "regional_capable"
        : hasEverTraveledNearby
          ? "nearby_capable"
          : "local_only";

  const lines = [
    "\nOBSERVED WILLINGNESS:",
    `- Total completed quests: ${totalCompletedQuests}.`,
    `- Max observed travel: ${maxObservedTravelMiles.toFixed(1)} mi (recent 5: ${recentMaxTravelMiles.toFixed(1)} mi).`,
    `- Recent bucket mix (last 8 completed): local=${completedLocalCount}, nearby=${completedNearbyCount}, regional=${completedRegionalCount}.`,
    `- Recent stretch reps (last 5, >=${STRETCH_REP_FLOOR_MILES}mi): ${recentStretchRepCount}; quests since last stretch: ${questsSinceStretchRep ?? "never"}.`,
    `- Willingness signal: ${willingnessSignal}.`,
  ];

  if (willingnessSignal === "local_only" && totalCompletedQuests >= 5) {
    lines.push(
      `- Note: user has 5+ completed quests but has never traveled past ${LOCAL_CEILING_MILES}mi. If local rooms are exhausted for this goal, a small nudge into a nearby zone is warranted — propose it explicitly and frame the travel as part of the rep.`,
    );
  }
  if (
    willingnessSignal === "nearby_capable" ||
    willingnessSignal === "regional_capable"
  ) {
    lines.push(
      `- Travel posture: user has voluntarily completed reps outside their home base. Stretch geography is a fair lever to pull when the goal warrants it.`,
    );
  }

  return {
    totalCompletedQuests,
    maxObservedTravelMiles,
    recentMaxTravelMiles,
    recentMedianTravelMiles,
    completedLocalCount,
    completedNearbyCount,
    completedRegionalCount,
    avgRatingByBucket: {
      local: ratingsByBucket.local.length ? avg(ratingsByBucket.local) : null,
      nearby: ratingsByBucket.nearby.length
        ? avg(ratingsByBucket.nearby)
        : null,
      regional: ratingsByBucket.regional.length
        ? avg(ratingsByBucket.regional)
        : null,
    },
    recentStretchRepCount,
    questsSinceStretchRep,
    willingnessSignal,
    hasEverTraveledNearby,
    hasEverTraveledRegional,
    promptBlock: `${lines.join("\n")}\n`,
  };
}

function coerceDistance(row: WillingnessRow): number | null {
  if (row.distance_from_home == null) return null;
  const value =
    typeof row.distance_from_home === "string"
      ? Number(row.distance_from_home)
      : row.distance_from_home;
  return Number.isFinite(value) ? value : null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
