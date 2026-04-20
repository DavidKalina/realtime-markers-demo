import { describe, expect, test } from "bun:test";
import { CapacityTrack } from "../../entities/Sidequest";
import { validateCandidates } from "./CandidateValidator";
import type { ScoutCandidate, StrategyBrief } from "./PrescriptionStrategy";

function brief(overrides: Partial<StrategyBrief> = {}): StrategyBrief {
  return {
    capacityTrack: CapacityTrack.PUBLIC_PRESENCE,
    repIntent: "Be visible somewhere low pressure.",
    experienceType: "coffee",
    suggestedCategories: ["Coffee Shop"],
    targetCity: "Frederick",
    maxDistanceMiles: 4,
    difficultyRange: [1, 3],
    socialChallengeLevel: "low",
    searchQueries: ["coffee Frederick"],
    avoidVenues: [],
    avoidCategories: [],
    suggestedTiming: "weekday morning",
    rationale: "Stay near home.",
    ...overrides,
  };
}

function ctx(overrides: Record<string, unknown> = {}) {
  return {
    homeLat: 40,
    homeLng: -105,
    historyContext: "",
    lastRejection: null,
    rejectionPattern: null,
    ...overrides,
  } as any;
}

function candidate(overrides: Partial<ScoutCandidate> = {}): ScoutCandidate {
  return {
    venueName: "Local Cafe",
    venueAddress: "1 Main St",
    venueCategory: "Coffee Shop",
    latitude: 40.01,
    longitude: -105.01,
    source: "search_places",
    ...overrides,
  };
}

describe("validateCandidates", () => {
  test("accepts a valid nearby candidate", () => {
    const result = validateCandidates({
      candidates: [candidate()],
      ctx: ctx(),
      brief: brief(),
    });
    expect(result.accepted).toBe(true);
    expect(result.winner?.venueName).toBe("Local Cafe");
  });

  test("rejects distance with structured too_far code", () => {
    const result = validateCandidates({
      candidates: [
        candidate({ venueName: "Far Cafe", latitude: 40.5, longitude: -105.5 }),
      ],
      ctx: ctx(),
      brief: brief({ maxDistanceMiles: 2 }),
    });
    expect(result.accepted).toBe(false);
    expect(result.rejectionCodes).toContain("too_far");
    expect(result.retryConstraints).toContain("2.0 miles");
  });

  test("rejects a just-rejected venue with recently_rejected code", () => {
    const result = validateCandidates({
      candidates: [candidate()],
      ctx: ctx({ lastRejection: { venueName: "Local Cafe" } }),
      brief: brief(),
    });
    expect(result.accepted).toBe(false);
    expect(result.rejectionCodes).toContain("recently_rejected");
  });

  test("rejects bad recurring category without parsing human text", () => {
    const result = validateCandidates({
      candidates: [candidate({ venueName: "Busy Bar", venueCategory: "Bar" })],
      ctx: ctx({
        rejectionPattern: { reason: "TOO_PUBLIC", count: 3, categories: [] },
      }),
      brief: brief(),
    });
    expect(result.accepted).toBe(false);
    expect(result.rejectionCodes).toContain("bad_category");
  });
});
