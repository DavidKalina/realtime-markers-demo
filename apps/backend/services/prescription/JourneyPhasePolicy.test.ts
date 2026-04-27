import { describe, expect, test } from "bun:test";
import { resolveJourneyPhase } from "./JourneyPhasePolicy";

describe("resolveJourneyPhase", () => {
  test("uses calibration for early quests", () => {
    const phase = resolveJourneyPhase({
      completedQuestCount: 2,
      isEarlyCalibration: true,
      goalClosureDue: false,
      directGoalTouched: false,
      postGoalClosureWindow: false,
      shouldCooldownMilestone: false,
      shouldForceStructuredNext: false,
      recentBaseRecoveryCount: 1,
      recentStructuredCount: 0,
      dominantRecentFamily: null,
    });

    expect(phase.phase).toBe("calibration");
    expect(phase.fallbackLane).toBe("recovery_reset");
  });

  test("forces milestone closure when the goal gap is due", () => {
    const phase = resolveJourneyPhase({
      completedQuestCount: 14,
      isEarlyCalibration: false,
      goalClosureDue: true,
      directGoalTouched: false,
      postGoalClosureWindow: false,
      shouldCooldownMilestone: false,
      shouldForceStructuredNext: true,
      recentBaseRecoveryCount: 4,
      recentStructuredCount: 0,
      dominantRecentFamily: "park_outdoor",
    });

    expect(phase.phase).toBe("goal_closure_due");
    expect(phase.requireMilestoneQuest).toBe(true);
    expect(phase.requireStructuredNonEnjoy).toBe(true);
    expect(phase.forbidParkForNonEnjoy).toBe(true);
  });

  test("does not let milestone cooldown suppress a still-due closure quest", () => {
    const phase = resolveJourneyPhase({
      completedQuestCount: 16,
      isEarlyCalibration: false,
      goalClosureDue: true,
      directGoalTouched: true,
      postGoalClosureWindow: true,
      shouldCooldownMilestone: true,
      shouldForceStructuredNext: false,
      recentBaseRecoveryCount: 2,
      recentStructuredCount: 1,
      dominantRecentFamily: "community_room",
    });

    expect(phase.phase).toBe("goal_closure_due");
    expect(phase.requireMilestoneQuest).toBe(true);
  });

  test("locks post-breakthrough quests into structured consolidation", () => {
    const phase = resolveJourneyPhase({
      completedQuestCount: 18,
      isEarlyCalibration: false,
      goalClosureDue: false,
      directGoalTouched: true,
      postGoalClosureWindow: true,
      shouldCooldownMilestone: true,
      shouldForceStructuredNext: false,
      recentBaseRecoveryCount: 2,
      recentStructuredCount: 1,
      dominantRecentFamily: "coffee_family",
    });

    expect(phase.phase).toBe("post_breakthrough_consolidation");
    expect(phase.requireStructuredNonEnjoy).toBe(true);
    expect(phase.forbidParkForNonEnjoy).toBe(true);
    expect(phase.fallbackLane).toBe("gentler_same_intent");
  });

  test("keeps late world building from defaulting to park resets", () => {
    const phase = resolveJourneyPhase({
      completedQuestCount: 20,
      isEarlyCalibration: false,
      goalClosureDue: false,
      directGoalTouched: false,
      postGoalClosureWindow: false,
      shouldCooldownMilestone: false,
      shouldForceStructuredNext: true,
      recentBaseRecoveryCount: 4,
      recentStructuredCount: 0,
      dominantRecentFamily: "park_outdoor",
    });

    expect(phase.phase).toBe("late_world_building");
    expect(phase.requireStructuredNonEnjoy).toBe(true);
    expect(phase.forbidParkForNonEnjoy).toBe(true);
    expect(phase.fallbackLane).toBe("gentler_same_intent");
  });
});
