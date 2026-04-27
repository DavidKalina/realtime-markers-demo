import { describe, expect, test } from "bun:test";
import { computeReachRecommendation } from "./ReachRecommendation";
import type { OpportunityZoneAnalysis } from "./OpportunityZonePolicy";

const opportunityZones: OpportunityZoneAnalysis = {
  homeBaseViability: "weak",
  recommendedCity: "Longmont, CO",
  fallbackCity: "Erie, CO",
  zones: [
    {
      city: "Longmont, CO",
      distanceMiles: 9.5,
      population: 98700,
      opportunityScore: 6.3,
      tier: "nearby_growth_zone",
      rationale: ["better odds of classes/clubs"],
      isHomeBase: false,
    },
    {
      city: "Frederick, CO",
      distanceMiles: 0,
      population: 14000,
      opportunityScore: 2.9,
      tier: "home_base",
      rationale: ["sparse social pool"],
      isHomeBase: true,
    },
  ],
  promptBlock: "",
};

describe("computeReachRecommendation", () => {
  test("does not prompt early local users", () => {
    const recommendation = computeReachRecommendation({
      reachMode: null,
      completedQuestCount: 3,
      comfortRadiusMiles: 3,
      recentQuestRows: [],
      opportunityZones,
    });

    expect(recommendation).toBeNull();
  });

  test("prompts when local reps are repetitive and better nearby opportunity exists", () => {
    const recommendation = computeReachRecommendation({
      reachMode: null,
      completedQuestCount: 8,
      comfortRadiusMiles: 3.2,
      recentQuestRows: [
        { venue_category: "Trail / Park", distance_from_home: 1.4, rating: 4 },
        { venue_category: "Trail / Park", distance_from_home: 1.1, rating: 3 },
        { venue_category: "Trail / Park", distance_from_home: 1.5, rating: 4 },
        { venue_category: "Library", distance_from_home: 2.8, rating: 4 },
        { venue_category: "Trail / Park", distance_from_home: 1.7, rating: 3 },
        { venue_category: "Library", distance_from_home: 3, rating: 4 },
      ],
      opportunityZones,
    });

    expect(recommendation?.shouldAsk).toBe(true);
    expect(recommendation?.recommendedMode).toBe("nearby_mix");
    expect(recommendation?.betterNearbyExists).toBe(true);
  });

  test("does not prompt after the user has already chosen a reach mode", () => {
    const recommendation = computeReachRecommendation({
      reachMode: "nearby_mix",
      completedQuestCount: 12,
      comfortRadiusMiles: 4,
      recentQuestRows: [
        { venue_category: "Trail / Park", distance_from_home: 1.1, rating: 4 },
      ],
      opportunityZones,
    });

    expect(recommendation).toBeNull();
  });
});
