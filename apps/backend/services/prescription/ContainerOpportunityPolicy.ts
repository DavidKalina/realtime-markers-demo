import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
import type { ContainerType } from "./OfflineSocialFramework";
import {
  classifyJourneyCategoryFamily,
  isSafeRepeatableFamily,
  type JourneyCategoryFamily,
} from "./JourneyDiversityContext";
import type { StrategyBrief } from "./PrescriptionStrategy";
import { normalizeVenueCategory } from "./ScoutCandidateGrounding";

export interface ContainerOpportunityDecision {
  applied: boolean;
  logLine?: string;
}

type ContainerBlueprint = {
  categories: string[];
  queries: (city: string) => string[];
  experienceLabel: string;
};

const BASE_RECOVERY_CATEGORIES = new Set([
  "Bakery / Dessert Shop",
  "Bookstore",
  "Brunch Spot",
  "Coffee Shop",
  "Library",
  "Restaurant",
  "Specialty Shop",
  "Trail / Park",
]);

const STRUCTURED_CATEGORIES = new Set([
  "Art Studio / Workshop",
  "Board Game Venue",
  "Climbing Gym",
  "College / Adult Education",
  "Community Center",
  "Coworking Space",
  "Gym / Fitness Studio",
  "Karaoke Venue",
  "Maker Space",
  "Music Venue / Concert Hall",
  "Recreation Center",
  "Sports Club",
  "Theatre / Performing Arts",
  "Workshop / Class Venue",
  "Yoga / Pilates Studio",
]);

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

const COFFEE_GRAVITY_CATEGORIES = new Set([
  "Coffee Shop",
  "Bookstore",
  "Brunch Spot",
  "Restaurant",
]);

