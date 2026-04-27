import { describe, expect, test } from "bun:test";
import { CapacityTrack } from "../../entities/Sidequest";
import {
  applyStrategyBriefPatch,
  resolveRecalibrationPolicy,
  type StrategyBriefPatch,
} from "./RecalibrationPolicy";
import type { StrategyBrief } from "./PrescriptionStrategy";

function brief(overrides: Partial<StrategyBrief> = {}): StrategyBrief {
  return {
    capacityTrack: CapacityTrack.SOCIAL_EXTENSION,
    repIntent: "Practice a gentle social move.",
    experienceType: "dance social",
    suggestedCategories: ["Workshop / Class Venue"],
    targetCity: "Longmont",
    maxDistanceMiles: 18,
    difficultyRange: [4, 7],
    socialChallengeLevel: "medium",
    searchQueries: ["partner dance social near Longmont"],
    avoidVenues: [],
    avoidCategories: [],
    suggestedTiming: "busy evening",
    rationale: "Practice being visible.",
    ...overrides,
  };
}

function ctx(overrides: Record<string, unknown> = {}) {
  return {
    isEarlyCalibration: false,
    lastRejection: null,
    rejectionPattern: null,
    journeyPhase: { fallbackLane: "open" },
    questRole: "stretch",
    ...overrides,
  } as any;
}

describe("resolveRecalibrationPolicy", () => {
  test("early calibration lowers social load without touching distance", () => {
    const b = brief({
      maxDistanceMiles: 18,
      socialChallengeLevel: "high",
      difficultyRange: [4, 8],
    });
    const decision = resolveRecalibrationPolicy({
      brief: b,
      ctx: ctx({ isEarlyCalibration: true }),
      homeCity: "Frederick",
    });
    expect(decision.patch.socialChallengeLevel).toBe("low");
    expect(decision.patch.difficultyRange).toEqual([4, 5]);
    expect(
      (decision.patch as StrategyBriefPatch & { maxDistanceMiles?: number })
        .maxDistanceMiles,
    ).toBeUndefined();
  });

  test("TOO_FAR rebuilds local queries from existing brief categories without prescribing new ones", () => {
    const decision = resolveRecalibrationPolicy({
      brief: brief({
        experienceType: "dance social",
        suggestedCategories: ["Workshop / Class Venue"],
        searchQueries: ["partner dance social near Longmont"],
      }),
      ctx: ctx({ lastRejection: { reason: "TOO_FAR" } }),
      homeCity: "Frederick",
    });
    expect(decision.patch.targetCity).toBeUndefined();
    expect(decision.patch.suggestedCategories).toBeUndefined();
    // Search queries fall back to whatever categories the LLM already picked.
    expect(decision.patch.searchQueries).toEqual([
      "Workshop / Class Venue near Frederick",
    ]);
  });

  test("NEED_GENTLER softens the brief via qualities and difficulty, not categories", () => {
    const decision = resolveRecalibrationPolicy({
      brief: brief({
        capacityTrack: CapacityTrack.SOCIAL_EXTENSION,
        experienceType: "dance social",
        suggestedCategories: ["Workshop / Class Venue"],
        searchQueries: ["partner dance social near Longmont"],
        datingRepShape: "send_specific_invite",
        allowDirectDatingRep: true,
      }),
      ctx: ctx({
        lastRejection: {
          reason: "NEED_GENTLER",
          venueCategory: "Workshop / Class Venue",
        },
      }),
      homeCity: "Frederick",
    });
    expect(decision.patch.socialChallengeLevel).toBe("none");
    expect(decision.patch.difficultyRange).toEqual([1, 3]);
    expect(decision.patch.capacityTrack).toBe(CapacityTrack.SOCIAL_EXTENSION);
    expect(decision.patch.datingRepShape).toBe("draft_message");
    expect(decision.patch.allowDirectDatingRep).toBe(false);
    expect(decision.patch.experienceType).toContain("drafting");
    expect(decision.patch.venueQualities?.must).toContain("drop-in-friendly");
    expect(decision.patch.venueQualities?.avoid).toContain("loud-lively");
    // No category prescription — qualities express the gentleness instead.
    expect(decision.patch.suggestedCategories).toBeUndefined();
  });

  test("NEED_GENTLER without dating context patches qualities and difficulty only", () => {
    const decision = resolveRecalibrationPolicy({
      brief: brief({
        capacityTrack: CapacityTrack.SOCIAL_EXTENSION,
        experienceType: "coffee",
        suggestedCategories: ["Coffee Shop"],
        searchQueries: ["coffee near Longmont"],
      }),
      ctx: ctx({ lastRejection: { reason: "NEED_GENTLER" } }),
      homeCity: "Frederick",
    });
    expect(decision.patch.capacityTrack).toBe(CapacityTrack.ACTIVATION);
    expect(decision.patch.experienceType).toBe("gentle local reset");
    expect(decision.patch.suggestedCategories).toBeUndefined();
    expect(decision.patch.searchQueries).toBeUndefined();
    expect(decision.patch.venueQualities?.must).toContain("low-social-pressure");
  });

  test("TOO_PUBLIC patches qualities to avoid loud/people-rich rooms", () => {
    const decision = resolveRecalibrationPolicy({
      brief: brief(),
      ctx: ctx({ lastRejection: { reason: "TOO_PUBLIC" } }),
      homeCity: "Frederick",
    });
    expect(decision.patch.socialChallengeLevel).toBe("none");
    expect(decision.patch.venueQualities?.avoid).toContain("loud-lively");
    expect(decision.patch.venueQualities?.avoid).toContain("people-rich");
    // No hardcoded DENSE_PUBLIC_CATEGORIES write-in.
    expect(decision.patch.avoidCategories).toBeUndefined();
  });

  test("BAD_TIMING patches qualities to avoid time-bounded rooms", () => {
    const decision = resolveRecalibrationPolicy({
      brief: brief(),
      ctx: ctx({ lastRejection: { reason: "BAD_TIMING" } }),
      homeCity: "Frederick",
    });
    expect(decision.patch.venueQualities?.avoid).toContain("time-bounded");
    expect(decision.patch.suggestedTiming).toContain("flexible walk-in");
    expect(decision.patch.avoidCategories).toBeUndefined();
  });

  test("applies patch fields onto the brief", () => {
    const b = brief();
    applyStrategyBriefPatch(b, {
      experienceType: "gentle local reset",
      venueQualities: {
        must: ["drop-in-friendly", "low-social-pressure"],
        prefer: [],
        avoid: ["loud-lively"],
      },
      preferredVenue: undefined,
    });
    expect(b.experienceType).toBe("gentle local reset");
    expect(b.venueQualities?.must).toContain("drop-in-friendly");
    expect(b.venueQualities?.avoid).toContain("loud-lively");
  });

  test("applies avoid categories without duplicates", () => {
    const b = brief({ avoidCategories: ["Bar"] });
    applyStrategyBriefPatch(b, {
      avoidCategories: ["Bar", "Brewery / Taproom"],
    });
    expect(b.avoidCategories).toEqual(["Bar", "Brewery / Taproom"]);
  });
});
