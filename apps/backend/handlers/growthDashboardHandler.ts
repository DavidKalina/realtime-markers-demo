/**
 * Growth Dashboard API — surfaces internal growth/insight data
 * that was previously only used by the prescription service.
 *
 * Single endpoint: GET /api/users/me/growth-dashboard
 */

import type { DataSource } from "typeorm";
import { User } from "../entities";
import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";
import type { CoverageService } from "../services/CoverageService";
import type { RedisService } from "../services/shared/RedisService";
import type { OverpassService } from "../services/shared/OverpassService";
import type { GoogleGeocodingService } from "../services/shared/GoogleGeocodingService";
import { analyzeOpportunityZones } from "../services/prescription/OpportunityZonePolicy";
import { computeReachRecommendation } from "../services/prescription/ReachRecommendation";
import { resolveGoalTags } from "../services/shared/QuestConfig";

// ── Response types ─────────────────────────────────────────────

interface GrowthScoreResponse {
  score: number;
  momentum: "rising" | "steady" | "cooling";
  delta7d: number;
  history: { score: number; date: string }[];
  subScores: {
    resonance: number;
    consistency: number;
    expansion: number;
    depth: number;
  };
}

interface GrowthArcResponse {
  phase: number;
  phaseReason: string;
  completedQuests: number;
  avgRating: number;
  avgResonance: number;
  recentResonance: number;
  hasGrowthSignals: boolean;
}

interface SelfInsightResponse {
  avgAnxietyDelta: number;
  avgDifficultyDelta: number;
  totalViolations: number;
  calibrationType:
    | "strong_overestimator"
    | "mild_overestimator"
    | "well_calibrated"
    | "underestimator";
  questsWithPredictions: number;
}

interface PathwayMomentumItem {
  theme: string;
  themeLabel: string;
  phase: "bfs" | "dfs";
  avgResonance: number;
  questCount: number;
  currentDifficulty: number;
  difficultyTrend: number;
  trendHistory: { resonance: number; difficulty: number }[];
}

interface BlindSpotItem {
  pattern: string;
  occurrences: number;
  reframe: string;
  activelyManaged: boolean;
}

interface ExplorationCompassResponse {
  gaps: { direction: string; angleDeg: number; gapWidthDeg: number }[];
  explorationProfile:
    | "early_explorer"
    | "depth_focused"
    | "breadth_focused"
    | "well_rounded";
  coveragePct: number;
  territorySqMiles: number;
  clusterCount: number;
}

interface GrowthDashboardResponse {
  growthScore: GrowthScoreResponse;
  growthArc: GrowthArcResponse;
  selfInsight: SelfInsightResponse | null;
  pathwayMomentum: PathwayMomentumItem[];
  blindSpots: BlindSpotItem[];
  explorationCompass: ExplorationCompassResponse | null;
  reachRecommendation: {
    shouldAsk: boolean;
    recommendedMode: "local_only" | "nearby_mix" | "best_opportunities";
    reason: string;
    localSaturationSignals: string[];
    betterNearbyExists: boolean;
  } | null;
}

// ── Helpers ────────────────────────────────────────────────────

function classifyCalibrationType(
  avgAnxietyDelta: number,
): SelfInsightResponse["calibrationType"] {
  if (avgAnxietyDelta > 1.5) return "strong_overestimator";
  if (avgAnxietyDelta > 0.5) return "mild_overestimator";
  if (avgAnxietyDelta < -0.5) return "underestimator";
  return "well_calibrated";
}

// ── Handler ────────────────────────────────────────────────────

