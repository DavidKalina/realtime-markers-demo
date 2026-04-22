import type { DataSource } from "typeorm";
import {
  isConcreteGoalActionType,
  normalizeGoalActionType,
} from "./GoalMilestoneContext";
import { normalizeVenueCategory } from "./ScoutCandidateGrounding";

interface JourneySignalRow {
  quest_role: string | null;
  capacity_track: string | null;
  direct_goal_touch: boolean | null;
  goal_action_type: string | null;
  completed_at: Date | null;
  venue_category: string | null;
  venue_name: string | null;
}

export type JourneyCategoryFamily =
  | "coffee_family"
  | "park_outdoor"
  | "library_quiet"
  | "community_room"
  | "structured_social"
  | "food_social"
  | "nightlife_social"
  | "retail_browse"
  | "other";

export interface JourneyDiversityContext {
  recentCategories: string[];
  recentFamilies: JourneyCategoryFamily[];
  recentVenueNames: string[];
  recentRoles: string[];
  recentMilestoneCount: number;
  recentDirectGoalTouchCount: number;
  recentStructuredCount: number;
  recentBaseRecoveryCount: number;
  questsSinceDirectGoalTouch: number | null;
  questsSinceMilestone: number | null;
  consecutiveSameCategoryCount: number;
  consecutiveSameFamilyCount: number;
  consecutiveSameVenueCount: number;
  dominantRecentCategory: string | null;
  dominantRecentFamily: JourneyCategoryFamily | null;
  postGoalClosureWindow: boolean;
  shouldCooldownMilestone: boolean;
  shouldForceStructuredNext: boolean;
  promptBlock: string;
}

const STRUCTURED_SOCIAL_CATEGORIES = new Set([
  "Art Studio / Workshop",
  "Board Game Venue",
  "Climbing Gym",
  "College / Adult Education",
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

const SAFE_REPEATABLE_FAMILIES = new Set<JourneyCategoryFamily>([
  "coffee_family",
  "park_outdoor",
  "library_quiet",
  "community_room",
]);

const STRUCTURED_CONTEXT_CATEGORIES = new Set([
  "Art Studio / Workshop",
  "Board Game Venue",
  "Climbing Gym",
  "College / Adult Education",
  "Community Center",
  "Coworking Space",
  "Gym / Fitness Studio",
  "Karaoke Venue",
  "Library",
  "Maker Space",
  "Music Venue / Concert Hall",
  "Recreation Center",
  "Sports Club",
  "Theatre / Performing Arts",
  "Workshop / Class Venue",
  "Yoga / Pilates Studio",
]);

function countLeadingSame(values: string[]): number {
  const first = values[0];
  if (!first) return 0;
  let count = 0;
  for (const value of values) {
    if (value !== first) break;
    count += 1;
  }
  return count;
}

function dominantCategory(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked[0]) return null;
  return ranked[0][1] >= 3 ? ranked[0][0] : null;
}

function dominantFamily(
  values: JourneyCategoryFamily[],
): JourneyCategoryFamily | null {
  if (values.length === 0) return null;
  const counts = new Map<JourneyCategoryFamily, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked[0]) return null;
  return ranked[0][1] >= 3 ? ranked[0][0] : null;
}

export function classifyJourneyCategoryFamily(
  rawCategory: string | null | undefined,
): JourneyCategoryFamily {
  const category = normalizeVenueCategory(rawCategory);
  if (
    [
      "Coffee Shop",
      "Bookstore",
      "Brunch Spot",
      "Bakery / Dessert Shop",
    ].includes(category)
  ) {
    return "coffee_family";
  }
  if (category === "Trail / Park") {
    return "park_outdoor";
  }
  if (category === "Library") {
    return "library_quiet";
  }
  if (["Community Center", "Recreation Center"].includes(category)) {
    return "community_room";
  }
  if (STRUCTURED_SOCIAL_CATEGORIES.has(category)) {
    return "structured_social";
  }
  if (["Restaurant", "Food Market / Farmers Market"].includes(category)) {
    return "food_social";
  }
  if (["Bar", "Brewery / Taproom"].includes(category)) {
    return "nightlife_social";
  }
  if (["Specialty Shop", "Museum", "Other"].includes(category)) {
    return "retail_browse";
  }
  return "other";
}

export function isSafeRepeatableFamily(
  family: string | null | undefined,
): boolean {
  if (!family) return false;
  return SAFE_REPEATABLE_FAMILIES.has(family as JourneyCategoryFamily);
}

function isStructuredContextRow(row: JourneySignalRow): boolean {
  const category = normalizeVenueCategory(row.venue_category);
  if (STRUCTURED_CONTEXT_CATEGORIES.has(category)) return true;
  return /\b(class|club|meetup|workshop|trivia|dance|volunteer|league|open play|open gym|board game|game night|run club|pickleball|yoga|pilates|group fitness|climbing|coworking|library program|book club|language exchange|open mic|comedy|live music|maker night|social mixer)\b/i.test(
    `${row.quest_role ?? ""} ${row.capacity_track ?? ""}`,
  );
}

function isBaseRecoveryRow(row: JourneySignalRow): boolean {
  const family = classifyJourneyCategoryFamily(row.venue_category);
  if (!isSafeRepeatableFamily(family)) return false;
  return !isStructuredContextRow(row);
}

