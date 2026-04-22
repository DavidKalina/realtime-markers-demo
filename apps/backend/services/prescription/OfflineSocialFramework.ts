/**
 * Typed product framework for the prescription engine.
 *
 * This keeps the app from becoming a generic goal system. User goals are
 * interpreted as offline-social growth lenses, then mapped to psychological
 * reps, container families, and local implementation search seeds.
 */

export type GoalLens =
  | "dating_readiness"
  | "friendship"
  | "homebody_recovery"
  | "social_anxiety"
  | "offline_hobbies"
  | "third_places"
  | "anti_doomscroll";

export type GrowthRep =
  | "activation"
  | "public_presence"
  | "novelty_tolerance"
  | "staying_power"
  | "returnability"
  | "micro_interaction"
  | "group_participation"
  | "social_extension"
  | "invitation"
  | "identity_evidence"
  | "recovery";

export type ContainerType =
  | "casual_third_place"
  | "structured_class"
  | "recurring_club"
  | "movement_group"
  | "group_fitness_class"
  | "run_walk_club"
  | "rec_league_or_open_play"
  | "creative_workshop"
  | "makers_night"
  | "volunteering"
  | "singles_event"
  | "partner_dance_social"
  | "board_game_social"
  | "performance_event"
  | "community_event"
  | "food_social"
  | "coworking_social"
  | "library_program"
  | "quiet_public_place";

export type FrameworkPhase = "foundation" | "container_bfs" | "container_dfs";

export interface FrameworkStage {
  reps: GrowthRep[];
  containers: ContainerType[];
  searchSeeds: string[];
  instruction: string;
}

export interface GoalLensPlaybook {
  label: string;
  philosophy: string;
  stages: Record<FrameworkPhase, FrameworkStage>;
}

export interface OfflineSocialFrameworkPlan {
  phase: FrameworkPhase;
  primaryLens: GoalLens;
  lenses: GoalLens[];
  reps: GrowthRep[];
  containers: ContainerType[];
  searchSeeds: string[];
  promptBlock: string;
}