const CONTAINER_BLUEPRINTS: Record<ContainerType, ContainerBlueprint> = {
  casual_third_place: {
    categories: ["Coffee Shop", "Bookstore", "Brewery / Taproom"],
    queries: (city) => [
      `local cafe ${city}`,
      `bookstore cafe ${city}`,
      `quiet taproom ${city}`,
    ],
    experienceLabel: "repeatable third place with light social energy",
  },
  structured_class: {
    categories: [
      "Workshop / Class Venue",
      "College / Adult Education",
      "Community Center",
    ],
    queries: (city) => [
      `beginner class ${city}`,
      `adult education ${city}`,
      `community class ${city}`,
    ],
    experienceLabel: "beginner-friendly class with a clear structure",
  },
  recurring_club: {
    categories: ["Board Game Venue", "Community Center", "Library"],
    queries: (city) => [
      `book club ${city}`,
      `board game night ${city}`,
      `meetup group ${city}`,
    ],
    experienceLabel: "recurring room with repeated faces",
  },
  movement_group: {
    categories: [
      "Gym / Fitness Studio",
      "Yoga / Pilates Studio",
      "Climbing Gym",
      "Sports Club",
    ],
    queries: (city) => [
      `group fitness ${city}`,
      `climbing gym ${city}`,
      `dance class ${city}`,
      `run club ${city}`,
    ],
    experienceLabel:
      "movement-based group where being around people is built in",
  },
  group_fitness_class: {
    categories: [
      "Gym / Fitness Studio",
      "Yoga / Pilates Studio",
      "Recreation Center",
    ],
    queries: (city) => [
      `group fitness class ${city}`,
      `yoga class ${city}`,
      `pilates class ${city}`,
    ],
    experienceLabel: "drop-in fitness class with a beginner on-ramp",
  },
  run_walk_club: {
    categories: ["Sports Club", "Recreation Center", "Trail / Park"],
    queries: (city) => [
      `run club ${city}`,
      `walking group ${city}`,
      `social run ${city}`,
    ],
    experienceLabel: "group walk or run with easy conversation windows",
  },
  rec_league_or_open_play: {
    categories: ["Sports Club", "Recreation Center", "Gym / Fitness Studio"],
    queries: (city) => [
      `pickleball open play ${city}`,
      `adult sports league ${city}`,
      `open gym ${city}`,
    ],
    experienceLabel: "adult rec play with repeated faces and easy structure",
  },
  creative_workshop: {
    categories: [
      "Art Studio / Workshop",
      "Maker Space",
      "Workshop / Class Venue",
    ],
    queries: (city) => [
      `art workshop ${city}`,
      `pottery class ${city}`,
      `maker space ${city}`,
    ],
    experienceLabel: "hands-on creative room with a built-in activity",
  },
  makers_night: {
    categories: ["Maker Space", "Art Studio / Workshop", "Library"],
    queries: (city) => [
      `maker night ${city}`,
      `open studio ${city}`,
      `craft night ${city}`,
    ],
    experienceLabel: "open maker room with a social reason to linger",
  },
  volunteering: {
    categories: ["Community Center", "Library", "Other"],
    queries: (city) => [
      `volunteer event ${city}`,
      `community volunteer ${city}`,
      `volunteer shift ${city}`,
    ],
    experienceLabel: "service-oriented room where the social script is obvious",
  },
  singles_event: {
    categories: [
      "Board Game Venue",
      "Brewery / Taproom",
      "Bar",
      "Community Center",
    ],
    queries: (city) => [
      `singles meetup ${city}`,
      `speed dating ${city}`,
      `social mixer ${city}`,
    ],
    experienceLabel: "explicit dating container with gentle entry points",
  },
  partner_dance_social: {
    categories: [
      "Workshop / Class Venue",
      "Theatre / Performing Arts",
      "Community Center",
    ],
    queries: (city) => [
      `salsa class ${city}`,
      `partner dance social ${city}`,
      `swing dance ${city}`,
    ],
    experienceLabel: "dance-based social room with built-in interaction",
  },
  board_game_social: {
    categories: ["Board Game Venue", "Brewery / Taproom", "Library"],
    queries: (city) => [
      `board game night ${city}`,
      `tabletop meetup ${city}`,
      `game cafe ${city}`,
    ],
    experienceLabel: "game night where conversation happens naturally",
  },
  performance_event: {
    categories: [
      "Theatre / Performing Arts",
      "Music Venue / Concert Hall",
      "Brewery / Taproom",
    ],
    queries: (city) => [
      `open mic ${city}`,
      `live music ${city}`,
      `comedy night ${city}`,
    ],
    experienceLabel: "performance-driven room with mingling around the edges",
  },
  community_event: {
    categories: [
      "Community Center",
      "Library",
      "Food Market / Farmers Market",
      "Recreation Center",
    ],
    queries: (city) => [
      `community event ${city}`,
      `farmers market ${city}`,
      `library event ${city}`,
    ],
    experienceLabel: "community gathering with low-pressure participation",
  },
  food_social: {
    categories: ["Restaurant", "Brunch Spot", "Brewery / Taproom"],
    queries: (city) => [
      `trivia night ${city}`,
      `social brunch ${city}`,
      `food hall ${city}`,
    ],
    experienceLabel: "food-and-drink room that makes lingering easy",
  },
  coworking_social: {
    categories: ["Coworking Space", "Coffee Shop", "Library"],
    queries: (city) => [
      `coworking day pass ${city}`,
      `remote work cafe ${city}`,
      `study meetup ${city}`,
    ],
    experienceLabel: "third place with familiar faces and ambient contact",
  },
  library_program: {
    categories: ["Library", "Community Center", "Bookstore"],
    queries: (city) => [
      `library program ${city}`,
      `author event ${city}`,
      `community reading ${city}`,
    ],
    experienceLabel: "quiet structured program with an obvious topic",
  },
  quiet_public_place: {
    categories: ["Library", "Bookstore", "Museum", "Coffee Shop"],
    queries: (city) => [
      `quiet cafe ${city}`,
      `library ${city}`,
      `museum ${city}`,
    ],
    experienceLabel: "calm public room for low-pressure visibility",
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

function hasRecentCoffeeGravity(ctx: PrescriptionPromptContext): boolean {
  const mix = ctx.journeyDiversity;
  if (!mix) return false;
  if (mix.dominantRecentCategory === "Coffee Shop") return true;
  if (
    mix.consecutiveSameCategoryCount >= 2 &&
    COFFEE_GRAVITY_CATEGORIES.has(mix.recentCategories[0] ?? "")
  ) {
    return true;
  }
  return (
    mix.recentCategories
      .slice(0, 4)
      .filter((category) => category === "Coffee Shop").length >= 2
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
  const blueprint = CONTAINER_BLUEPRINTS[family];
  if (!blueprint) return false;
  return blueprint.categories.some(
    (category) => classifyJourneyCategoryFamily(category) === dominantFamily,
  );
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

function isBaseHeavyBrief(brief: StrategyBrief): boolean {
  if (brief.suggestedCategories.length === 0) return true;
  return brief.suggestedCategories.every((category) =>
    BASE_RECOVERY_CATEGORIES.has(normalizeVenueCategory(category)),
  );
}

function alreadyStructured(brief: StrategyBrief): boolean {
  return brief.suggestedCategories.some((category) =>
    STRUCTURED_CATEGORIES.has(normalizeVenueCategory(category)),
  );
}

function shouldOverrideStructuredBrief(
  brief: StrategyBrief,
  ctx: PrescriptionPromptContext,
): boolean {
  if (!alreadyStructured(brief)) return false;
  const mix = ctx.journeyDiversity;
  if (!mix) return false;
  const category = normalizeVenueCategory(brief.suggestedCategories[0]);
  return (
    mix.consecutiveSameCategoryCount >= 2 &&
    category.length > 0 &&
    category === mix.recentCategories[0]
  );
}

function familyPriority(
  family: ContainerType,
  ctx: PrescriptionPromptContext,
): number {
  const tags = new Set(ctx.goalTags);
  let score = 0;
  const cooldown = shouldDiversifyAfterDirectGoalTouch(ctx);
  const coffeeGravity = hasRecentCoffeeGravity(ctx);
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
  const framework = ctx.offlineSocialFrameworkPlan;
  const diversifyAfterGoalTouch = shouldDiversifyAfterDirectGoalTouch(ctx);
  const coffeeGravity = hasRecentCoffeeGravity(ctx);
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
  const categories = unique(
    topFamilies.flatMap((family) => CONTAINER_BLUEPRINTS[family].categories),
  ).slice(0, 4);
  const searchQueries = unique(
    topFamilies.flatMap((family) => CONTAINER_BLUEPRINTS[family].queries(city)),
  ).slice(0, 5);
  const experienceLabel = CONTAINER_BLUEPRINTS[topFamilies[0]].experienceLabel;

  const previousCategories = brief.suggestedCategories.join(", ") || "none";
  brief.suggestedCategories = categories;
  brief.searchQueries = searchQueries;
  brief.experienceType = experienceLabel;
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
      `[multi-agent] Container opportunity policy: categories ${previousCategories}→${categories.join(", ")} (${topFamilies.join(", ")})` +
      `${diversifyAfterGoalTouch ? " [milestone cooldown]" : structuredFloor ? " [structured floor]" : coffeeGravity ? " [coffee gravity]" : safeFamily ? ` [safe-family:${safeFamily}]` : ""}`,
  };
}
