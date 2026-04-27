import { CapacityTrack } from "../../entities/Sidequest";
import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
import {
  classifyJourneyCategoryFamily,
  isSafeRepeatableFamily,
  type JourneyCategoryFamily,
} from "./JourneyDiversityContext";
import {
  VENUE_CATEGORIES,
  type ScoutCandidate,
  type StrategyBrief,
} from "./PrescriptionStrategy";
import {
  disallowedSocialVenueReason,
  haversineMiles,
  normalizeVenueCategory,
  rankScoutCandidates,
} from "./ScoutCandidateGrounding";

const RETURNABILITY_TRACKS = new Set<CapacityTrack>([
  CapacityTrack.RETURNABILITY,
  CapacityTrack.RECOVERY,
]);

function buildRecentVenueCounts(
  ctx: PrescriptionPromptContext,
): Map<string, number> {
  const counts = new Map<string, number>();
  const names = ctx.journeyDiversity?.recentVenueNames ?? [];
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function venueAllowsRepeat(
  brief: StrategyBrief,
  candidateNameLower: string,
): boolean {
  if (brief.preferredVenue && brief.preferredVenue.toLowerCase() === candidateNameLower) {
    return true;
  }
  return RETURNABILITY_TRACKS.has(brief.capacityTrack);
}

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
  fallbackWinner?: ScoutCandidate;
  fallbackReason?: string;
  fallbackRejectionCodes?: CandidateRejectionCode[];
}

interface WeakFallbackCandidate {
  candidate: ScoutCandidate;
  rejectionCodes: CandidateRejectionCode[];
  humanReasons: string[];
  penalty: number;
}

// Families that count as "structured floor" eligible — derived from the
// shared family classifier rather than a separate hardcoded list.
const STRUCTURED_FLOOR_ELIGIBLE_FAMILIES = new Set<JourneyCategoryFamily>([
  "structured_social",
  "library_quiet",
  "community_room",
]);

const LATE_SAFE_ROOM_FAMILIES = new Set<JourneyCategoryFamily>([
  "library_quiet",
  "community_room",
]);

