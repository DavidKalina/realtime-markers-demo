import type { JourneyCategoryFamily } from "./JourneyDiversityContext";

export type JourneyPhase =
  | "calibration"
  | "foundation"
  | "readiness"
  | "goal_closure_due"
  | "post_breakthrough_consolidation"
  | "late_world_building";

export type FallbackLane = "open" | "gentler_same_intent" | "recovery_reset";

export interface JourneyPhaseDecision {
  phase: JourneyPhase;
  requireMilestoneQuest: boolean;
  requireStructuredNonEnjoy: boolean;
  forbidParkForNonEnjoy: boolean;
  fallbackLane: FallbackLane;
  promptBlock: string;
}

export interface JourneyPhaseInput {
  completedQuestCount: number;
  isEarlyCalibration: boolean;
  goalClosureDue: boolean;
  directGoalTouched: boolean;
  postGoalClosureWindow: boolean;
  shouldCooldownMilestone: boolean;
  shouldForceStructuredNext: boolean;
  recentBaseRecoveryCount: number;
  recentStructuredCount: number;
  dominantRecentFamily: JourneyCategoryFamily | null;
}

function resolvePhase(input: JourneyPhaseInput): JourneyPhase {
  if (input.isEarlyCalibration || input.completedQuestCount < 5) {
    return "calibration";
  }
  if (input.goalClosureDue) {
    return "goal_closure_due";
  }
  if (input.postGoalClosureWindow) {
    return "post_breakthrough_consolidation";
  }
  if (input.completedQuestCount >= 12) {
    return "late_world_building";
  }
  if (
    input.completedQuestCount >= 8 ||
    input.goalClosureDue ||
    input.directGoalTouched
  ) {
    return "readiness";
  }
  return "foundation";
}

export function resolveJourneyPhase(
  input: JourneyPhaseInput,
): JourneyPhaseDecision {
  const phase = resolvePhase(input);
  const requireMilestoneQuest = phase === "goal_closure_due";
  const requireStructuredNonEnjoy =
    input.shouldForceStructuredNext ||
    phase === "post_breakthrough_consolidation";
  const forbidParkForNonEnjoy =
    phase === "goal_closure_due" ||
    phase === "post_breakthrough_consolidation" ||
    phase === "late_world_building";

  const fallbackLane: FallbackLane =
    phase === "goal_closure_due" ||
    phase === "post_breakthrough_consolidation" ||
    (phase === "late_world_building" &&
      (input.shouldForceStructuredNext ||
        input.recentBaseRecoveryCount >= 3 ||
        input.dominantRecentFamily === "park_outdoor"))
      ? "gentler_same_intent"
      : phase === "calibration"
        ? "recovery_reset"
        : "open";

  const lines = ["\nJOURNEY PHASE:", `- Phase: ${phase}.`];

  if (requireMilestoneQuest) {
    lines.push(
      "- Hard rule: the next non-enjoy quest must directly advance the named goal. Ambient preparation no longer counts.",
    );
  }
  if (requireStructuredNonEnjoy) {
    lines.push(
      "- Hard rule: the next non-enjoy quest must happen in a real structured room if one is available locally or in a nearby opportunity zone.",
    );
  }
  if (forbidParkForNonEnjoy) {
    lines.push(
      "- Hard rule: trail/park resets do not count as non-enjoy progression in this phase. Parks are only valid as explicit enjoy/recovery slots.",
    );
  }
  if (fallbackLane === "gentler_same_intent") {
    lines.push(
      "- Retry rule: if the first structured/social option is too far or too much, recalibrate to a gentler version of the same growth direction. Do not collapse into the safest generic fallback.",
    );
  }

  return {
    phase,
    requireMilestoneQuest,
    requireStructuredNonEnjoy,
    forbidParkForNonEnjoy,
    fallbackLane,
    promptBlock: `${lines.join("\n")}\n`,
  };
}
