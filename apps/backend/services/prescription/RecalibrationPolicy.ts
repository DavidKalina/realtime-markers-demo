import { CapacityTrack } from "../../entities/Sidequest";
import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
import type { StrategyBrief } from "./PrescriptionStrategy";

export const DENSE_PUBLIC_CATEGORIES = [
  "Bar",
  "Brewery / Taproom",
  "Music Venue / Concert Hall",
  "Theatre / Performing Arts",
  "Karaoke Venue",
  "Board Game Venue",
  "Food Market / Farmers Market",
  "Arcade / Entertainment",
  "Bowling Alley",
] as const;

export const FIXED_TIMING_CATEGORIES = [
  "Theatre / Performing Arts",
  "Music Venue / Concert Hall",
  "Workshop / Class Venue",
  "College / Adult Education",
  "Sports Club",
  "Community Center",
  "Board Game Venue",
] as const;

export interface StrategyBriefPatch {
  socialChallengeLevel?: StrategyBrief["socialChallengeLevel"];
  difficultyRange?: StrategyBrief["difficultyRange"];
  experienceType?: string;
  suggestedCategories?: string[];
  avoidCategories?: string[];
  suggestedTiming?: string;
  targetCity?: string;
  searchQueries?: string[];
  capacityTrack?: CapacityTrack;
  repIntent?: string;
  preferredVenue?: string;
}

export interface RecalibrationPolicyDecision {
  patch: StrategyBriefPatch;
  logLines: string[];
}

export function buildLocalSearchQueries(
  brief: StrategyBrief,
  city: string,
): string[] {
  const categories =
    brief.suggestedCategories.length > 0
      ? brief.suggestedCategories
      : [brief.experienceType || "low pressure outing"];
  return categories
    .slice(0, 3)
    .map((category) => `${category} ${city}`.replace(/\s+/g, " ").trim());
}

const GENTLE_LOCAL_CATEGORIES = [
  "Coffee Shop",
  "Library",
  "Trail / Park",
] as const;

function buildGentleLocalSearchQueries(city: string): string[] {
  return [`coffee shop ${city}`, `library ${city}`, `park ${city}`];
}

