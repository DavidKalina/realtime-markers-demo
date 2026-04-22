import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
import {
  classifyJourneyCategoryFamily,
  isSafeRepeatableFamily,
} from "./JourneyDiversityContext";
import {
  VENUE_CATEGORIES,
  type ScoutCandidate,
  type StrategyBrief,
} from "./PrescriptionStrategy";
import {
  DENSE_PUBLIC_CATEGORIES,
  FIXED_TIMING_CATEGORIES,
} from "./RecalibrationPolicy";
import {
  categoryMatches,
  haversineMiles,
  normalizeVenueCategory,
  rankScoutCandidates,
} from "./ScoutCandidateGrounding";

export type CandidateRejectionCode =
  | "too_far"
  | "bad_category"
  | "repeated_venue"
  | "not_real_venue"
  | "not_container_fit"
  | "wrong_city_basin"
  | "recently_rejected";

export interface CandidateValidationResult {
  accepted: boolean;
  winner?: ScoutCandidate;
  rejectionCodes: CandidateRejectionCode[];
  humanReasons: string[];
  retryConstraints?: string;
}

const COFFEE_FAMILY_CATEGORIES = new Set([
  "Coffee Shop",
  "Bookstore",
  "Brunch Spot",
  "Bakery / Dessert Shop",
]);

const LATE_SAFE_ROOM_FAMILIES = new Set(["library_quiet", "community_room"]);