const PLAYBOOKS: Record<GoalLens, GoalLensPlaybook> = {
  dating_readiness: {
    label: "Dating Readiness",
    philosophy: "Build an invite-able life and romantic initiative without turning the app into a dating-script product.",
    stages: {
      foundation: {
        reps: ["activation", "public_presence", "returnability"],
        containers: ["casual_third_place", "quiet_public_place"],
        searchSeeds: ["low-key art gallery", "quiet library", "community reading room", "brunch spot"],
        instruction: "Start with calm public rooms that feel date-plausible or invite-able without relying only on cafes.",
      },
      container_bfs: {
        reps: ["group_participation", "micro_interaction", "identity_evidence"],
        containers: ["structured_class", "group_fitness_class", "partner_dance_social", "board_game_social", "movement_group", "creative_workshop", "community_event"],
        searchSeeds: ["beginner dance class", "board game night", "trivia night", "group fitness class", "run club", "art workshop", "volunteer event", "pickleball open play"],
        instruction: "Search broadly for rooms where meeting people is natural: classes, games, movement, volunteering, and recurring events.",
      },
      container_dfs: {
        reps: ["returnability", "social_extension", "invitation", "micro_interaction"],
        containers: ["singles_event", "partner_dance_social", "recurring_club", "rec_league_or_open_play", "food_social", "performance_event", "movement_group"],
        searchSeeds: ["singles meetup", "speed dating", "partner dance social", "recurring board game night", "live music with mingling", "social brunch", "adult sports league"],
        instruction: "Go deeper where resonance appears, then introduce gentle romantic/social initiative and low-stakes invitations.",
      },
    },
  },
  friendship: {
    label: "Friendship / Finding People",
    philosophy: "Create repeated rooms with repeated faces, then move from presence to participation to follow-up.",
    stages: {
      foundation: {
        reps: ["activation", "public_presence", "staying_power"],
        containers: ["casual_third_place", "community_event", "quiet_public_place"],
        searchSeeds: ["farmers market", "busy cafe", "library event", "community event"],
        instruction: "Build trust with public rooms where casual proximity to people feels safe.",
      },
      container_bfs: {
        reps: ["group_participation", "micro_interaction", "identity_evidence"],
        containers: ["recurring_club", "board_game_social", "structured_class", "volunteering", "creative_workshop", "group_fitness_class", "community_event"],
        searchSeeds: ["meetup group", "board game night", "volunteer event", "book club", "beginner class", "run club", "community mixer"],
        instruction: "Try multiple recurring containers until one has emotional pull and repeated faces.",
      },
      container_dfs: {
        reps: ["returnability", "social_extension", "invitation"],
        containers: ["recurring_club", "volunteering", "structured_class", "community_event", "food_social", "library_program"],
        searchSeeds: ["weekly meetup", "volunteer group", "club meeting", "community class", "trivia night", "library program"],
        instruction: "Return to promising rooms and practice small follow-ups, name recognition, and invitations.",
      },
    },
  },
  homebody_recovery: {
    label: "Homebody Recovery",
    philosophy: "Replace passive screen loops with easy real-world wins before asking for social bravery.",
    stages: {
      foundation: {
        reps: ["activation", "public_presence", "staying_power"],
        containers: ["quiet_public_place", "casual_third_place"],
        searchSeeds: ["quiet cafe", "library", "bookstore", "short park walk", "museum"],
        instruction: "Keep the friction low: leave home, enter a public place, stay long enough for the body to learn it is safe.",
      },
      container_bfs: {
        reps: ["novelty_tolerance", "identity_evidence", "micro_interaction"],
        containers: ["community_event", "creative_workshop", "library_program", "group_fitness_class", "coworking_social"],
        searchSeeds: ["farmers market", "drop-in workshop", "outdoor yoga", "library program", "coworking day pass", "low-key local event"],
        instruction: "Broaden from solo comfort into structured but low-pressure offline experiences.",
      },
      container_dfs: {
        reps: ["returnability", "group_participation", "identity_evidence"],
        containers: ["recurring_club", "structured_class", "movement_group", "community_event", "coworking_social"],
        searchSeeds: ["weekly class", "recurring local event", "community group", "drop-in club", "coworking meetup"],
        instruction: "Turn one or two offline places into repeatable anchors so leaving home becomes identity, not effort.",
      },
    },
  },
  social_anxiety: {
    label: "Social Anxiety / Public Comfort",
    philosophy: "Use exposure therapy logic: one fear lever at a time, with tiny reps, exit ramps, and reflection.",
    stages: {
      foundation: {
        reps: ["activation", "public_presence", "staying_power", "recovery"],
        containers: ["quiet_public_place", "casual_third_place"],
        searchSeeds: ["quiet cafe", "library", "bookstore", "low-traffic park"],
        instruction: "Train visibility and staying power before prescribing interaction as the main objective.",
      },
      container_bfs: {
        reps: ["micro_interaction", "group_participation", "identity_evidence"],
        containers: ["structured_class", "creative_workshop", "board_game_social", "group_fitness_class", "library_program"],
        searchSeeds: ["beginner workshop", "drop-in class", "board game night", "yoga class", "trivia night", "library program"],
        instruction: "Introduce optional micro-interactions inside structured environments where the script is obvious.",
      },
      container_dfs: {
        reps: ["returnability", "social_extension", "invitation"],
        containers: ["recurring_club", "structured_class", "community_event", "board_game_social"],
        searchSeeds: ["weekly meetup", "beginner class series", "club meeting", "volunteer group", "game night"],
        instruction: "Deepen repeat settings after safety is proven; use follow-up and invitation reps carefully.",
      },
    },
  },
  offline_hobbies: {
    label: "Offline Hobbies / Identity Expansion",
    philosophy: "Hobbies are not curricula here; they are identity evidence, recurring rooms, and reasons to leave the house.",
    stages: {
      foundation: {
        reps: ["activation", "public_presence", "identity_evidence"],
        containers: ["casual_third_place", "creative_workshop", "quiet_public_place"],
        searchSeeds: ["art gallery", "maker space open house", "library program", "craft store class"],
        instruction: "Start by scouting or observing beginner-friendly hobby spaces.",
      },
      container_bfs: {
        reps: ["group_participation", "identity_evidence", "micro_interaction"],
        containers: ["creative_workshop", "makers_night", "structured_class", "recurring_club", "community_event", "library_program"],
        searchSeeds: ["beginner art class", "pottery workshop", "maker space", "book club", "photography walk", "craft night", "library program"],
        instruction: "Try hands-on beginner containers where showing up creates proof: 'I am someone who does this.'",
      },
      container_dfs: {
        reps: ["returnability", "group_participation", "social_extension"],
        containers: ["structured_class", "recurring_club", "creative_workshop", "makers_night"],
        searchSeeds: ["class series", "weekly club", "open studio", "community workshop", "open maker night"],
        instruction: "Return to the hobby spaces with resonance and build familiarity with people, staff, and routines.",
      },
    },
  },
  third_places: {
    label: "Third Places",
    philosophy: "Help the user become known somewhere outside home and work.",
    stages: {
      foundation: {
        reps: ["activation", "public_presence", "returnability"],
        containers: ["casual_third_place", "quiet_public_place"],
        searchSeeds: ["local cafe", "bookstore", "library", "brewery", "brunch spot"],
        instruction: "Find places worth returning to; the goal is comfort and familiarity, not novelty alone.",
      },
      container_bfs: {
        reps: ["returnability", "micro_interaction", "identity_evidence"],
        containers: ["casual_third_place", "community_event", "performance_event", "recurring_club", "food_social", "coworking_social"],
        searchSeeds: ["trivia night", "open mic", "live music", "community event", "game night", "food hall", "coworking meetup"],
        instruction: "Explore third places with repeatable rhythms: weekly events, regulars, staff, and simple reasons to come back.",
      },
      container_dfs: {
        reps: ["returnability", "social_extension", "invitation"],
        containers: ["casual_third_place", "recurring_club", "community_event", "food_social", "performance_event"],
        searchSeeds: ["weekly event", "regulars night", "community meetup", "open mic", "trivia night"],
        instruction: "Deepen the best third place through repeated visits, small recognition, and eventually inviting someone along.",
      },
    },
  },
  anti_doomscroll: {
    label: "Anti-Doomscroll Offline Life",
    philosophy: "Convert passive screen energy into replacement rituals that are embodied, local, and repeatable.",
    stages: {
      foundation: {
        reps: ["activation", "public_presence", "staying_power"],
        containers: ["quiet_public_place", "casual_third_place"],
        searchSeeds: ["phone-free walk", "cafe", "library", "bookstore", "park"],
        instruction: "Make the replacement easier than the scroll: nearby, low-cost, and satisfying enough to repeat.",
      },
      container_bfs: {
        reps: ["identity_evidence", "group_participation", "micro_interaction"],
        containers: ["community_event", "movement_group", "group_fitness_class", "creative_workshop", "recurring_club", "library_program"],
        searchSeeds: ["evening class", "local event", "run club", "workshop", "board game night", "library program"],
        instruction: "Add structure so the phone is replaced by a room, a start time, and a reason to be there.",
      },
      container_dfs: {
        reps: ["returnability", "identity_evidence", "social_extension"],
        containers: ["recurring_club", "structured_class", "movement_group", "community_event"],
        searchSeeds: ["weekly class", "club night", "recurring event", "volunteer shift"],
        instruction: "Turn the best replacement ritual into a durable anchor.",
      },
    },
  },
};

