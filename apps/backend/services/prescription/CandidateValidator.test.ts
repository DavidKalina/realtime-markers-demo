import { describe, expect, test } from "bun:test";
import { CapacityTrack } from "../../entities/Sidequest";
import { validateCandidates } from "./CandidateValidator";
import type { ScoutCandidate, StrategyBrief } from "./PrescriptionStrategy";

function brief(overrides: Partial<StrategyBrief> = {}): StrategyBrief {
  return {
    capacityTrack: CapacityTrack.PUBLIC_PRESENCE,
    repIntent: "Be visible somewhere low pressure.",
    experienceType: "coffee",
    suggestedCategories: ["Coffee Shop"],
    targetCity: "Frederick",
    maxDistanceMiles: 4,
    difficultyRange: [1, 3],
    socialChallengeLevel: "low",
    searchQueries: ["coffee Frederick"],
    avoidVenues: [],
    avoidCategories: [],
    suggestedTiming: "weekday morning",
    rationale: "Stay near home.",
    ...overrides,
  };
}

function ctx(overrides: Record<string, unknown> = {}) {
  return {
    homeLat: 40,
    homeLng: -105,
    historyContext: "",
    lastRejection: null,
    rejectionPattern: null,
    ...overrides,
  } as any;
}

function candidate(overrides: Partial<ScoutCandidate> = {}): ScoutCandidate {
  return {
    venueName: "Local Cafe",
    venueAddress: "1 Main St",
    venueCategory: "Coffee Shop",
    latitude: 40.01,
    longitude: -105.01,
    source: "search_places",
    ...overrides,
  };
}