const STRUCTURED_FLOOR_ELIGIBLE_CATEGORIES = new Set([
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

function isCoffeeFamilyCategory(category: string | undefined | null): boolean {
  if (!category) return false;
  return COFFEE_FAMILY_CATEGORIES.has(normalizeVenueCategory(category));
}

export function isStructuredFloorEligibleCategory(
  category: string | undefined | null,
): boolean {
  if (!category) return false;
  return STRUCTURED_FLOOR_ELIGIBLE_CATEGORIES.has(
    normalizeVenueCategory(category),
  );
}

function recentFamilyCount(
  ctx: PrescriptionPromptContext,
  family: ReturnType<typeof classifyJourneyCategoryFamily>,
): number {
  return (
    ctx.journeyDiversity?.recentFamilies
      ?.slice(0, 5)
      .filter((value) => value === family).length ?? 0
  );
}

function escapedRegex(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
}

function allowsGentleSafeRoomFallback(ctx: PrescriptionPromptContext): boolean {
  return ["TOO_PUBLIC", "NEED_GENTLER", "TOO_SOCIAL", "TOO_FAR"].includes(
    ctx.lastRejection?.reason ?? "",
  );
}

export function validateCandidates(input: {
  candidates: ScoutCandidate[];
  ctx: PrescriptionPromptContext;
  brief: StrategyBrief;
}): CandidateValidationResult {
  const { candidates, ctx, brief } = input;
  const humanReasons: string[] = [];
  const rejectionCodes: CandidateRejectionCode[] = [];
  const validCandidates: ScoutCandidate[] = [];
  const historyLower = ctx.historyContext.toLowerCase();
  const justRejectedVenue = ctx.lastRejection?.venueName?.toLowerCase() ?? null;

  const reject = (code: CandidateRejectionCode, reason: string) => {
    rejectionCodes.push(code);
    humanReasons.push(reason);
  };

  if (candidates.length === 0) {
    return {
      accepted: false,
      rejectionCodes: ["not_real_venue"],
      humanReasons: ["No candidates found"],
      retryConstraints:
        "No venues were found. Try broader search queries or a larger search radius.",
    };
  }

  for (const candidate of candidates) {
    const c = candidate;
    const nameLower = c.venueName.toLowerCase();

    if (
      !c.venueName ||
      nameLower.includes("unknown") ||
      nameLower.includes("tbd") ||
      nameLower.includes("no verified")
    ) {
      reject("not_real_venue", `"${c.venueName}" is not a real venue`);
      continue;
    }

    if (justRejectedVenue && nameLower === justRejectedVenue) {
      reject(
        "recently_rejected",
        `"${c.venueName}" was just rejected by the user — pick a different venue`,
      );
      continue;
    }

    if (c.venueCategory && !VENUE_CATEGORIES.includes(c.venueCategory as any)) {
      c.venueCategory = normalizeVenueCategory(c.venueCategory);
    }

    if (
      ctx.rejectionPattern?.reason === "NOT_MY_VIBE" &&
      ctx.rejectionPattern.categories.length > 0 &&
      c.venueCategory &&
      ctx.rejectionPattern.categories.some(
        (cat) => cat.toLowerCase() === c.venueCategory.toLowerCase(),
      )
    ) {
      reject(
        "bad_category",
        `"${c.venueName}" is in category "${c.venueCategory}" — user has a NOT_MY_VIBE pattern against this category (${ctx.rejectionPattern.count}× rejections)`,
      );
      continue;
    }

    if (
      ctx.rejectionPattern?.reason === "TOO_PUBLIC" &&
      categoryMatches(c.venueCategory, DENSE_PUBLIC_CATEGORIES)
    ) {
      reject(
        "bad_category",
        `"${c.venueName}" is in category "${c.venueCategory}" — user has a TOO_PUBLIC pattern and needs a lower-visibility setting`,
      );
      continue;
    }

    if (
      ctx.rejectionPattern?.reason === "BAD_TIMING" &&
      categoryMatches(c.venueCategory, FIXED_TIMING_CATEGORIES)
    ) {
      reject(
        "bad_category",
        `"${c.venueName}" is in category "${c.venueCategory}" — user has a BAD_TIMING pattern, so avoid fixed-time events for now`,
      );
      continue;
    }

    if (
      ctx.questRole !== "enjoy" &&
      (ctx.completedQuestCount ?? 0) >= 5 &&
      ctx.journeyDiversity &&
      isCoffeeFamilyCategory(c.venueCategory) &&
      (ctx.journeyDiversity.dominantRecentCategory === "Coffee Shop" ||
        ctx.journeyDiversity.recentCategories
          .slice(0, 5)
          .filter((category) => isCoffeeFamilyCategory(category)).length >= 2)
    ) {
      reject(
        "bad_category",
        `"${c.venueName}" is in the coffee-family fallback cluster, which is already overrepresented in the recent journey mix`,
      );
      continue;
    }

    const candidateFamily = classifyJourneyCategoryFamily(c.venueCategory);
    const latePhaseRequiresStructured =
      ctx.questRole !== "enjoy" &&
      ctx.journeyPhase?.requireStructuredNonEnjoy === true;
    const latePhaseForbidsPark =
      ctx.questRole !== "enjoy" &&
      ctx.journeyPhase?.forbidParkForNonEnjoy === true;

    if (latePhaseForbidsPark && candidateFamily === "park_outdoor") {
      reject(
        "bad_category",
        `"${c.venueName}" is a park/outdoor reset, which does not count as progression in the current ${ctx.journeyPhase?.phase ?? "late"} phase`,
      );
      continue;
    }

    if (
      ctx.questRole !== "enjoy" &&
      [
        "goal_closure_due",
        "post_breakthrough_consolidation",
        "late_world_building",
      ].includes(ctx.journeyPhase?.phase ?? "") &&
      LATE_SAFE_ROOM_FAMILIES.has(candidateFamily) &&
      recentFamilyCount(ctx, candidateFamily) >= 2 &&
      !allowsGentleSafeRoomFallback(ctx)
    ) {
      reject(
        "bad_category",
        `"${c.venueName}" stays in the ${candidateFamily} safe-room lane, which is already dominating the late journey`,
      );
      continue;
    }

    if (
      (latePhaseRequiresStructured ||
        ctx.journeyDiversity?.shouldForceStructuredNext) &&
      ctx.questRole !== "enjoy" &&
      !isStructuredFloorEligibleCategory(c.venueCategory)
    ) {
      reject(
        "bad_category",
        `"${c.venueName}" is not a structured-enough room for the current late-journey floor`,
      );
      continue;
    }

    if (
      ctx.questRole !== "enjoy" &&
      ctx.journeyDiversity?.postGoalClosureWindow &&
      candidateFamily === "park_outdoor" &&
      recentFamilyCount(ctx, "park_outdoor") >= 2 &&
      !["TOO_PUBLIC", "NEED_GENTLER", "TOO_SOCIAL"].includes(
        ctx.lastRejection?.reason ?? "",
      )
    ) {
      reject(
        "bad_category",
        `"${c.venueName}" is another park-family reset after a goal-closing rep — keep building the social world instead`,
      );
      continue;
    }

    if (
      ctx.questRole !== "enjoy" &&
      (ctx.completedQuestCount ?? 0) >= 8 &&
      ctx.journeyDiversity &&
      isSafeRepeatableFamily(ctx.journeyDiversity.dominantRecentFamily) &&
      ctx.journeyDiversity.dominantRecentFamily === candidateFamily &&
      recentFamilyCount(ctx, candidateFamily) >= 3 &&
      ctx.activeGoalMilestone?.goalClosureDue !== true
    ) {
      reject(
        "bad_category",
        `"${c.venueName}" is in the ${candidateFamily} family, which is currently monopolizing the recent journey mix`,
      );
      continue;
    }

    if (typeof c.latitude === "number" && typeof c.longitude === "number") {
      const distMiles = haversineMiles(
        ctx.homeLat,
        ctx.homeLng,
        c.latitude,
        c.longitude,
      );
      c.distanceFromHome = distMiles;
      if (distMiles > brief.maxDistanceMiles + 0.25) {
        reject(
          "too_far",
          `"${c.venueName}" is ${distMiles.toFixed(1)}mi away — outside the current ${brief.maxDistanceMiles.toFixed(1)}mi strategy limit`,
        );
        continue;
      }
    }

    if (
      historyLower.includes(`- "${nameLower}"`) &&
      historyLower.includes("would not return")
    ) {
      const inBlocklist =
        historyLower.includes(`- "${nameLower}" (`) &&
        historyLower.indexOf(`- "${nameLower}" (`) >
          historyLower.indexOf("would not return");
      if (inBlocklist) {
        reject(
          "recently_rejected",
          `"${c.venueName}" — user said they would NOT return`,
        );
        continue;
      }
    }

    const venueCount = (historyLower.match(escapedRegex(nameLower)) || [])
      .length;
    const isDfsAnchor = historyLower.includes(`✅ "${nameLower}"`);
    const repeatCap = isDfsAnchor ? 8 : 5;
    if (venueCount >= repeatCap) {
      reject(
        "repeated_venue",
        `"${c.venueName}" appears ${venueCount} times in history — too many repeats${isDfsAnchor ? " (even for a DFS anchor)" : ""}`,
      );
      continue;
    }

    validCandidates.push(c);
  }

  if (validCandidates.length === 0) {
    return {
      accepted: false,
      rejectionCodes: [...new Set(rejectionCodes)],
      humanReasons,
      retryConstraints: retryConstraintsFor({
        brief,
        humanReasons,
        rejectionCodes: [...new Set(rejectionCodes)],
      }),
    };
  }

  return {
    accepted: true,
    winner:
      ctx.lastRejection?.reason === "TOO_FAR" ||
      ctx.rejectionPattern?.reason === "TOO_FAR"
        ? [...validCandidates].sort(
            (a, b) =>
              (a.distanceFromHome ?? Infinity) -
              (b.distanceFromHome ?? Infinity),
          )[0]
        : rankScoutCandidates(validCandidates, brief)[0],
    rejectionCodes: [],
    humanReasons: [],
  };
}

function retryConstraintsFor(input: {
  brief: StrategyBrief;
  humanReasons: string[];
  rejectionCodes: CandidateRejectionCode[];
}): string {
  const { brief, humanReasons, rejectionCodes } = input;
  const constraints = [
    `Previous candidates were rejected: ${humanReasons.join("; ")}.`,
  ];

  if (rejectionCodes.includes("too_far")) {
    constraints.push(
      `Stay within ${brief.maxDistanceMiles.toFixed(1)} miles from the user's home. Do not retry venues outside that strategy limit.`,
    );
  }
  if (rejectionCodes.includes("bad_category")) {
    constraints.push(
      "Use a different venue category that still supports the same rep.",
    );
  }
  if (
    rejectionCodes.includes("recently_rejected") ||
    rejectionCodes.includes("repeated_venue")
  ) {
    constraints.push(
      "Find different venues — no repeats and no just-rejected venues.",
    );
  }
  if (rejectionCodes.includes("not_real_venue")) {
    constraints.push(
      "Only submit verified real venues with real names and addresses.",
    );
  }

  return constraints.join(" ");
}