const LENS_PRIORITY: GoalLens[] = [
  "dating_readiness",
  "friendship",
  "social_anxiety",
  "homebody_recovery",
  "offline_hobbies",
  "third_places",
  "anti_doomscroll",
];

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function inferGoalLenses(
  comfortProfile: { primaryGoal?: string; goals?: string; barriers?: string; goalTags?: string[] } | null | undefined,
  goalTags: string[] = [],
): GoalLens[] {
  const text = [
    comfortProfile?.primaryGoal,
    comfortProfile?.goals,
    comfortProfile?.barriers,
    ...(comfortProfile?.goalTags ?? []),
    ...goalTags,
  ].filter(Boolean).join(" ").toLowerCase();
  const tags = new Set([...(comfortProfile?.goalTags ?? []), ...goalTags]);
  const lenses: GoalLens[] = [];

  if (tags.has("dating") || /dating|date|romantic|flirt|ask.*out|partner/i.test(text)) lenses.push("dating_readiness");
  if (tags.has("friendship") || tags.has("community") || /friend|community|belong|my people|meet people|social circle/i.test(text)) lenses.push("friendship");
  if (/social anx|shy|stranger|conversation|crowd|public|visible|rejection|freeze/i.test(text)) lenses.push("social_anxiety");
  if (tags.has("homebody_recovery") || /homebody|leave the house|get out|isolated|stuck at home/i.test(text)) lenses.push("homebody_recovery");
  if (tags.has("discover_hobby") || tags.has("new_skill") || /hobby|class|workshop|learn|skill|art|music|dance/i.test(text)) lenses.push("offline_hobbies");
  if (tags.has("third_place") || /third place|regular|routine|outside home|outside work/i.test(text)) lenses.push("third_places");
  if (/doomscroll|scroll|phone|screen|passive|wasting time/i.test(text)) lenses.push("anti_doomscroll");

  if (lenses.length === 0) {
    if (tags.has("socialize")) lenses.push("friendship");
    else if (tags.has("explore") || tags.has("routine")) lenses.push("homebody_recovery");
    else lenses.push("anti_doomscroll");
  }

  return unique(lenses).sort((a, b) => LENS_PRIORITY.indexOf(a) - LENS_PRIORITY.indexOf(b));
}

