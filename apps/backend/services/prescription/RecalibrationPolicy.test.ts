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
    experienceType: "coffee",
    suggestedCategories: ["Coffee Shop"],
    targetCity: "Longmont",
    maxDistanceMiles: 18,
    difficultyRange: [4, 7],
    socialChallengeLevel: "medium",
    searchQueries: ["coffee Longmont"],
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

  test("TOO_FAR routes search home but leaves distance to DistancePolicy", () => {
    const decision = resolveRecalibrationPolicy({
      brief: brief(),
      ctx: ctx({ lastRejection: { reason: "TOO_FAR" } }),
      homeCity: "Frederick",
    });
    expect(decision.patch.targetCity).toBe("Frederick");
    expect(decision.patch.searchQueries).toEqual(["Coffee Shop Frederick"]);
    expect(
      (decision.patch as StrategyBriefPatch & { maxDistanceMiles?: number })
        .maxDistanceMiles,
    ).toBeUndefined();
  });

  test("NEED_GENTLER lowers effort and interaction first", () => {
    const decision = resolveRecalibrationPolicy({
      brief: brief(),
      ctx: ctx({ lastRejection: { reason: "NEED_GENTLER" } }),
      homeCity: "Frederick",
    });
    expect(decision.patch.socialChallengeLevel).toBe("none");
    expect(decision.patch.difficultyRange).toEqual([1, 3]);
    expect(decision.patch.capacityTrack).toBe(CapacityTrack.ACTIVATION);
    expect(decision.patch.targetCity).toBe("Frederick");
    expect(decision.patch.suggestedCategories).toEqual([
      "Coffee Shop",
      "Library",
      "Trail / Park",
    ]);
    expect(decision.patch.searchQueries).toEqual([
      "coffee shop Frederick",
      "library Frederick",
      "park Frederick",
    ]);
  });

  test("applies gentle local category patch", () => {
    const b = brief();
    applyStrategyBriefPatch(b, {
      experienceType: "gentle local reset",
      suggestedCategories: ["Coffee Shop", "Library", "Trail / Park"],
      searchQueries: [
        "coffee shop Frederick",
        "library Frederick",
        "park Frederick",
      ],
      targetCity: "Frederick",
      preferredVenue: undefined,
    });
    expect(b.experienceType).toBe("gentle local reset");
    expect(b.suggestedCategories).toEqual([
      "Coffee Shop",
      "Library",
      "Trail / Park",
    ]);
    expect(b.searchQueries).toEqual([
      "coffee shop Frederick",
      "library Frederick",
      "park Frederick",
    ]);
    expect(b.targetCity).toBe("Frederick");
  });

  test("applies avoid categories without duplicates", () => {
    const b = brief({ avoidCategories: ["Bar"] });
    applyStrategyBriefPatch(b, {
      avoidCategories: ["Bar", "Brewery / Taproom"],
    });
    expect(b.avoidCategories).toEqual(["Bar", "Brewery / Taproom"]);
  });
});