describe("validateCandidates", () => {
  test("accepts a valid nearby candidate", () => {
    const result = validateCandidates({
      candidates: [candidate()],
      ctx: ctx(),
      brief: brief(),
    });
    expect(result.accepted).toBe(true);
    expect(result.winner?.venueName).toBe("Local Cafe");
  });

  test("rejects distance with structured too_far code", () => {
    const result = validateCandidates({
      candidates: [
        candidate({ venueName: "Far Cafe", latitude: 40.5, longitude: -105.5 }),
      ],
      ctx: ctx(),
      brief: brief({ maxDistanceMiles: 2 }),
    });
    expect(result.accepted).toBe(false);
    expect(result.rejectionCodes).toContain("too_far");
    expect(result.retryConstraints).toContain("2.0 miles");
  });

  test("rejects a just-rejected venue with recently_rejected code", () => {
    const result = validateCandidates({
      candidates: [candidate()],
      ctx: ctx({ lastRejection: { venueName: "Local Cafe" } }),
      brief: brief(),
    });
    expect(result.accepted).toBe(false);
    expect(result.rejectionCodes).toContain("recently_rejected");
  });

  test("rejects bad recurring category without parsing human text", () => {
    const result = validateCandidates({
      candidates: [candidate({ venueName: "Busy Bar", venueCategory: "Bar" })],
      ctx: ctx({
        rejectionPattern: { reason: "TOO_PUBLIC", count: 3, categories: [] },
      }),
      brief: brief(),
    });
    expect(result.accepted).toBe(false);
    expect(result.rejectionCodes).toContain("bad_category");
  });

  test("rejects another coffee-family venue when recent mix is already coffee-heavy", () => {
    const result = validateCandidates({
      candidates: [candidate()],
      ctx: ctx({
        completedQuestCount: 12,
        questRole: "deepen",
        journeyPhase: {
          phase: "post_breakthrough_consolidation",
          requireMilestoneQuest: false,
          requireStructuredNonEnjoy: true,
          forbidParkForNonEnjoy: true,
          fallbackLane: "gentler_same_intent",
        },
        journeyDiversity: {
          recentCategories: [
            "Coffee Shop",
            "Coffee Shop",
            "Restaurant",
            "Community Center",
          ],
          recentFamilies: [
            "coffee_family",
            "coffee_family",
            "food_social",
            "community_room",
          ],
          recentVenueNames: ["A", "B", "C", "D"],
          recentRoles: ["milestone", "deepen", "deepen", "explore"],
          recentMilestoneCount: 1,
          recentDirectGoalTouchCount: 1,
          recentStructuredCount: 1,
          recentBaseRecoveryCount: 3,
          questsSinceDirectGoalTouch: 1,
          questsSinceMilestone: 1,
          consecutiveSameCategoryCount: 2,
          consecutiveSameFamilyCount: 2,
          consecutiveSameVenueCount: 1,
          dominantRecentCategory: "Coffee Shop",
          dominantRecentFamily: "coffee_family",
          postGoalClosureWindow: true,
          shouldCooldownMilestone: true,
          shouldForceStructuredNext: false,
        },
      }),
      brief: brief(),
    });
    expect(result.accepted).toBe(false);
    expect(result.rejectionCodes).toContain("bad_category");
  });

  test("rejects another park-family venue when the recent journey is park-dominated", () => {
    const result = validateCandidates({
      candidates: [
        candidate({
          venueName: "Firefighters' Park",
          venueCategory: "Trail / Park",
        }),
      ],
      ctx: ctx({
        completedQuestCount: 18,
        questRole: "deepen",
        journeyPhase: {
          phase: "late_world_building",
          requireMilestoneQuest: false,
          requireStructuredNonEnjoy: false,
          forbidParkForNonEnjoy: true,
          fallbackLane: "gentler_same_intent",
        },
        activeGoalMilestone: { goalClosureDue: false },
        journeyDiversity: {
          recentCategories: [
            "Trail / Park",
            "Trail / Park",
            "Trail / Park",
            "Community Center",
          ],
          recentFamilies: [
            "park_outdoor",
            "park_outdoor",
            "park_outdoor",
            "community_room",
          ],
          recentVenueNames: ["A", "B", "C", "D"],
          recentRoles: ["deepen", "explore", "enjoy", "explore"],
          recentMilestoneCount: 0,
          recentDirectGoalTouchCount: 0,
          recentStructuredCount: 1,
          recentBaseRecoveryCount: 3,
          questsSinceDirectGoalTouch: 5,
          questsSinceMilestone: 7,
          consecutiveSameCategoryCount: 3,
          consecutiveSameFamilyCount: 3,
          consecutiveSameVenueCount: 1,
          dominantRecentCategory: "Trail / Park",
          dominantRecentFamily: "park_outdoor",
          postGoalClosureWindow: true,
          shouldCooldownMilestone: false,
          shouldForceStructuredNext: false,
        },
      }),
      brief: brief({
        suggestedCategories: ["Trail / Park"],
        searchQueries: ["park Frederick"],
        experienceType: "park reset",
      }),
    });
    expect(result.accepted).toBe(false);
    expect(result.rejectionCodes).toContain("bad_category");
  });

  test("rejects non-structured fallback when structured floor is due", () => {
    const result = validateCandidates({
      candidates: [
        candidate({
          venueName: "Firefighters' Park",
          venueCategory: "Trail / Park",
        }),
      ],
      ctx: ctx({
        completedQuestCount: 20,
        questRole: "deepen",
        journeyPhase: {
          phase: "late_world_building",
          requireMilestoneQuest: false,
          requireStructuredNonEnjoy: true,
          forbidParkForNonEnjoy: true,
          fallbackLane: "gentler_same_intent",
        },
        activeGoalMilestone: { goalClosureDue: false },
        journeyDiversity: {
          recentCategories: [
            "Trail / Park",
            "Trail / Park",
            "Trail / Park",
            "Trail / Park",
          ],
          recentFamilies: [
            "park_outdoor",
            "park_outdoor",
            "park_outdoor",
            "park_outdoor",
          ],
          recentVenueNames: ["A", "B", "C", "D"],
          recentRoles: ["deepen", "explore", "enjoy", "deepen"],
          recentMilestoneCount: 0,
          recentDirectGoalTouchCount: 0,
          recentStructuredCount: 0,
          recentBaseRecoveryCount: 4,
          questsSinceDirectGoalTouch: 7,
          questsSinceMilestone: 8,
          consecutiveSameCategoryCount: 4,
          consecutiveSameFamilyCount: 4,
          consecutiveSameVenueCount: 1,
          dominantRecentCategory: "Trail / Park",
          dominantRecentFamily: "park_outdoor",
          postGoalClosureWindow: true,
          shouldCooldownMilestone: false,
          shouldForceStructuredNext: true,
        },
      }),
      brief: brief({
        suggestedCategories: ["Trail / Park"],
        searchQueries: ["park Frederick"],
        experienceType: "park reset",
      }),
    });
    expect(result.accepted).toBe(false);
    expect(result.rejectionCodes).toContain("bad_category");
    expect(result.humanReasons.join(" ")).toContain("structured-enough");
  });

  test("rejects park-family candidates outright in late world building", () => {
    const result = validateCandidates({
      candidates: [
        candidate({
          venueName: "Crist Park",
          venueCategory: "Trail / Park",
        }),
      ],
      ctx: ctx({
        completedQuestCount: 16,
        questRole: "stretch",
        journeyPhase: {
          phase: "late_world_building",
          requireMilestoneQuest: false,
          requireStructuredNonEnjoy: false,
          forbidParkForNonEnjoy: true,
          fallbackLane: "gentler_same_intent",
        },
      }),
      brief: brief({
        suggestedCategories: ["Trail / Park"],
        searchQueries: ["park Frederick"],
        experienceType: "easy park reset",
      }),
    });

    expect(result.accepted).toBe(false);
    expect(result.rejectionCodes).toContain("bad_category");
    expect(result.humanReasons.join(" ")).toContain("park/outdoor reset");
  });

  test("rejects another civic safe-room candidate when late journey is already dominated by it", () => {
    const result = validateCandidates({
      candidates: [
        candidate({
          venueName: "Another Library",
          venueCategory: "Library",
        }),
      ],
      ctx: ctx({
        completedQuestCount: 19,
        questRole: "stretch",
        journeyPhase: {
          phase: "late_world_building",
          requireMilestoneQuest: false,
          requireStructuredNonEnjoy: false,
          forbidParkForNonEnjoy: true,
          fallbackLane: "gentler_same_intent",
        },
        lastRejection: null,
        journeyDiversity: {
          recentCategories: [
            "Library",
            "Library",
            "Community Center",
            "Library",
          ],
          recentFamilies: [
            "library_quiet",
            "library_quiet",
            "community_room",
            "library_quiet",
          ],
          recentVenueNames: ["A", "B", "C", "D"],
          recentRoles: ["stretch", "explore", "stretch", "deepen"],
          recentMilestoneCount: 0,
          recentDirectGoalTouchCount: 0,
          recentStructuredCount: 3,
          recentBaseRecoveryCount: 3,
          questsSinceDirectGoalTouch: 6,
          questsSinceMilestone: 8,
          consecutiveSameCategoryCount: 2,
          consecutiveSameFamilyCount: 2,
          consecutiveSameVenueCount: 1,
          dominantRecentCategory: "Library",
          dominantRecentFamily: "library_quiet",
          postGoalClosureWindow: false,
          shouldCooldownMilestone: false,
          shouldForceStructuredNext: false,
        },
      }),
      brief: brief({
        suggestedCategories: ["Library"],
        searchQueries: ["library Longmont"],
        experienceType: "quiet public room",
      }),
    });

    expect(result.accepted).toBe(false);
    expect(result.rejectionCodes).toContain("bad_category");
    expect(result.humanReasons.join(" ")).toContain("safe-room lane");
  });
});
