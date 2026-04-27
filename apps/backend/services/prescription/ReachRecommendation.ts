import type { OpportunityZoneAnalysis } from "./OpportunityZonePolicy";
import { classifyJourneyCategoryFamily } from "./JourneyDiversityContext";

type ReachMode = "local_only" | "nearby_mix" | "best_opportunities";

export interface ReachRecommendation {
  shouldAsk: boolean;
  recommendedMode: ReachMode;
  reason: string;
  localSaturationSignals: string[];
  betterNearbyExists: boolean;
}

export function computeReachRecommendation(input: {
  reachMode: ReachMode | null | undefined;
  completedQuestCount: number;
  comfortRadiusMiles: number;
  recentQuestRows: Array<{
    venue_category: string | null;
    distance_from_home: number | null;
    rating: number | null;
  }>;
  opportunityZones: OpportunityZoneAnalysis | null;
}): ReachRecommendation | null {
  if (input.reachMode != null) return null;
  if (input.completedQuestCount < 5) return null;
  if (!input.opportunityZones?.recommendedCity) return null;

  const homeZone =
    input.opportunityZones.zones.find((zone) => zone.isHomeBase) ??
    input.opportunityZones.zones[0];
  const recommendedZone = input.opportunityZones.zones.find(
    (zone) => zone.city === input.opportunityZones?.recommendedCity,
  );
  if (!homeZone || !recommendedZone || recommendedZone.isHomeBase) return null;

  const localCeiling = Math.max(input.comfortRadiusMiles + 0.25, 4);
  const recent = input.recentQuestRows.slice(0, 8);
  const localRecent = recent.filter(
    (row) => (row.distance_from_home ?? 0) <= localCeiling,
  );
  const avgRating = recent
    .filter((row) => row.rating != null)
    .reduce((sum, row, _, arr) => {
      return sum + (row.rating ?? 0) / Math.max(arr.length, 1);
    }, 0);
  const familyCounts = new Map<string, number>();
  for (const row of localRecent) {
    const family = classifyJourneyCategoryFamily(row.venue_category);
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
  }

  const dominantFamily = [...familyCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];
  const localSaturationSignals: string[] = [];

  if (localRecent.length >= 5) {
    localSaturationSignals.push("enough local reps to form a real baseline");
  }
  if (dominantFamily && dominantFamily[1] >= 3) {
    localSaturationSignals.push(
      `recent local reps are repeating the same room family (${dominantFamily[0]})`,
    );
  }
  if (avgRating >= 3) {
    localSaturationSignals.push(
      "local reps are stable enough to support a wider map",
    );
  }
  if (input.opportunityZones.homeBaseViability === "weak") {
    localSaturationSignals.push("home base is sparse for this goal");
  }

  const scoreDelta =
    recommendedZone.opportunityScore - homeZone.opportunityScore;
  const betterNearbyExists = scoreDelta >= 1;

  if (
    localRecent.length < 5 ||
    localSaturationSignals.length < 3 ||
    !betterNearbyExists
  ) {
    return {
      shouldAsk: false,
      recommendedMode:
        recommendedZone.distanceMiles > 12
          ? "best_opportunities"
          : "nearby_mix",
      reason: `Local reps are still doing useful work in ${homeZone.city}.`,
      localSaturationSignals,
      betterNearbyExists,
    };
  }

  const recommendedMode: ReachMode =
    recommendedZone.distanceMiles > 12 ||
    recommendedZone.tier === "regional_anchor"
      ? "best_opportunities"
      : "nearby_mix";

  return {
    shouldAsk: true,
    recommendedMode,
    reason: `${recommendedZone.city} looks materially stronger for this goal than staying fully inside ${homeZone.city}.`,
    localSaturationSignals,
    betterNearbyExists,
  };
}
