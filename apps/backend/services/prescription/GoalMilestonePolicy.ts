import { CapacityTrack } from "../../entities/Sidequest";
import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
import type { StrategyBrief } from "./PrescriptionStrategy";

export interface GoalMilestonePolicyDecision {
  applied: boolean;
  logLine?: string;
}

export function applyGoalMilestonePolicy(input: {
  brief: StrategyBrief;
  ctx: PrescriptionPromptContext;
}): GoalMilestonePolicyDecision {
  const { brief, ctx } = input;
  if (!ctx.activeGoalMilestone?.goalClosureDue) {
    return { applied: false };
  }

  const before = {
    capacityTrack: brief.capacityTrack,
    social: brief.socialChallengeLevel,
    diffMin: brief.difficultyRange[0],
    diffMax: brief.difficultyRange[1],
  };

  if (
    brief.capacityTrack !== CapacityTrack.SOCIAL_EXTENSION &&
    brief.capacityTrack !== CapacityTrack.MICRO_INTERACTION
  ) {
    brief.capacityTrack = CapacityTrack.SOCIAL_EXTENSION;
    brief.repIntent = "Make one gentle dating move tied to a real place.";
  }

  if (brief.socialChallengeLevel === "none") {
    brief.socialChallengeLevel = "low";
  }

  if (!ctx.lastRejection) {
    brief.difficultyRange = [
      Math.max(3, Math.min(brief.difficultyRange[0], 4)),
      Math.max(4, Math.min(6, brief.difficultyRange[1])),
    ];
  }

  if (!brief.rationale.toLowerCase().includes("milestone")) {
    brief.rationale =
      `${brief.rationale} This is a goal-closure milestone, so the quest must include one direct low-pressure dating action.`.trim();
  }

  return {
    applied: true,
    logLine:
      `[multi-agent] Goal milestone policy: capacity ${before.capacityTrack}→${brief.capacityTrack}, ` +
      `social ${before.social}→${brief.socialChallengeLevel}, ` +
      `difficulty ${before.diffMin}-${before.diffMax}→${brief.difficultyRange[0]}-${brief.difficultyRange[1]}`,
  };
}