function phaseForCompletedCount(completedQuestCount: number): FrameworkPhase {
  if (completedQuestCount < 5) return "foundation";
  if (completedQuestCount < 12) return "container_bfs";
  return "container_dfs";
}

export function buildOfflineSocialFrameworkPlan(input: {
  comfortProfile: { primaryGoal?: string; goals?: string; barriers?: string; goalTags?: string[] } | null | undefined;
  goalTags?: string[];
  completedQuestCount?: number;
  recentCategories?: string[];
}): OfflineSocialFrameworkPlan {
  const completedQuestCount = input.completedQuestCount ?? 0;
  const phase = phaseForCompletedCount(completedQuestCount);
  const lenses = inferGoalLenses(input.comfortProfile, input.goalTags ?? []);
  const selectedLenses = lenses.slice(0, 2);
  const primaryLens = selectedLenses[0] ?? "anti_doomscroll";
  const stages = selectedLenses.map((lens) => PLAYBOOKS[lens].stages[phase]);
  const reps = unique(stages.flatMap((stage) => stage.reps)).slice(0, 6);
  const containers = unique(stages.flatMap((stage) => stage.containers)).slice(0, 9);
  const searchSeeds = unique(stages.flatMap((stage) => stage.searchSeeds)).slice(0, 12);
  const alreadyUsed = new Set(input.recentCategories ?? []);
  const implementationRule = phase === "container_bfs"
    ? "BFS mode: at least one suggested category and one search query must come from the listed structured container families. Do not choose cafes, bakeries, tea houses, dessert shops, parks, or generic browsing unless this is recovery after a fresh rejection."
    : phase === "container_dfs"
      ? "DFS mode: if history shows resonance in a container, deepen that room with returnability, participation, follow-up, or invitation reps."
      : "Foundation mode: trust first. One gentle exposure lever; tiny rep and exit ramp matter more than novelty.";

  const promptLines = [
    "\nOFFLINE-SOCIAL FRAMEWORK:",
    `- Primary lens: ${PLAYBOOKS[primaryLens].label}`,
    `- Secondary lenses: ${selectedLenses.slice(1).map((lens) => PLAYBOOKS[lens].label).join(", ") || "none"}`,
    `- Phase: ${phase} after ${completedQuestCount} completed quests`,
    `- Philosophy: ${PLAYBOOKS[primaryLens].philosophy}`,
    `- Target reps (conceptual; map to the closest allowed capacityTrack): ${reps.join(", ")}`,
    `- Container families: ${containers.join(", ")}`,
    `- Implementation search seeds: ${searchSeeds.join("; ")}`,
    `- Rule: ${implementationRule}`,
  ];

  for (const lens of selectedLenses) {
    const playbook = PLAYBOOKS[lens];
    const stage = playbook.stages[phase];
    promptLines.push(`- ${playbook.label}: ${stage.instruction}`);
  }

  if (alreadyUsed.size > 0) {
    promptLines.push(`- Recent/known venue categories: ${[...alreadyUsed].slice(0, 8).join(", ")}. Use this to decide whether to broaden or deepen.`);
  }

  return {
    phase,
    primaryLens,
    lenses,
    reps,
    containers,
    searchSeeds,
    promptBlock: `${promptLines.join("\n")}\n`,
  };
}