export const getGrowthDashboard: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const dataSource = c.get("dataSource") as DataSource;
  const redisService = c.get("redisService") as RedisService;
  const coverageService = c.get("coverageService") as CoverageService;
  const overpassService = c.get("overpassService") as OverpassService;
  const geocodingService = c.get("geocodingService") as GoogleGeocodingService;

  // Cache for 5 minutes
  const cacheKey = `growth-dashboard:${user.id}`;
  const cached = await redisService.get<GrowthDashboardResponse>(cacheKey);
  if (cached) return c.json(cached);

  // ── Parallel data fetching ─────────────────────────────────

  const [
    questRows,
    userRecord,
    coverageSummary,
    coverageProfile,
    weeklyScores,
    blockerRows,
  ] = await Promise.all([
    // 1. Completed quests with objective data (for growth arc + score)
    dataSource.query<
      {
        rating: number | null;
        difficulty: number | null;
        reflection_sentiment: number | null;
        reflection_tags: string[] | null;
        completed_at: string;
        distance_from_home: number | null;
        venue_category: string | null;
        predicted_anxiety: number | null;
        predicted_difficulty: number | null;
      }[]
    >(
      `
      SELECT
        s.rating,
        o.difficulty,
        o.reflection_sentiment,
        o.reflection_tags,
        s.completed_at,
        s.distance_from_home,
        o.venue_category,
        o.predicted_anxiety,
        o.predicted_difficulty
      FROM sidequests s
      JOIN objectives o ON o.sidequest_id = s.id AND o.sort_order = 0
      WHERE s.user_id = $1
        AND s.completed_at IS NOT NULL
        AND s.deleted_at IS NULL
      ORDER BY s.completed_at DESC
    `,
      [user.id],
    ),

    // 2. User record (for expectancy calibration)
    dataSource.getRepository(User).findOne({
      where: { id: user.id },
      select: [
        "id",
        "expectancyCalibration",
        "comfortRadiusMiles",
        "reachMode",
        "homeLatitude",
        "homeLongitude",
        "comfortProfile",
      ],
    }),

    // 3. Coverage summary (for exploration compass)
    coverageService.getCoverageSummary(user.id).catch(() => null),

    // 4. Coverage profile (for exploration label)
    coverageService.buildLLMCoverageContext(user.id).catch(() => null),

    // 5. Weekly score snapshots (for sparkline history)
    dataSource.query<
      { week: string; quest_count: number; avg_rating: number }[]
    >(
      `
      SELECT
        DATE_TRUNC('week', s.completed_at) AS week,
        COUNT(*)::int AS quest_count,
        ROUND(AVG(s.rating)::numeric, 2)::float AS avg_rating
      FROM sidequests s
      WHERE s.user_id = $1
        AND s.completed_at IS NOT NULL
        AND s.deleted_at IS NULL
      GROUP BY DATE_TRUNC('week', s.completed_at)
      ORDER BY week ASC
    `,
      [user.id],
    ),

    // 6. Blocker detection data (action items vs completed)
    dataSource.query<
      {
        quest_title: string;
        action_items: string[] | null;
        suggested_activities: string[] | null;
        completed_activity: string | null;
        journal_entry: string | null;
        rating: number | null;
        rating_comment: string | null;
        difficulty: number | null;
        venue_category: string | null;
      }[]
    >(
      `
      SELECT
        s.title AS quest_title,
        o.action_items,
        o.suggested_activities,
        o.completed_activity,
        o.journal_entry,
        s.rating,
        s.rating_comment,
        o.difficulty,
        o.venue_category
      FROM objectives o
      JOIN sidequests s ON s.id = o.sidequest_id
      WHERE s.user_id = $1
        AND s.completed_at IS NOT NULL
        AND s.deleted_at IS NULL
      ORDER BY s.completed_at DESC
      LIMIT 15
    `,
      [user.id],
    ),
  ]);

  // ── Compute Growth Arc ─────────────────────────────────────

  const completedQuests = questRows.length;
  const ratings = questRows
    .filter((r) => r.rating != null)
    .map((r) => r.rating!);
  const avgRating =
    ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

  const growthTags = new Set([
    "growth_narrative",
    "discomfort_processed",
    "social_connection",
    "self_awareness",
  ]);
  const hasGrowthSignals = questRows.some((r) =>
    r.reflection_tags?.some((tag) => growthTags.has(tag)),
  );

  // Get resonance from pathways
  const allPathways = await dataSource.query<
    {
      resonance_scores:
        | { sidequestId: string; score: number; reflectionTags?: string[] }[]
        | null;
      phase: string;
    }[]
  >(`SELECT resonance_scores, phase FROM pathways WHERE user_id = $1`, [
    user.id,
  ]);
  const allResonanceScores = allPathways.flatMap((p) =>
    (p.resonance_scores ?? []).map((r) => r.score),
  );
  const avgResonance =
    allResonanceScores.length > 0
      ? allResonanceScores.reduce((a, b) => a + b, 0) /
        allResonanceScores.length
      : 0;
  const recentScores = allResonanceScores.slice(0, 5);
  const recentResonance =
    recentScores.length > 0
      ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
      : 0;

  const hasDfsPathway = allPathways.some((p) => p.phase === "dfs");

  // Phase determination (mirrors SidequestPrescriptionService.computeFearLadderReadiness)
  let phase = 0;
  let phaseReason = "Early days — building the habit of going out";

  if (completedQuests >= 3 && (avgRating >= 3 || avgResonance >= 0.4)) {
    phase = 1;
    phaseReason = `Completing quests and responding well (${completedQuests} quests, avg ${avgRating.toFixed(1)} stars)`;
  }
  if (phase >= 1) {
    if (hasGrowthSignals) {
      phase = 2;
      phaseReason =
        "Showing growth signals in reflections — ready for real challenges";
    } else if (completedQuests >= 5 && avgRating >= 3.5) {
      phase = 2;
      phaseReason = `Consistently positive (avg ${avgRating.toFixed(1)} across ${completedQuests} quests)`;
    } else if (completedQuests >= 8 && avgRating >= 2.5) {
      phase = 2;
      phaseReason = `Persistent — ${completedQuests} quests completed. Consistency is growth`;
    }
  }
  if (phase >= 2) {
    if (hasDfsPathway) {
      phase = 3;
      phaseReason = "Found a deep passion pathway ��� fully open to growth";
    } else if (recentResonance >= 0.55 && avgRating >= 3.5) {
      phase = 3;
      phaseReason = `Thriving (${avgRating.toFixed(1)} stars, ${Math.round(recentResonance * 100)}% resonance)`;
    } else if (completedQuests >= 15 && avgRating >= 3) {
      phase = 3;
      phaseReason = `Long-term commitment — ${completedQuests} quests at ${avgRating.toFixed(1)} stars`;
    }
  }

  // Expectancy accelerator
  const cal = userRecord?.expectancyCalibration;
  if (
    cal &&
    cal.totalViolations >= 3 &&
    cal.avgAnxietyDelta > 1.5 &&
    phase < 3
  ) {
    phase = Math.min(3, phase + 1);
    phaseReason = `Strong fear overestimator — predictions consistently overshoot reality. Accelerating`;
  }

  // Safety valve
  const recentRatings = ratings.slice(0, 5);
  const recentAvgRating =
    recentRatings.length > 0
      ? recentRatings.reduce((a, b) => a + b, 0) / recentRatings.length
      : avgRating;
  if (recentAvgRating < 2.5 && phase > 0) {
    phase = Math.max(0, phase - 1);
    phaseReason = `Recent quests aren't landing well (avg ${recentAvgRating.toFixed(1)}) — pulling back`;
  }

  const growthArc: GrowthArcResponse = {
    phase,
    phaseReason,
    completedQuests,
    avgRating: Math.round(avgRating * 10) / 10,
    avgResonance: Math.round(avgResonance * 100) / 100,
    recentResonance: Math.round(recentResonance * 100) / 100,
    hasGrowthSignals,
  };

  // ── Compute Growth Score ───────────────────────────────────

  // Resonance sub-score (0-100): avg resonance scaled
  const resonanceScore = Math.round(Math.min(avgResonance * 1.2, 1) * 100);

  // Consistency sub-score: based on quest cadence over last 8 weeks
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  const recentWeeks = weeklyScores.filter(
    (w) => new Date(w.week) >= eightWeeksAgo,
  );
  const consistencyScore = Math.round(
    Math.min(recentWeeks.length / 8, 1) * 100,
  );

  // Expansion sub-score: based on comfort radius growth + coverage
  const comfortRadius = Number(userRecord?.comfortRadiusMiles ?? 0.5);
  const radiusGrowth = Math.min((comfortRadius - 0.5) / 5, 1); // 0.5mi to 5.5mi = full score
  const coveragePctNorm = coverageSummary
    ? Math.min(coverageSummary.stats.coveragePct / 60, 1)
    : 0;
  const expansionScore = Math.round(
    (radiusGrowth * 0.6 + coveragePctNorm * 0.4) * 100,
  );

  // Depth sub-score: DFS pathways + resonance consistency
  const dfsCount = allPathways.filter((p) => p.phase === "dfs").length;
  const dfsNorm = Math.min(dfsCount / 3, 1);
  const resonanceConsistency =
    allResonanceScores.length >= 3
      ? 1 -
        Math.sqrt(
          allResonanceScores.reduce(
            (sum, s) => sum + Math.pow(s - avgResonance, 2),
            0,
          ) / allResonanceScores.length,
        )
      : 0;
  const depthScore = Math.round(
    (dfsNorm * 0.5 + Math.min(resonanceConsistency * 1.5, 1) * 0.5) * 100,
  );

  // Composite
  const compositeScore = Math.round(
    resonanceScore * 0.3 +
      consistencyScore * 0.25 +
      expansionScore * 0.2 +
      depthScore * 0.25,
  );

  // Momentum: compare last 2 weeks to 2 weeks before that
  const sortedWeeks = [...weeklyScores].sort(
    (a, b) => new Date(b.week).getTime() - new Date(a.week).getTime(),
  );
  const recent2 = sortedWeeks.slice(0, 2);
  const prev2 = sortedWeeks.slice(2, 4);
  const recentAvg =
    recent2.length > 0
      ? recent2.reduce((s, w) => s + w.avg_rating, 0) / recent2.length
      : 0;
  const prevAvg =
    prev2.length > 0
      ? prev2.reduce((s, w) => s + w.avg_rating, 0) / prev2.length
      : 0;
  const momentum: GrowthScoreResponse["momentum"] =
    recentAvg > prevAvg + 0.3
      ? "rising"
      : recentAvg < prevAvg - 0.3
        ? "cooling"
        : "steady";

  // Weekly composite history for sparkline
  const history: GrowthScoreResponse["history"] = weeklyScores.map((w) => {
    // Approximate: use avg_rating * 20 as proxy, bounded by quest count
    const weekScore = Math.round(
      Math.min(w.avg_rating * 20, 100) * Math.min(w.quest_count / 3, 1),
    );
    return {
      score: Math.max(weekScore, 5),
      date: new Date(w.week).toISOString().slice(0, 10),
    };
  });

  // Delta: compare latest score to score from 7 days ago
  const delta7d =
    history.length >= 2
      ? history[history.length - 1].score - history[history.length - 2].score
      : 0;

  const growthScore: GrowthScoreResponse = {
    score: compositeScore,
    momentum,
    delta7d,
    history,
    subScores: {
      resonance: resonanceScore,
      consistency: consistencyScore,
      expansion: expansionScore,
      depth: depthScore,
    },
  };

  // ── Self Insight (expectancy calibration) ──────────────────

  let selfInsight: SelfInsightResponse | null = null;
  if (cal && cal.totalViolations >= 3) {
    selfInsight = {
      avgAnxietyDelta: Math.round(cal.avgAnxietyDelta * 10) / 10,
      avgDifficultyDelta: Math.round(cal.avgDifficultyDelta * 10) / 10,
      totalViolations: cal.totalViolations,
      calibrationType: classifyCalibrationType(cal.avgAnxietyDelta),
      questsWithPredictions: cal.totalViolations,
    };
  }

  // ── Pathway Momentum ────────────────────────────────────���─

  // Get raw pathway entities with resonance_scores for sparklines
  const rawPathways = await dataSource.query<
    {
      theme: string;
      theme_label: string;
      phase: string;
      avg_resonance: number;
      quest_count: number;
      current_difficulty: number;
      difficulty_trend: number;
      resonance_scores: { sidequestId: string; score: number }[] | null;
      sidequest_ids: string[] | null;
    }[]
  >(
    `SELECT theme, theme_label, phase, avg_resonance, quest_count,
            current_difficulty, difficulty_trend, resonance_scores, sidequest_ids
     FROM pathways WHERE user_id = $1 ORDER BY avg_resonance DESC`,
    [user.id],
  );

  // Get difficulty per sidequest for trend history
  const sidequestIds = rawPathways.flatMap((p) => p.sidequest_ids ?? []);
  let difficultyMap: Record<string, number> = {};
  if (sidequestIds.length > 0) {
    const diffRows = await dataSource.query<
      { sidequest_id: string; difficulty: number }[]
    >(
      `SELECT sidequest_id, difficulty FROM objectives
       WHERE sidequest_id = ANY($1) AND sort_order = 0 AND difficulty IS NOT NULL`,
      [sidequestIds],
    );
    difficultyMap = Object.fromEntries(
      diffRows.map((r) => [r.sidequest_id, Number(r.difficulty)]),
    );
  }

  const pathwayMomentum: PathwayMomentumItem[] = rawPathways.map((p) => {
    const resScores = p.resonance_scores ?? [];
    const trendHistory = resScores.map((rs) => ({
      resonance: rs.score,
      difficulty: difficultyMap[rs.sidequestId] ?? 0,
    }));

    return {
      theme: p.theme,
      themeLabel: p.theme_label,
      phase: p.phase as "bfs" | "dfs",
      avgResonance: Math.round(Number(p.avg_resonance) * 100) / 100,
      questCount: Number(p.quest_count),
      currentDifficulty: Math.round(Number(p.current_difficulty) * 10) / 10,
      difficultyTrend: Math.round(Number(p.difficulty_trend) * 100) / 100,
      trendHistory,
    };
  });

  // ── Blind Spots (lightweight — no LLM call) ───────────────
  // Detect patterns from action items prescribed vs completed

  const blindSpots: BlindSpotItem[] = [];

  if (blockerRows.length >= 5) {
    // Count action items that were prescribed but never appear in completed_activity
    const prescribedActions: Record<string, number> = {};
    const completedActions = new Set<string>();

    for (const row of blockerRows) {
      if (row.completed_activity) {
        completedActions.add(row.completed_activity.toLowerCase());
      }
      for (const ai of row.action_items ?? []) {
        const key = ai
          .toLowerCase()
          .replace(/[^a-z ]/g, "")
          .trim();
        if (key.length > 5) {
          prescribedActions[key] = (prescribedActions[key] ?? 0) + 1;
        }
      }
      for (const sa of row.suggested_activities ?? []) {
        const key = sa
          .toLowerCase()
          .replace(/[^a-z ]/g, "")
          .trim();
        if (key.length > 5) {
          prescribedActions[key] = (prescribedActions[key] ?? 0) + 1;
        }
      }
    }

    // Find actions prescribed 3+ times but never completed
    const avoidedPatterns = Object.entries(prescribedActions)
      .filter(([action, count]) => {
        if (count < 3) return false;
        return !Array.from(completedActions).some((c) =>
          c.includes(action.slice(0, 15)),
        );
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);

    for (const [pattern, occurrences] of avoidedPatterns) {
      // Trim the emoji prefix and capitalize
      const clean = pattern.replace(/^[^\w]+/, "").trim();
      const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
      blindSpots.push({
        pattern: capitalized,
        occurrences,
        reframe: `This keeps appearing in quests but hasn't been tried yet. We're building comfort around it gradually.`,
        activelyManaged: occurrences >= 4,
      });
    }
  }

  // ── Exploration Compass ────────────────────────────────────

  let explorationCompass: ExplorationCompassResponse | null = null;
  if (coverageSummary) {
    explorationCompass = {
      gaps: coverageSummary.directionalGaps.map((g) => ({
        direction: g.direction,
        angleDeg: g.angleDeg,
        gapWidthDeg: g.gapWidthDeg,
      })),
      explorationProfile: (coverageProfile?.profile.label ??
        "early_explorer") as ExplorationCompassResponse["explorationProfile"],
      coveragePct: Math.round(coverageSummary.stats.coveragePct),
      territorySqMiles:
        Math.round(coverageSummary.stats.territorySqMiles * 10) / 10,
      clusterCount: coverageSummary.stats.clusterCount,
    };
  }

  let reachRecommendation: GrowthDashboardResponse["reachRecommendation"] =
    null;
  if (userRecord?.homeLatitude != null && userRecord?.homeLongitude != null) {
    try {
      const homeCity = await geocodingService.reverseGeocodeCityState(
        Number(userRecord.homeLatitude),
        Number(userRecord.homeLongitude),
      );
      const nearbyCities = await overpassService.fetchNearbyCities(
        Number(userRecord.homeLatitude),
        Number(userRecord.homeLongitude),
        100000,
        12,
      );
      const opportunityZones = analyzeOpportunityZones({
        homeCity,
        nearbyCities,
        goalTags: resolveGoalTags(userRecord.comfortProfile),
        completedQuestCount: completedQuests,
        isEarlyCalibration: completedQuests < 5,
        journeyPhase:
          growthArc.phase >= 4
            ? "late_world_building"
            : growthArc.phase >= 3
              ? "post_breakthrough_consolidation"
              : growthArc.phase >= 2
                ? "goal_closure_due"
                : "calibration",
      });
      reachRecommendation =
        computeReachRecommendation({
          reachMode: userRecord.reachMode ?? null,
          completedQuestCount: completedQuests,
          comfortRadiusMiles: Number(userRecord.comfortRadiusMiles ?? 3),
          recentQuestRows: questRows,
          opportunityZones,
        }) ?? null;
    } catch (err) {
      console.error("[growthDashboard] Reach recommendation failed:", err);
    }
  }

  // ── Assemble response ──────────────────────────────────────

  const response: GrowthDashboardResponse = {
    growthScore,
    growthArc,
    selfInsight,
    pathwayMomentum,
    blindSpots,
    explorationCompass,
    reachRecommendation,
  };

  await redisService.set(cacheKey, response, 300);
  return c.json(response);
});
