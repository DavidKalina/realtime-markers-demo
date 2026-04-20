import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
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

function escapedRegex(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
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