export function isStructuredFloorEligibleCategory(
  category: string | undefined | null,
): boolean {
  if (!category) return false;
  return STRUCTURED_FLOOR_ELIGIBLE_FAMILIES.has(
    classifyJourneyCategoryFamily(category),
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
  const weakFallbackCandidates: WeakFallbackCandidate[] = [];
  const historyLower = ctx.historyContext.toLowerCase();
  const justRejectedVenue = ctx.lastRejection?.venueName?.toLowerCase() ?? null;
  const recentVenueCounts = buildRecentVenueCounts(ctx);

  const reject = (code: CandidateRejectionCode, reason: string) => {
    rejectionCodes.push(code);
    humanReasons.push(reason);
  };

  const addWeakFallback = (
    candidate: ScoutCandidate,
    code: CandidateRejectionCode,
    reason: string,
    penalty: number,
  ) => {
    const candidateNameLower = candidate.venueName.toLowerCase();
    if (
      !candidate.venueName ||
      candidateNameLower.includes("unknown") ||
      candidateNameLower.includes("tbd") ||
      candidateNameLower.includes("no verified") ||
      (justRejectedVenue && candidateNameLower === justRejectedVenue)
    ) {
      return;
    }

    if (typeof candidate.distanceFromHome !== "number") {
      candidate.distanceFromHome = haversineMiles(
        ctx.homeLat,
        ctx.homeLng,
        candidate.latitude,
        candidate.longitude,
      );
    }

    const looseDistanceLimit = Math.max(
      brief.maxDistanceMiles + 1.5,
      brief.maxDistanceMiles * 1.35,
    );
    const distancePenalty =
      candidate.distanceFromHome > brief.maxDistanceMiles + 0.25 ? 8 : 0;
    if (candidate.distanceFromHome > looseDistanceLimit) return;

    if (
      historyLower.includes(`- "${candidateNameLower}"`) &&
      historyLower.includes("would not return")
    ) {
      return;
    }

    const recentVisitCount = recentVenueCounts.get(candidateNameLower) ?? 0;
    if (recentVisitCount > 0 && !venueAllowsRepeat(brief, candidateNameLower)) {
      return;
    }
    if (recentVisitCount > 3) return;

    weakFallbackCandidates.push({
      candidate,
      rejectionCodes: [code],
      humanReasons: [reason],
      penalty: penalty + distancePenalty,
    });
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

    const disallowedReason = disallowedSocialVenueReason(c);
    if (disallowedReason) {
      reject(
        "bad_category",
        `"${c.venueName}" was rejected: ${disallowedReason}`,
      );
      continue;
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

    const candidateFamily = classifyJourneyCategoryFamily(c.venueCategory);

    // TOO_PUBLIC / BAD_TIMING / coffee-family overuse are now expressed
    // via brief.venueQualities (RecalibrationPolicy). The classifyCandidateQualities
    // step in MultiAgentStrategy filters candidates whose qualities violate
    // those preferences before they reach this validator.

    if (
      ctx.questRole !== "enjoy" &&
      ctx.journeyDiversity &&
      candidateFamily === "coffee_family" &&
      (ctx.journeyDiversity.dominantRecentFamily === "coffee_family" ||
        recentFamilyCount(ctx, "coffee_family") >= 2)
    ) {
      const reason = `"${c.venueName}" is in the coffee-family fallback cluster, which is already overrepresented in the recent journey mix`;
      reject("bad_category", reason);
      addWeakFallback(c, "bad_category", reason, 4);
      continue;
    }
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
      const reason = `"${c.venueName}" stays in the ${candidateFamily} safe-room lane, which is already dominating the late journey`;
      reject("bad_category", reason);
      addWeakFallback(c, "bad_category", reason, 5);
      continue;
    }

    if (
      (latePhaseRequiresStructured ||
        ctx.journeyDiversity?.shouldForceStructuredNext) &&
      ctx.questRole !== "enjoy" &&
      !isStructuredFloorEligibleCategory(c.venueCategory)
    ) {
      const reason = `"${c.venueName}" is not a structured-enough room for the current late-journey floor`;
      reject("bad_category", reason);
      addWeakFallback(c, "bad_category", reason, 6);
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
      const reason = `"${c.venueName}" is in the ${candidateFamily} family, which is currently monopolizing the recent journey mix`;
      reject("bad_category", reason);
      addWeakFallback(c, "bad_category", reason, 7);
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
      // When the search anchor is redirected (weak home base), allow
      // candidates that are within range of the anchor even if they're
      // farther from the user's actual home. Without this, Longmont venues
      // get hard-rejected for being "too far from Frederick" right after
      // we explicitly moved the search to Longmont — pure self-defeat.
      const envelopeOrigin = brief.searchEnvelope?.originLatLng;
      const distFromAnchor = envelopeOrigin
        ? haversineMiles(
            envelopeOrigin.lat,
            envelopeOrigin.lng,
            c.latitude,
            c.longitude,
          )
        : distMiles;
      const effectiveDistance = Math.min(distMiles, distFromAnchor);
      if (effectiveDistance > brief.maxDistanceMiles + 0.25) {
        const reason = `"${c.venueName}" is ${effectiveDistance.toFixed(1)}mi from the active search anchor — outside the current ${brief.maxDistanceMiles.toFixed(1)}mi limit`;
        reject("too_far", reason);
        addWeakFallback(c, "too_far", reason, 9);
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

    const recentVisitCount = recentVenueCounts.get(nameLower) ?? 0;
    if (recentVisitCount > 0) {
      const allowsRepeat = venueAllowsRepeat(brief, nameLower);
      const repeatCap = allowsRepeat ? 3 : 0;
      if (recentVisitCount > repeatCap) {
        reject(
          "repeated_venue",
          `"${c.venueName}" appears ${recentVisitCount} time(s) in the last ${ctx.journeyDiversity?.recentVenueNames.length ?? 0} quests${allowsRepeat ? ` (returnability cap=${repeatCap + 1})` : " — pick a different venue"}`,
        );
        continue;
      }
    }

    validCandidates.push(c);
  }

  if (validCandidates.length === 0) {
    const fallback = selectWeakFallback(weakFallbackCandidates, brief);
    return {
      accepted: false,
      rejectionCodes: [...new Set(rejectionCodes)],
      humanReasons,
      retryConstraints: retryConstraintsFor({
        brief,
        humanReasons,
        rejectionCodes: [...new Set(rejectionCodes)],
      }),
      fallbackWinner: fallback
        ? {
            ...fallback.candidate,
            notes: [
              fallback.candidate.notes,
              `Weak fit fallback: strict validation failed (${fallback.humanReasons.join("; ")}), so keep the same capability as a gentler version.`,
            ]
              .filter(Boolean)
              .join(" "),
          }
        : undefined,
      fallbackReason: fallback?.humanReasons.join("; "),
      fallbackRejectionCodes: fallback
        ? [...new Set(fallback.rejectionCodes)]
        : undefined,
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

function selectWeakFallback(
  candidates: WeakFallbackCandidate[],
  brief: StrategyBrief,
): WeakFallbackCandidate | undefined {
  if (candidates.length === 0) return undefined;
  const ranked = rankScoutCandidates(
    candidates.map((entry) => entry.candidate),
    brief,
  );
  const rankIndex = new Map(
    ranked.map((candidate, index) => [
      candidate.venueName.toLowerCase(),
      index,
    ]),
  );
  return [...candidates].sort((a, b) => {
    const penaltyDelta = a.penalty - b.penalty;
    if (penaltyDelta !== 0) return penaltyDelta;
    return (
      (rankIndex.get(a.candidate.venueName.toLowerCase()) ?? 999) -
      (rankIndex.get(b.candidate.venueName.toLowerCase()) ?? 999)
    );
  })[0];
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