export async function buildJourneyDiversityContext(input: {
  dataSource: DataSource;
  userId: string;
  completedQuestCount: number;
}): Promise<JourneyDiversityContext> {
  const rows: JourneySignalRow[] = await input.dataSource.query(
    `SELECT
       s.quest_role,
       s.capacity_track,
       s.direct_goal_touch,
       s.goal_action_type,
       s.completed_at,
       o.venue_category,
       o.venue_name
     FROM sidequests s
     LEFT JOIN objectives o ON o.sidequest_id = s.id AND o.sort_order = 0
     WHERE s.user_id = $1
       AND s.deleted_at IS NULL
       AND (s.completed_at IS NOT NULL OR s.status IN ('READY', 'GENERATING'))
     ORDER BY COALESCE(s.completed_at, s.created_at) DESC
     LIMIT 8`,
    [input.userId],
  );

  const recentCategories = rows
    .map((row) => normalizeVenueCategory(row.venue_category))
    .filter((value) => value && value !== "Other");
  const recentFamilies = recentCategories.map((value) =>
    classifyJourneyCategoryFamily(value),
  );
  const recentVenueNames = rows
    .map((row) => row.venue_name?.trim() ?? "")
    .filter(Boolean);
  const recentRoles = rows
    .map((row) => row.quest_role?.trim() ?? "")
    .filter(Boolean);
  const recentMilestoneCount = rows
    .slice(0, 5)
    .filter((row) => row.quest_role === "milestone").length;
  const recentDirectGoalTouchCount = rows
    .slice(0, 5)
    .filter((row) =>
      isConcreteGoalActionType(normalizeGoalActionType(row.goal_action_type)),
    ).length;
  const recentStructuredCount = rows
    .slice(0, 5)
    .filter((row) => isStructuredContextRow(row)).length;
  const recentBaseRecoveryCount = rows
    .slice(0, 5)
    .filter((row) => isBaseRecoveryRow(row)).length;

  let questsSinceDirectGoalTouch: number | null = null;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (
      isConcreteGoalActionType(normalizeGoalActionType(row.goal_action_type))
    ) {
      questsSinceDirectGoalTouch = index;
      break;
    }
  }

  let questsSinceMilestone: number | null = null;
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index]?.quest_role === "milestone") {
      questsSinceMilestone = index;
      break;
    }
  }

  const consecutiveSameCategoryCount = countLeadingSame(recentCategories);
  const consecutiveSameFamilyCount = countLeadingSame(recentFamilies);
  const consecutiveSameVenueCount = countLeadingSame(recentVenueNames);
  const dominantRecentCategory = dominantCategory(recentCategories.slice(0, 5));
  const dominantRecentFamily = dominantFamily(recentFamilies.slice(0, 5));
  const postGoalClosureWindow =
    questsSinceDirectGoalTouch !== null && questsSinceDirectGoalTouch < 12;
  const shouldCooldownMilestone =
    questsSinceDirectGoalTouch !== null && questsSinceDirectGoalTouch < 2;
  const lateJourney = input.completedQuestCount >= 12;
  const shouldForceStructuredNext =
    !shouldCooldownMilestone &&
    ((postGoalClosureWindow &&
      recentBaseRecoveryCount >= 3 &&
      recentStructuredCount <= 1) ||
      (lateJourney &&
        recentBaseRecoveryCount >= 4 &&
        recentStructuredCount === 0));

  const lines = [
    "\nRECENT JOURNEY MIX:",
    `- Recent categories: ${recentCategories.slice(0, 5).join(", ") || "none"}`,
    `- Recent families: ${recentFamilies.slice(0, 5).join(", ") || "none"}`,
    `- Recent roles: ${recentRoles.slice(0, 5).join(", ") || "none"}`,
    `- Recent direct-goal touches: ${recentDirectGoalTouchCount}/5; recent milestones: ${recentMilestoneCount}/5.`,
    `- Recent structured rooms: ${recentStructuredCount}/5; recent base/recovery rooms: ${recentBaseRecoveryCount}/5.`,
  ];

  if (dominantRecentCategory) {
    lines.push(
      `- Repetition warning: ${dominantRecentCategory} is dominating the recent mix. Do not keep prescribing near-identical versions of it unless this is an explicit enjoy or recovery quest.`,
    );
  }
  if (isSafeRepeatableFamily(dominantRecentFamily)) {
    lines.push(
      `- Family warning: ${dominantRecentFamily} has become the safe default. Break the pattern by using a different room family for the next non-enjoy quest.`,
    );
  }
  if (shouldCooldownMilestone) {
    lines.push(
      "- Milestone cooldown: a direct goal touch just happened. Spend the next 1-2 quests broadening the room mix instead of prescribing another goal-closure rep.",
    );
  }
  if (shouldForceStructuredNext) {
    lines.push(
      "- Structured floor: the late journey is drifting into maintenance mode. The next non-enjoy quest should be a real structured room if one is available.",
    );
  }

  return {
    recentCategories,
    recentFamilies,
    recentVenueNames,
    recentRoles,
    recentMilestoneCount,
    recentDirectGoalTouchCount,
    recentStructuredCount,
    recentBaseRecoveryCount,
    questsSinceDirectGoalTouch,
    questsSinceMilestone,
    consecutiveSameCategoryCount,
    consecutiveSameFamilyCount,
    consecutiveSameVenueCount,
    dominantRecentCategory,
    dominantRecentFamily,
    postGoalClosureWindow,
    shouldCooldownMilestone,
    shouldForceStructuredNext,
    promptBlock: `${lines.join("\n")}\n`,
  };
}
