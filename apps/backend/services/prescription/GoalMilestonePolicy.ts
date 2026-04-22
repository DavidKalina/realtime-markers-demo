import { CapacityTrack } from "../../entities/Sidequest";
import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
import type { StrategyBrief } from "./PrescriptionStrategy";

export interface GoalMilestonePolicyDecision {
  applied: boolean;
  logLine?: string;
}

const GENTLE_DATING_SUPPORT_CATEGORIES = [
  "Restaurant",
  "Brunch Spot",
  "Board Game Venue",
  "Workshop / Class Venue",
];

const SOCIAL_DATING_CONTAINER_CATEGORIES = [
  "Board Game Venue",
  "Workshop / Class Venue",
  "Gym / Fitness Studio",
  "Sports Club",
];

function buildMilestoneQueries(city: string, gentleMode: boolean): string[] {
  if (gentleMode) {
    return [
      `quiet lunch spot ${city}`,
      `low-key brunch ${city}`,
      `board game night ${city}`,
      `beginner social class ${city}`,
    ];
  }
  return [
    `beginner dance class ${city}`,
    `board game night ${city}`,
    `group fitness class ${city}`,
    `singles meetup ${city}`,
    `social mixer ${city}`,
    `partner dance social ${city}`,
  ];
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
    categories: brief.suggestedCategories.join(", "),
  };
  const city = brief.targetCity || input.ctx.homeCity || input.ctx.city;
  const gentleMode =
    input.ctx.lastRejection?.reason === "TOO_PUBLIC" ||
    input.ctx.lastRejection?.reason === "NEED_GENTLER" ||
    input.ctx.lastRejection?.reason === "TOO_SOCIAL";

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

  brief.suggestedCategories = gentleMode
    ? GENTLE_DATING_SUPPORT_CATEGORIES
    : SOCIAL_DATING_CONTAINER_CATEGORIES;
  brief.searchQueries = buildMilestoneQueries(city, gentleMode);
  brief.experienceType = gentleMode
    ? "dateable local place that supports one direct invite"
    : "social container that supports one direct dating move";

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
      `difficulty ${before.diffMin}-${before.diffMax}→${brief.difficultyRange[0]}-${brief.difficultyRange[1]}, ` +
      `categories ${before.categories || "none"}→${brief.suggestedCategories.join(", ")}`,
  };
}
