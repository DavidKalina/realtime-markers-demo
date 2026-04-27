import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
import type { ContainerType } from "./OfflineSocialFramework";
import {
  isSafeRepeatableFamily,
  type JourneyCategoryFamily,
} from "./JourneyDiversityContext";
import type { StrategyBrief } from "./PrescriptionStrategy";
import type { VenueQualityProfile } from "./VenueQualities";

export interface ContainerOpportunityDecision {
  applied: boolean;
  logLine?: string;
}

type ContainerBlueprint = {
  experienceLabel: string;
  /**
   * Quality profile for this container. Tells the strategist + validator what
   * kind of room this represents in qualitative language. The Strategist LLM
   * picks specific venue categories from these qualities; application code
   * stays out of the category business.
   */
  qualities: VenueQualityProfile;
};

const COMMON_AVOID: VenueQualityProfile["avoid"] = [
  "scene-y-exclusive",
  "high-friction-pricing",
];

const SOCIAL_GOAL_TAGS = new Set([
  "dating",
  "socialize",
  "friendship",
  "community",
  "third_place",
  "new_skill",
  "discover_hobby",
  "fitness",
]);

const CONTAINER_BLUEPRINTS: Record<ContainerType, ContainerBlueprint> = {
  casual_third_place: {
    experienceLabel: "repeatable third place with light social energy",
    qualities: {
      must: ["drop-in-friendly", "single-friendly"],
      prefer: ["ambient-presence", "low-social-pressure", "bustling-neutral", "indoor-public"],
      avoid: [...COMMON_AVOID, "intimate-hushed", "couples-coded"],
    },
  },
  structured_class: {
    experienceLabel: "beginner-friendly class with a clear structure",
    qualities: {
      must: ["structured-activity", "time-bounded", "single-friendly"],
      prefer: ["parallel-play", "conversation-friendly", "regulars-heavy", "indoor-public"],
      avoid: [...COMMON_AVOID, "high-social-pressure"],
    },
  },
  recurring_club: {
    experienceLabel: "recurring room with repeated faces",
    qualities: {
      must: ["regulars-heavy", "single-friendly"],
      prefer: ["structured-activity", "conversation-friendly", "parallel-play", "time-bounded"],
      avoid: [...COMMON_AVOID, "tourist-heavy"],
    },
  },
  movement_group: {
    experienceLabel: "movement-based group where being around people is built in",
    qualities: {
      must: ["parallel-play", "single-friendly"],
      prefer: ["structured-activity", "time-bounded", "regulars-heavy", "drop-in-friendly"],
      avoid: [...COMMON_AVOID, "requires-membership"],
    },
  },
  group_fitness_class: {
    experienceLabel: "drop-in fitness class with a beginner on-ramp",
    qualities: {
      must: ["structured-activity", "time-bounded", "parallel-play", "single-friendly"],
      prefer: ["drop-in-friendly", "low-cost-drop-in", "indoor-public"],
      avoid: [...COMMON_AVOID, "requires-membership"],
    },
  },
  run_walk_club: {
    experienceLabel: "group walk or run with easy conversation windows",
    qualities: {
      must: ["outdoor-public", "parallel-play", "single-friendly"],
      prefer: ["structured-activity", "time-bounded", "regulars-heavy", "free", "conversation-friendly"],
      avoid: [...COMMON_AVOID],
    },
  },
  rec_league_or_open_play: {
    experienceLabel: "adult rec play with repeated faces and easy structure",
    qualities: {
      must: ["parallel-play", "structured-activity", "single-friendly"],
      prefer: ["regulars-heavy", "drop-in-friendly", "low-cost-drop-in", "indoor-public"],
      avoid: [...COMMON_AVOID, "requires-membership"],
    },
  },
  creative_workshop: {
    experienceLabel: "hands-on creative room with a built-in activity",
    qualities: {
      must: ["structured-activity", "parallel-play", "single-friendly"],
      prefer: ["time-bounded", "requires-signup", "conversation-friendly", "regulars-heavy", "indoor-public"],
      avoid: [...COMMON_AVOID],
    },
  },
  makers_night: {
    experienceLabel: "open maker room with a social reason to linger",
    qualities: {
      must: ["parallel-play", "single-friendly", "low-social-pressure"],
      prefer: ["regulars-heavy", "ambient-presence", "drop-in-friendly", "indoor-public"],
      avoid: [...COMMON_AVOID],
    },
  },
  volunteering: {
    experienceLabel: "service-oriented room where the social script is obvious",
    qualities: {
      must: ["structured-activity", "single-friendly", "free"],
      prefer: ["time-bounded", "low-social-pressure", "parallel-play", "regulars-heavy"],
      avoid: [...COMMON_AVOID],
    },
  },
  singles_event: {
    experienceLabel: "explicit dating container with gentle entry points",
    qualities: {
      must: ["people-rich", "conversation-friendly", "single-friendly"],
      prefer: ["time-bounded", "requires-signup", "structured-activity", "indoor-public"],
      avoid: ["scene-y-exclusive", "couples-coded", "high-friction-pricing", "intimate-hushed"],
    },
  },
  partner_dance_social: {
    experienceLabel: "dance-based social room with built-in interaction",
    qualities: {
      must: ["structured-activity", "parallel-play", "single-friendly", "conversation-friendly"],
      prefer: ["time-bounded", "regulars-heavy", "indoor-public"],
      avoid: [...COMMON_AVOID, "intimate-hushed"],
    },
  },
  board_game_social: {
    experienceLabel: "game night where conversation happens naturally",
    qualities: {
      must: ["parallel-play", "conversation-friendly", "single-friendly"],
      prefer: ["regulars-heavy", "structured-activity", "indoor-public", "low-cost-drop-in"],
      avoid: [...COMMON_AVOID, "loud-lively"],
    },
  },
  performance_event: {
    experienceLabel: "performance-driven room with mingling around the edges",
    qualities: {
      must: ["ambient-presence", "time-bounded", "single-friendly"],
      prefer: ["people-rich", "conversation-friendly", "low-social-pressure", "indoor-public"],
      avoid: ["scene-y-exclusive", "high-friction-pricing", "intimate-hushed"],
    },
  },
  community_event: {
    experienceLabel: "community gathering with low-pressure participation",
    qualities: {
      must: ["ambient-presence", "single-friendly", "low-social-pressure"],
      prefer: ["people-rich", "free", "time-bounded", "drop-in-friendly", "outdoor-public"],
      avoid: [...COMMON_AVOID],
    },
  },
  food_social: {
    experienceLabel: "food-and-drink room that makes lingering easy",
    qualities: {
      must: ["bustling-neutral", "single-friendly"],
      prefer: ["conversation-friendly", "people-rich", "drop-in-friendly", "indoor-public"],
      avoid: [...COMMON_AVOID, "intimate-hushed", "couples-coded"],
    },
  },
  coworking_social: {
    experienceLabel: "third place with familiar faces and ambient contact",
    qualities: {
      must: ["ambient-presence", "single-friendly", "low-social-pressure"],
      prefer: ["regulars-heavy", "drop-in-friendly", "quiet-contemplative", "indoor-public"],
      avoid: [...COMMON_AVOID],
    },
  },
  library_program: {
    experienceLabel: "quiet structured program with an obvious topic",
    qualities: {
      must: ["structured-activity", "time-bounded", "single-friendly", "free"],
      prefer: ["low-social-pressure", "ambient-presence", "indoor-public"],
      avoid: [...COMMON_AVOID, "loud-lively"],
    },
  },
  quiet_public_place: {
    experienceLabel: "calm public room for low-pressure visibility",
    qualities: {
      must: ["ambient-presence", "low-social-pressure", "single-friendly", "drop-in-friendly"],
      prefer: ["low-traffic", "quiet-contemplative", "indoor-public"],
      avoid: [...COMMON_AVOID, "loud-lively", "people-rich"],
    },
  },
  outdoor_public_place: {
    experienceLabel: "outdoor third place — being-out-in-the-world counts the same as a structured room",
    qualities: {
      must: ["outdoor-public", "single-friendly", "drop-in-friendly"],
      prefer: ["ambient-presence", "free", "low-social-pressure"],
      avoid: [...COMMON_AVOID],
    },
  },
  active_recreation: {
    experienceLabel: "active recreation room — built-in conversation while doing something",
    qualities: {
      must: ["parallel-play", "single-friendly"],
      prefer: ["conversation-friendly", "drop-in-friendly", "low-cost-drop-in", "regulars-heavy"],
      avoid: [...COMMON_AVOID, "requires-membership"],
    },
  },
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function wantsContainerBreadth(ctx: PrescriptionPromptContext): boolean {
  if (ctx.isEnjoy) return false;
  if ((ctx.completedQuestCount ?? 0) < 5) return false;
  return ctx.goalTags.some((tag) => SOCIAL_GOAL_TAGS.has(tag));
}

// Map each container type to the journey family it tends to land in, so
// diversity logic can reason about overlap without referencing specific
// venue categories. Qualitative — describes the kind of room, not which
// venues. Empty array = container spans multiple families.
const CONTAINER_FAMILY_HINTS: Partial<
  Record<ContainerType, JourneyCategoryFamily[]>
> = {
  casual_third_place: ["coffee_family", "food_social"],
  food_social: ["food_social"],
  coworking_social: ["coffee_family"],
  quiet_public_place: ["library_quiet", "coffee_family"],
  library_program: ["library_quiet", "community_room"],
  community_event: ["community_room"],
  outdoor_public_place: ["park_outdoor"],
  run_walk_club: ["park_outdoor"],
  performance_event: ["nightlife_social"],
  structured_class: ["structured_social", "community_room"],
  recurring_club: ["structured_social", "community_room"],
  movement_group: ["structured_social"],
  group_fitness_class: ["structured_social"],
  rec_league_or_open_play: ["structured_social"],
  creative_workshop: ["structured_social"],
  makers_night: ["structured_social"],
  board_game_social: ["structured_social"],
  singles_event: ["structured_social", "nightlife_social"],
  partner_dance_social: ["structured_social"],
  active_recreation: ["structured_social"],
  volunteering: ["community_room"],
};

function hasRecentLowFrictionGravity(ctx: PrescriptionPromptContext): boolean {
  const mix = ctx.journeyDiversity;
  if (!mix) return false;
  // Coffee/food/retail families are the easy fallback rooms. If they're
  // dominating consecutively, that's the "comfort cluster" gravity we're
  // trying to break out of. Expressed at family granularity, not categories.
  if (mix.dominantRecentFamily === "coffee_family") return true;
  if (
    mix.consecutiveSameFamilyCount >= 2 &&
    mix.recentFamilies[0] === "coffee_family"
  ) {
    return true;
  }
  return (
    mix.recentFamilies
      .slice(0, 4)
      .filter((family) => family === "coffee_family").length >= 2
  );
}

function dominantSafeFamily(
  ctx: PrescriptionPromptContext,
): JourneyCategoryFamily | null {
  const family = ctx.journeyDiversity?.dominantRecentFamily ?? null;
  return isSafeRepeatableFamily(family)
    ? (family as JourneyCategoryFamily)
    : null;
}

function blueprintTouchesFamily(
  family: ContainerType,
  dominantFamily: JourneyCategoryFamily,
): boolean {
  const hints = CONTAINER_FAMILY_HINTS[family];
  if (!hints) return false;
  return hints.includes(dominantFamily);
}

function shouldDiversifyAfterDirectGoalTouch(
  ctx: PrescriptionPromptContext,
): boolean {
  return ctx.journeyDiversity?.shouldCooldownMilestone === true;
}

function shouldForceStructuredFloor(ctx: PrescriptionPromptContext): boolean {
  return (
    ctx.journeyPhase?.requireStructuredNonEnjoy === true ||
    ctx.journeyDiversity?.shouldForceStructuredNext === true
  );
}

// "Brief is base-heavy" = the brief hasn't been narrowed to anything
// structured yet. With categories no longer driving this, we infer it from
// the absence of structured-activity in the brief's qualities.
function isBaseHeavyBrief(brief: StrategyBrief): boolean {
  const must = brief.venueQualities?.must ?? [];
  const prefer = brief.venueQualities?.prefer ?? [];
  return (
    !must.includes("structured-activity") &&
    !prefer.includes("structured-activity")
  );
}

function alreadyStructured(brief: StrategyBrief): boolean {
  const must = brief.venueQualities?.must ?? [];
  return must.includes("structured-activity");
}

function shouldOverrideStructuredBrief(
  brief: StrategyBrief,
  ctx: PrescriptionPromptContext,
): boolean {
  if (!alreadyStructured(brief)) return false;
  const mix = ctx.journeyDiversity;
  if (!mix) return false;
  // If the recent journey is stuck in one family AND the structured brief
  // is still pointing at that same family, override it.
  return (
    mix.consecutiveSameFamilyCount >= 2 &&
    mix.dominantRecentFamily !== null &&
    mix.recentFamilies[0] === mix.dominantRecentFamily
  );
}

function familyPriority(
  family: ContainerType,
  ctx: PrescriptionPromptContext,
): number {
  const tags = new Set(ctx.goalTags);
  let score = 0;
  const cooldown = shouldDiversifyAfterDirectGoalTouch(ctx);
  const coffeeGravity = hasRecentLowFrictionGravity(ctx);
  const safeFamily = dominantSafeFamily(ctx);
  const structuredFloor = shouldForceStructuredFloor(ctx);
  if (ctx.activeGoalMilestone?.goalClosureDue) {
    if (
      [
        "singles_event",
        "partner_dance_social",
        "board_game_social",
        "food_social",
        "movement_group",
        "group_fitness_class",
      ].includes(family)
    ) {
      score += 80;
    }
  }
  if (cooldown) {
    if (
      [
        "partner_dance_social",
        "group_fitness_class",
        "rec_league_or_open_play",
        "structured_class",
        "movement_group",
        "community_event",
        "library_program",
      ].includes(family)
    ) {
      score += 70;
    }
    if (
      ["casual_third_place", "food_social", "coworking_social"].includes(family)
    ) {
      score -= 45;
    }
  }
  if (coffeeGravity) {
    if (
      [
        "partner_dance_social",
        "group_fitness_class",
        "rec_league_or_open_play",
        "structured_class",
        "movement_group",
        "creative_workshop",
        "community_event",
        "library_program",
        "makers_night",
      ].includes(family)
    ) {
      score += 45;
    }
    if (
      ["casual_third_place", "food_social", "coworking_social"].includes(family)
    ) {
      score -= 35;
    }
  }
  if (structuredFloor) {
    if (
      [
        "structured_class",
        "recurring_club",
        "movement_group",
        "group_fitness_class",
        "rec_league_or_open_play",
        "creative_workshop",
        "makers_night",
        "board_game_social",
        "partner_dance_social",
        "community_event",
        "library_program",
        "singles_event",
      ].includes(family)
    ) {
      score += 95;
    }
    if (
      [
        "casual_third_place",
        "quiet_public_place",
        "food_social",
        "coworking_social",
        "run_walk_club",
      ].includes(family)
    ) {
      score -= 80;
    }
  }
  if (safeFamily) {
    if (blueprintTouchesFamily(family, safeFamily)) {
      score -= 55;
    } else if (
      [
        "partner_dance_social",
        "group_fitness_class",
        "rec_league_or_open_play",
        "structured_class",
        "movement_group",
        "creative_workshop",
        "board_game_social",
        "singles_event",
        "performance_event",
        "makers_night",
      ].includes(family)
    ) {
      score += 35;
    }
  }
  if (tags.has("dating")) {
    if (
      [
        "singles_event",
        "partner_dance_social",
        "board_game_social",
        "movement_group",
        "food_social",
        "rec_league_or_open_play",
      ].includes(family)
    ) {
      score += 50;
    }
  }
  if (tags.has("fitness")) {
    if (
      ["group_fitness_class", "movement_group", "run_walk_club"].includes(
        family,
      )
    ) {
      score += 40;
    }
  }
  if (tags.has("new_skill") || tags.has("discover_hobby")) {
    if (
      [
        "structured_class",
        "creative_workshop",
        "makers_night",
        "library_program",
      ].includes(family)
    ) {
      score += 40;
    }
  }
  if (
    ctx.lastRejection?.reason === "TOO_PUBLIC" ||
    ctx.lastRejection?.reason === "NEED_GENTLER"
  ) {
    if (
      ["structured_class", "creative_workshop", "library_program"].includes(
        family,
      )
    ) {
      score += 25;
    }
    if (["singles_event", "performance_event"].includes(family)) {
      score -= 30;
    }
  }
  return score;
}

export function applyContainerOpportunityPolicy(input: {
  brief: StrategyBrief;
  ctx: PrescriptionPromptContext;
}): ContainerOpportunityDecision {
  const { brief, ctx } = input;
  if (brief.questContract?.programId === "dating") {
    return { applied: false };
  }
  const framework = ctx.offlineSocialFrameworkPlan;
  const diversifyAfterGoalTouch = shouldDiversifyAfterDirectGoalTouch(ctx);
  const coffeeGravity = hasRecentLowFrictionGravity(ctx);
  const safeFamily = dominantSafeFamily(ctx);
  const structuredFloor = shouldForceStructuredFloor(ctx);
  if (!framework || framework.phase === "foundation") {
    return { applied: false };
  }
  if (!wantsContainerBreadth(ctx)) {
    return { applied: false };
  }
  if (
    ctx.activeGoalMilestone?.goalClosureDue &&
    ["TOO_PUBLIC", "NEED_GENTLER", "TOO_SOCIAL"].includes(
      ctx.lastRejection?.reason ?? "",
    )
  ) {
    return { applied: false };
  }
  if (
    !isBaseHeavyBrief(brief) &&
    alreadyStructured(brief) &&
    !shouldOverrideStructuredBrief(brief, ctx)
  ) {
    return { applied: false };
  }
  if (
    !isBaseHeavyBrief(brief) &&
    !coffeeGravity &&
    !safeFamily &&
    !structuredFloor &&
    !diversifyAfterGoalTouch
  ) {
    return { applied: false };
  }

  const prioritizedFamilies = [...framework.containers].sort(
    (a, b) => familyPriority(b, ctx) - familyPriority(a, ctx),
  );
  const selectedFamilies = prioritizedFamilies.filter(
    (family) => CONTAINER_BLUEPRINTS[family],
  );
  if (selectedFamilies.length === 0) {
    return { applied: false };
  }

  const city = brief.targetCity || ctx.homeCity || ctx.city;
  const topFamilies = (
    structuredFloor
      ? selectedFamilies.filter((family) =>
          [
            "structured_class",
            "recurring_club",
            "movement_group",
            "group_fitness_class",
            "rec_league_or_open_play",
            "creative_workshop",
            "makers_night",
            "board_game_social",
            "partner_dance_social",
            "community_event",
            "library_program",
            "singles_event",
          ].includes(family),
        )
      : selectedFamilies
  ).slice(0, ctx.activeGoalMilestone?.goalClosureDue ? 4 : 3);
  if (topFamilies.length === 0) {
    return { applied: false };
  }
  const experienceLabel = CONTAINER_BLUEPRINTS[topFamilies[0]].experienceLabel;
  // Merge qualities across the selected families. Picking 3-4 containers
  // gives the strategist a profile that's actually achievable — every
  // candidate still needs the universal must, but the prefer set can union.
  const mergedQualities = topFamilies.reduce<
    import("./VenueQualities").VenueQualityProfile
  >(
    (acc, family) => {
      const q = CONTAINER_BLUEPRINTS[family].qualities;
      return {
        must: [...new Set([...acc.must, ...q.must])],
        prefer: [...new Set([...acc.prefer, ...q.prefer])],
        avoid: [...new Set([...acc.avoid, ...q.avoid])],
      };
    },
    { must: [], prefer: [], avoid: [] },
  );

  const previousCategories = brief.suggestedCategories.join(", ") || "none";
  // No category override — the Strategist's LLM picks categories informed
  // by these qualities. This was the policy fencing the LLM into 4
  // categories per stage; that's gone now.
  brief.experienceType = experienceLabel;
  brief.venueQualities = mergedQualities;
  if (diversifyAfterGoalTouch) {
    brief.repIntent =
      "Keep the social thread alive in a new room instead of repeating the same direct invite.";
  } else if (structuredFloor) {
    brief.repIntent =
      "Build the late journey in a real structured room, not another maintenance reset.";
  }
  if (
    diversifyAfterGoalTouch &&
    !brief.rationale.toLowerCase().includes("broaden")
  ) {
    brief.rationale =
      `${brief.rationale} A direct goal rep just landed, so broaden the room mix before repeating another invite.`.trim();
  } else if (
    coffeeGravity &&
    !brief.rationale.toLowerCase().includes("repeat")
  ) {
    brief.rationale =
      `${brief.rationale} Recent quests have leaned too hard on coffee-shop comfort, so shift into a different social room.`.trim();
  } else if (
    structuredFloor &&
    !brief.rationale.toLowerCase().includes("structured floor")
  ) {
    brief.rationale =
      `${brief.rationale} The late journey is drifting into maintenance mode, so the next non-enjoy quest should happen in a real structured room.`.trim();
  } else if (safeFamily && !brief.rationale.toLowerCase().includes("safe")) {
    brief.rationale =
      `${brief.rationale} Recent quests have overused the ${safeFamily} lane, so rotate into a different room family before the journey gets stale.`.trim();
  } else if (!brief.rationale.toLowerCase().includes("structured")) {
    brief.rationale =
      `${brief.rationale} Shift out of another base outing and into a real social container with clearer structure.`.trim();
  }

  return {
    applied: true,
    logLine:
      `[multi-agent] Container opportunity policy: containers ${topFamilies.join(", ")}, qualities must=${mergedQualities.must.join(",")} avoid=${mergedQualities.avoid.join(",")} (was: ${previousCategories})` +
      `${diversifyAfterGoalTouch ? " [milestone cooldown]" : structuredFloor ? " [structured floor]" : coffeeGravity ? " [coffee gravity]" : safeFamily ? ` [safe-family:${safeFamily}]` : ""}`,
  };
}
