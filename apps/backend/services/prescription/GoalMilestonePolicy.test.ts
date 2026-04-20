import { describe, expect, test } from "bun:test";
import { CapacityTrack } from "../../entities/Sidequest";
import { applyGoalMilestonePolicy } from "./GoalMilestonePolicy";
import type { StrategyBrief } from "./PrescriptionStrategy";

function brief(overrides: Partial<StrategyBrief> = {}): StrategyBrief {
  return {
    capacityTrack: CapacityTrack.PUBLIC_PRESENCE,
    repIntent: "Be visible.",
    experienceType: "coffee",
    suggestedCategories: ["Coffee Shop"],
    targetCity: "Frederick",
    maxDistanceMiles: 4,
    difficultyRange: [1, 3],
    socialChallengeLevel: "none",
    searchQueries: ["coffee Frederick"],
    avoidVenues: [],
    avoidCategories: [],
    suggestedTiming: "weekday morning",
    rationale: "Build comfort.",
    ...overrides,
  };
}

describe("applyGoalMilestonePolicy", () => {
  test("does nothing when goal closure is not due", () => {
    const b = brief();
    const decision = applyGoalMilestonePolicy({
      brief: b,
      ctx: { activeGoalMilestone: { goalClosureDue: false } } as any,
    });
    expect(decision.applied).toBe(false);
    expect(b.capacityTrack).toBe(CapacityTrack.PUBLIC_PRESENCE);
  });

  test("nudges goal closure toward a direct social-extension rep", () => {
    const b = brief();
    const decision = applyGoalMilestonePolicy({
      brief: b,
      ctx: {
        activeGoalMilestone: { goalClosureDue: true },
        lastRejection: null,
      } as any,
    });
    expect(decision.applied).toBe(true);
    expect(b.capacityTrack).toBe(CapacityTrack.SOCIAL_EXTENSION);
    expect(b.socialChallengeLevel).toBe("low");
    expect(b.difficultyRange).toEqual([3, 4]);
    expect(b.rationale).toContain("goal-closure milestone");
  });

  test("does not raise difficulty when responding to a fresh rejection", () => {
    const b = brief({ difficultyRange: [1, 2] });
    applyGoalMilestonePolicy({
      brief: b,
      ctx: {
        activeGoalMilestone: { goalClosureDue: true },
        lastRejection: { reason: "NEED_GENTLER" },
      } as any,
    });
    expect(b.difficultyRange).toEqual([1, 2]);
  });
});
