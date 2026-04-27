import { CapacityTrack } from "../../entities/Sidequest";
import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
import {
  downgradeDatingRepShape,
  type DatingRepShape,
} from "./DatingProgressionPolicy";
import type { StrategyBrief } from "./PrescriptionStrategy";
import {
  mergeQualityProfiles,
  type VenueQualityProfile,
} from "./VenueQualities";

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
  datingRepShape?: DatingRepShape;
  allowDirectDatingRep?: boolean;
  preferredDatingRepShapes?: DatingRepShape[];
  /** Quality patch — merged into brief.venueQualities. */
  venueQualities?: VenueQualityProfile;
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
    .map((category) => `${category} near ${city}`.replace(/\s+/g, " ").trim());
}

// ── Quality patches keyed off rejection reasons ────────────────
// These describe *what kind of room* the next rep needs, not which
// categories. The Strategist + Scout pick venues that fit; the validator
// double-checks via classifyCandidateQualities.

const TOO_PUBLIC_QUALITIES: VenueQualityProfile = {
  must: [],
  prefer: ["low-traffic", "quiet-contemplative", "low-social-pressure"],
  avoid: ["loud-lively", "people-rich", "scene-y-exclusive"],
};

const NEED_GENTLER_QUALITIES: VenueQualityProfile = {
  must: ["drop-in-friendly", "low-social-pressure"],
  prefer: ["ambient-presence", "single-friendly"],
  avoid: ["high-social-pressure", "loud-lively", "scene-y-exclusive"],
};

const TOO_MUCH_EFFORT_QUALITIES: VenueQualityProfile = {
  must: ["drop-in-friendly"],
  prefer: ["free", "low-cost-drop-in"],
  avoid: ["requires-membership", "requires-signup", "requires-reservation"],
};

const BAD_TIMING_QUALITIES: VenueQualityProfile = {
  must: [],
  prefer: ["drop-in-friendly", "walk-in-only"],
  avoid: ["time-bounded", "requires-reservation"],
};

interface DatingRepFallback {
  datingRepShape: DatingRepShape;
  allowDirectDatingRep: boolean;
  experienceType: string;
  repIntent: string;
}

function buildGentlerDatingRepFallback(
  brief: StrategyBrief,
): DatingRepFallback | null {
  if (!brief.datingRepShape) return null;
  const nextShape = downgradeDatingRepShape(brief.datingRepShape);
  switch (nextShape) {
    case "draft_message":
      return {
        datingRepShape: nextShape,
        allowDirectDatingRep: false,
        experienceType:
          "date-worthy local place that supports drafting one honest message",
        repIntent:
          "Pick a real place and draft one honest dating message without sending it yet.",
      };
    case "continue_conversation":
      return {
        datingRepShape: nextShape,
        allowDirectDatingRep: false,
        experienceType:
          "social container that supports one light conversation follow-up",
        repIntent:
          "Keep one promising conversation alive with one honest follow-up from a real outing.",
      };
    case "venue_selection":
    default:
      return {
        datingRepShape: "venue_selection",
        allowDirectDatingRep: false,
        experienceType: "date-worthy room with no romantic pressure",
        repIntent:
          "Spend time in a date-worthy room and notice one place you would genuinely suggest later.",
      };
  }
}

