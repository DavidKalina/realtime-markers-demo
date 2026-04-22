import { describe, expect, test } from "bun:test";
import { CapacityTrack } from "../../entities/Sidequest";
import { applyContainerOpportunityPolicy } from "./ContainerOpportunityPolicy";
import type { StrategyBrief } from "./PrescriptionStrategy";

function brief(overrides: Partial<StrategyBrief> = {}): StrategyBrief {
  return {
    capacityTrack: CapacityTrack.PUBLIC_PRESENCE,
    repIntent: "Be visible in public.",
    experienceType: "quiet cafe visit",
    suggestedCategories: ["Coffee Shop", "Trail / Park"],
    targetCity: "Frederick",
    maxDistanceMiles: 6,
    difficultyRange: [2, 4],
    socialChallengeLevel: "low",
    searchQueries: ["coffee Frederick", "park Frederick"],
    avoidVenues: [],
    avoidCategories: [],
    suggestedTiming: "weekday afternoon",
    rationale: "A simple out-of-the-house rep.",
    ...overrides,
  };
}

function ctx(overrides: Record<string, unknown> = {}) {
  return {
    isEnjoy: false,
    completedQuestCount: 12,
    goalTags: ["dating"],
    city: "Frederick",
    homeCity: "Frederick",
    lastRejection: null,
    activeGoalMilestone: { goalClosureDue: false },
    offlineSocialFrameworkPlan: {
      phase: "container_dfs",
      primaryLens: "dating_readiness",
      containers: [
        "partner_dance_social",
        "board_game_social",
        "group_fitness_class",
        "structured_class",
      ],
      searchSeeds: [],
    },
    ...overrides,
  } as any;
}

describe("applyContainerOpportunityPolicy", () => {
  test("upgrades base-heavy dating briefs into richer container families", () => {
    const b = brief();
    const decision = applyContainerOpportunityPolicy({
      brief: b,
      ctx: ctx(),
    });
    expect(decision.applied).toBe(true);
    expect(b.suggestedCategories).toContain("Workshop / Class Venue");
    expect(b.searchQueries).toContain("salsa class Frederick");
    expect(b.rationale).toContain("structured");
  });

  test("backs off when the brief is already structured", () => {
    const b = brief({
      suggestedCategories: ["Workshop / Class Venue", "Community Center"],
    });
    const decision = applyContainerOpportunityPolicy({
      brief: b,
      ctx: ctx(),
    });
    expect(decision.applied).toBe(false);
  });

  test("does not override a gentle post-rejection milestone brief", () => {
    const b = brief();
    const decision = applyContainerOpportunityPolicy({
      brief: b,
      ctx: ctx({
        activeGoalMilestone: { goalClosureDue: true },
        lastRejection: { reason: "TOO_PUBLIC" },
      }),
    });
    expect(decision.applied).toBe(false);
  });

  test("broadens after a fresh direct-goal touch instead of repeating coffee", () => {
    const b = brief({
      suggestedCategories: ["Coffee Shop"],
      searchQueries: ["coffee Frederick"],
    });
    const decision = applyContainerOpportunityPolicy({
      brief: b,
      ctx: ctx({
        journeyPhase: {
          phase: "post_breakthrough_consolidation",
          requireMilestoneQuest: false,
          requireStructuredNonEnjoy: true,
          forbidParkForNonEnjoy: true,
          fallbackLane: "gentler_same_intent",
        },
        journeyDiversity: {
          recentCategories: ["Coffee Shop", "Coffee Shop", "Community Center"],
          recentFamilies: [
            "coffee_family",
            "coffee_family",
            "community_room",
          ],
          recentVenueNames: ["Ziggi's", "ECR", "Erie Community Center"],
          recentRoles: ["milestone", "milestone", "deepen"],
          recentMilestoneCount: 2,
          recentDirectGoalTouchCount: 1,
          recentStructuredCount: 1,
          recentBaseRecoveryCount: 2,
          questsSinceDirectGoalTouch: 0,
          questsSinceMilestone: 0,
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
    });

    expect(decision.applied).toBe(true);
    expect(b.suggestedCategories).not.toContain("Coffee Shop");
    expect(b.repIntent).toContain("new room");
    expect(b.rationale).toContain("broaden the room mix");
  });

  test("routes away from an overused park family in the late journey", () => {
    const b = brief({
      suggestedCategories: ["Trail / Park"],
      searchQueries: ["park Frederick"],
      experienceType: "easy park reset",
    });
    const decision = applyContainerOpportunityPolicy({
      brief: b,
      ctx: ctx({
        journeyPhase: {
          phase: "late_world_building",
          requireMilestoneQuest: false,
          requireStructuredNonEnjoy: false,
          forbidParkForNonEnjoy: true,
          fallbackLane: "gentler_same_intent",
        },
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
          recentVenueNames: [
            "Firefighters' Park",
            "Crist Park",
            "Rec Area",
            "Erie Community Center",
          ],
          recentRoles: ["deepen", "explore", "enjoy", "explore"],
          recentMilestoneCount: 0,
          recentDirectGoalTouchCount: 0,
          recentStructuredCount: 1,
          recentBaseRecoveryCount: 3,
          questsSinceDirectGoalTouch: 4,
          questsSinceMilestone: 6,
          consecutiveSameCategoryCount: 3,
          consecutiveSameFamilyCount: 3,
          consecutiveSameVenueCount: 1,
          dominantRecentCategory: "Trail / Park",
          dominantRecentFamily: "park_outdoor",
          postGoalClosureWindow: false,
          shouldCooldownMilestone: false,
          shouldForceStructuredNext: false,
        },
      }),
    });

    expect(decision.applied).toBe(true);
    expect(b.suggestedCategories).not.toContain("Trail / Park");
    expect(b.rationale).toContain("park_outdoor");
  });

  test("forces a structured room when late journey is stuck in maintenance mode", () => {
    const b = brief({
      suggestedCategories: ["Trail / Park"],
      searchQueries: ["park Frederick"],
      experienceType: "easy park reset",
    });
    const decision = applyContainerOpportunityPolicy({
      brief: b,
      ctx: ctx({
        journeyPhase: {
          phase: "late_world_building",
          requireMilestoneQuest: false,
          requireStructuredNonEnjoy: true,
          forbidParkForNonEnjoy: true,
          fallbackLane: "gentler_same_intent",
        },
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
          questsSinceDirectGoalTouch: 6,
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
    });

    expect(decision.applied).toBe(true);
    expect(b.suggestedCategories).not.toContain("Trail / Park");
    expect(b.repIntent).toContain("structured room");
    expect(b.rationale).toContain("structured floor");
  });
});