export function resolveRecalibrationPolicy(input: {
  brief: StrategyBrief;
  ctx: PrescriptionPromptContext;
  homeCity: string;
}): RecalibrationPolicyDecision {
  const { brief, ctx, homeCity } = input;
  const patch: StrategyBriefPatch = {};
  const avoidCategories = new Set<string>();
  const logLines: string[] = [];

  const setDifficultyRange = (range: StrategyBrief["difficultyRange"]) => {
    patch.difficultyRange = [Math.min(range[0], range[1]), range[1]];
  };

  if (ctx.isEarlyCalibration) {
    const nextSocial =
      brief.socialChallengeLevel === "medium" ||
      brief.socialChallengeLevel === "high"
        ? "low"
        : undefined;
    const nextMaxDifficulty = Math.min(brief.difficultyRange[1], 5);
    if (nextSocial) patch.socialChallengeLevel = nextSocial;
    if (nextMaxDifficulty !== brief.difficultyRange[1]) {
      setDifficultyRange([
        Math.min(brief.difficultyRange[0], nextMaxDifficulty),
        nextMaxDifficulty,
      ]);
    }
    if (nextSocial || nextMaxDifficulty !== brief.difficultyRange[1]) {
      logLines.push(
        `[multi-agent] Early-calibration policy: social ${brief.socialChallengeLevel}→${nextSocial ?? brief.socialChallengeLevel}, diffMax ${brief.difficultyRange[1]}→${nextMaxDifficulty}`,
      );
    }
  }

  const pattern = ctx.rejectionPattern;
  if (pattern) {
    const beforeAvoid = avoidCategories.size;
    switch (pattern.reason) {
      case "TOO_SOCIAL":
        patch.socialChallengeLevel = "none";
        break;
      case "TOO_FAR":
        break;
      case "TOO_MUCH_EFFORT":
      case "NEED_GENTLER":
        setDifficultyRange([
          1,
          Math.min(3, patch.difficultyRange?.[1] ?? brief.difficultyRange[1]),
        ]);
        if (pattern.reason === "NEED_GENTLER") {
          patch.socialChallengeLevel = "none";
        }
        break;
      case "NOT_MY_VIBE":
        for (const category of pattern.categories)
          avoidCategories.add(category);
        break;
      case "TOO_PUBLIC":
        patch.socialChallengeLevel = "none";
        setDifficultyRange([
          1,
          Math.min(4, patch.difficultyRange?.[1] ?? brief.difficultyRange[1]),
        ]);
        for (const category of DENSE_PUBLIC_CATEGORIES)
          avoidCategories.add(category);
        if (
          !brief.suggestedTiming ||
          /evening|night|peak|busy/i.test(brief.suggestedTiming)
        ) {
          patch.suggestedTiming =
            "off-peak weekday late morning or early afternoon";
        }
        break;
      case "BAD_TIMING": {
        const maxDifficulty = Math.min(
          4,
          patch.difficultyRange?.[1] ?? brief.difficultyRange[1],
        );
        setDifficultyRange([
          Math.min(
            patch.difficultyRange?.[0] ?? brief.difficultyRange[0],
            maxDifficulty,
          ),
          maxDifficulty,
        ]);
        for (const category of FIXED_TIMING_CATEGORIES)
          avoidCategories.add(category);
        patch.suggestedTiming = brief.suggestedTiming
          ? `${brief.suggestedTiming}; avoid fixed-time events and pick a flexible walk-in window`
          : "flexible walk-in window; avoid fixed-time events";
        break;
      }
    }
    const changed =
      patch.socialChallengeLevel !== undefined ||
      patch.difficultyRange !== undefined ||
      patch.suggestedTiming !== undefined ||
      avoidCategories.size !== beforeAvoid;
    if (changed) {
      logLines.push(
        `[multi-agent] Rejection-pattern policy (${pattern.reason} × ${pattern.count})`,
      );
    }
  }

  const last = ctx.lastRejection;
  if (last) {
    const currentMaxDifficulty =
      patch.difficultyRange?.[1] ?? brief.difficultyRange[1];
    switch (last.reason) {
      case "TOO_FAR":
        patch.targetCity = homeCity;
        patch.searchQueries = buildLocalSearchQueries(brief, homeCity);
        patch.preferredVenue = undefined;
        break;
      case "NEED_GENTLER":
        setDifficultyRange([1, Math.min(3, currentMaxDifficulty)]);
        patch.socialChallengeLevel = "none";
        patch.targetCity = homeCity;
        patch.experienceType = "gentle local reset";
        patch.suggestedCategories = [...GENTLE_LOCAL_CATEGORIES];
        patch.searchQueries = buildGentleLocalSearchQueries(homeCity);
        patch.preferredVenue = undefined;
        if (
          brief.capacityTrack !== CapacityTrack.ACTIVATION &&
          brief.capacityTrack !== CapacityTrack.PUBLIC_PRESENCE &&
          brief.capacityTrack !== CapacityTrack.RECOVERY &&
          brief.capacityTrack !== CapacityTrack.RETURNABILITY
        ) {
          patch.capacityTrack = CapacityTrack.ACTIVATION;
          patch.repIntent =
            "Do the gentlest version that still gets you out the door.";
        }
        for (const category of DENSE_PUBLIC_CATEGORIES)
          avoidCategories.add(category);
        break;
      case "TOO_PUBLIC":
        patch.socialChallengeLevel = "none";
        setDifficultyRange([
          Math.min(patch.difficultyRange?.[0] ?? brief.difficultyRange[0], 4),
          Math.min(4, currentMaxDifficulty),
        ]);
        for (const category of DENSE_PUBLIC_CATEGORIES)
          avoidCategories.add(category);
        patch.suggestedTiming =
          "off-peak weekday late morning or early afternoon";
        break;
      case "TOO_MUCH_EFFORT":
        setDifficultyRange([1, Math.min(3, currentMaxDifficulty)]);
        patch.socialChallengeLevel = "none";
        for (const category of FIXED_TIMING_CATEGORIES)
          avoidCategories.add(category);
        break;
      case "TOO_SOCIAL":
        patch.socialChallengeLevel = "none";
        break;
      case "NOT_MY_VIBE":
        if (last.venueCategory) avoidCategories.add(last.venueCategory);
        break;
      case "BAD_TIMING":
        for (const category of FIXED_TIMING_CATEGORIES)
          avoidCategories.add(category);
        patch.suggestedTiming =
          "flexible walk-in window; avoid fixed-time events";
        break;
    }
    logLines.push(`[multi-agent] Fresh-rejection policy (${last.reason})`);
  }

  if (avoidCategories.size > 0) {
    patch.avoidCategories = [...avoidCategories];
  }

  return { patch, logLines };
}

export function applyStrategyBriefPatch(
  brief: StrategyBrief,
  patch: StrategyBriefPatch,
): void {
  if (patch.socialChallengeLevel !== undefined)
    brief.socialChallengeLevel = patch.socialChallengeLevel;
  if (patch.difficultyRange !== undefined)
    brief.difficultyRange = patch.difficultyRange;
  if (patch.experienceType !== undefined)
    brief.experienceType = patch.experienceType;
  if (patch.suggestedCategories !== undefined)
    brief.suggestedCategories = patch.suggestedCategories;
  if (patch.suggestedTiming !== undefined)
    brief.suggestedTiming = patch.suggestedTiming;
  if (patch.targetCity !== undefined) brief.targetCity = patch.targetCity;
  if (patch.searchQueries !== undefined)
    brief.searchQueries = patch.searchQueries;
  if (patch.capacityTrack !== undefined)
    brief.capacityTrack = patch.capacityTrack;
  if (patch.repIntent !== undefined) brief.repIntent = patch.repIntent;
  if ("preferredVenue" in patch) brief.preferredVenue = patch.preferredVenue;
  for (const category of patch.avoidCategories ?? []) {
    if (
      !brief.avoidCategories.some(
        (existing) => existing.toLowerCase() === category.toLowerCase(),
      )
    ) {
      brief.avoidCategories.push(category);
    }
  }
  if (brief.difficultyRange[0] > brief.difficultyRange[1]) {
    brief.difficultyRange[0] = brief.difficultyRange[1];
  }
}