export function resolveRecalibrationPolicy(input: {
  brief: StrategyBrief;
  ctx: PrescriptionPromptContext;
  homeCity: string;
}): RecalibrationPolicyDecision {
  const { brief, ctx, homeCity } = input;
  const patch: StrategyBriefPatch = {};
  const avoidCategories = new Set<string>();
  const qualityPatches: VenueQualityProfile[] = [];
  const logLines: string[] = [];
  const lateJourneyStructuredGuard =
    ctx.questRole !== "enjoy" &&
    (ctx.journeyPhase?.requireStructuredNonEnjoy === true ||
      ctx.journeyPhase?.forbidParkForNonEnjoy === true);
  const gentleDatingRepFallback = buildGentlerDatingRepFallback(brief);

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
    const beforeQualityCount = qualityPatches.length;
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
          qualityPatches.push(NEED_GENTLER_QUALITIES);
        } else {
          qualityPatches.push(TOO_MUCH_EFFORT_QUALITIES);
        }
        break;
      case "NOT_MY_VIBE":
        // NOT_MY_VIBE legitimately works at the category level — it's the
        // user's own signal about specific category strings.
        for (const category of pattern.categories)
          avoidCategories.add(category);
        break;
      case "TOO_PUBLIC":
        patch.socialChallengeLevel = "none";
        setDifficultyRange([
          1,
          Math.min(4, patch.difficultyRange?.[1] ?? brief.difficultyRange[1]),
        ]);
        qualityPatches.push(TOO_PUBLIC_QUALITIES);
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
        qualityPatches.push(BAD_TIMING_QUALITIES);
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
      avoidCategories.size !== beforeAvoid ||
      qualityPatches.length !== beforeQualityCount;
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
        // No category prescription — let the Strategist regenerate searches
        // tightened to the home radius. Pull suggested categories the LLM
        // already picked into local queries as a hint, otherwise leave blank.
        patch.searchQueries = buildLocalSearchQueries(brief, homeCity);
        patch.preferredVenue = undefined;
        break;
      case "NEED_GENTLER":
        setDifficultyRange([1, Math.min(3, currentMaxDifficulty)]);
        patch.socialChallengeLevel = "none";
        qualityPatches.push(NEED_GENTLER_QUALITIES);
        patch.experienceType = "gentle local reset";
        patch.preferredVenue = undefined;
        if (gentleDatingRepFallback) {
          patch.datingRepShape = gentleDatingRepFallback.datingRepShape;
          patch.allowDirectDatingRep =
            gentleDatingRepFallback.allowDirectDatingRep;
          patch.preferredDatingRepShapes = [
            gentleDatingRepFallback.datingRepShape,
          ];
          patch.experienceType = gentleDatingRepFallback.experienceType;
          patch.repIntent = gentleDatingRepFallback.repIntent;
        }
        if (
          brief.capacityTrack !== CapacityTrack.ACTIVATION &&
          brief.capacityTrack !== CapacityTrack.PUBLIC_PRESENCE &&
          brief.capacityTrack !== CapacityTrack.RECOVERY &&
          brief.capacityTrack !== CapacityTrack.RETURNABILITY
        ) {
          patch.capacityTrack = gentleDatingRepFallback
            ? CapacityTrack.SOCIAL_EXTENSION
            : CapacityTrack.ACTIVATION;
          if (!gentleDatingRepFallback) {
            patch.repIntent =
              "Do the gentlest version that still gets you out the door.";
          }
        }
        if (lateJourneyStructuredGuard) {
          if (
            (patch.capacityTrack ?? brief.capacityTrack) ===
            CapacityTrack.ACTIVATION
          ) {
            patch.capacityTrack = gentleDatingRepFallback
              ? CapacityTrack.SOCIAL_EXTENSION
              : CapacityTrack.PUBLIC_PRESENCE;
            if (!gentleDatingRepFallback) {
              patch.repIntent =
                "Show up in a gentle structured room without needing to perform.";
            }
          }
        }
        break;
      case "TOO_PUBLIC":
        patch.socialChallengeLevel = "none";
        setDifficultyRange([
          Math.min(patch.difficultyRange?.[0] ?? brief.difficultyRange[0], 4),
          Math.min(4, currentMaxDifficulty),
        ]);
        qualityPatches.push(TOO_PUBLIC_QUALITIES);
        patch.suggestedTiming =
          "off-peak weekday late morning or early afternoon";
        break;
      case "TOO_MUCH_EFFORT":
        setDifficultyRange([1, Math.min(3, currentMaxDifficulty)]);
        patch.socialChallengeLevel = "none";
        qualityPatches.push(TOO_MUCH_EFFORT_QUALITIES);
        break;
      case "TOO_SOCIAL":
        patch.socialChallengeLevel = "none";
        break;
      case "NOT_MY_VIBE":
        if (last.venueCategory) avoidCategories.add(last.venueCategory);
        break;
      case "BAD_TIMING":
        qualityPatches.push(BAD_TIMING_QUALITIES);
        patch.suggestedTiming =
          "flexible walk-in window; avoid fixed-time events";
        break;
    }
    logLines.push(`[multi-agent] Fresh-rejection policy (${last.reason})`);
  }

  if (avoidCategories.size > 0) {
    patch.avoidCategories = [...avoidCategories];
  }
  if (qualityPatches.length > 0) {
    const merged = mergeQualityProfiles(brief.venueQualities, ...qualityPatches);
    patch.venueQualities = merged;
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
  if (patch.datingRepShape !== undefined)
    brief.datingRepShape = patch.datingRepShape;
  if (patch.allowDirectDatingRep !== undefined)
    brief.allowDirectDatingRep = patch.allowDirectDatingRep;
  if (patch.preferredDatingRepShapes !== undefined)
    brief.preferredDatingRepShapes = patch.preferredDatingRepShapes;
  if ("preferredVenue" in patch) brief.preferredVenue = patch.preferredVenue;
  if (patch.venueQualities !== undefined) brief.venueQualities = patch.venueQualities;
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
