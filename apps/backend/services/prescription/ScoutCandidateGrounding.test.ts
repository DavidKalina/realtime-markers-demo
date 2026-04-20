import { describe, expect, test } from "bun:test";
import { CapacityTrack } from "../../entities/Sidequest";
import {
  categoryFromVerifiedVenue,
  fallbackCandidatesFromVenues,
  normalizeVenueCategory,
  rankScoutCandidates,
} from "./ScoutCandidateGrounding";
import type { ScoutCandidate, StrategyBrief } from "./PrescriptionStrategy";

function brief(overrides: Partial<StrategyBrief> = {}): StrategyBrief {
  return {
    capacityTrack: CapacityTrack.PUBLIC_PRESENCE,
    repIntent: "Enter a structured room.",
    experienceType: "beginner art workshop",
    suggestedCategories: ["Art Studio / Workshop"],
    targetCity: "Longmont",
    maxDistanceMiles: 18,
    difficultyRange: [3, 6],
    socialChallengeLevel: "low",
    searchQueries: ["art workshop Longmont"],
    avoidVenues: [],
    avoidCategories: [],
    suggestedTiming: "weekend afternoon",
    rationale: "A class-like room gives structure and repeated faces.",
    ...overrides,
  };
}

function candidate(overrides: Partial<ScoutCandidate>): ScoutCandidate {
  return {
    venueName: "Test Place",
    venueAddress: "1 Main St",
    venueCategory: "Other",
    latitude: 40,
    longitude: -105,
    distanceFromHome: 5,
    source: "search_places",
    ...overrides,
  };
}

describe("ScoutCandidateGrounding", () => {
  test("normalizes Google place types to canonical venue categories", () => {
    expect(normalizeVenueCategory("art_gallery tourist_attraction")).toBe(
      "Art Gallery",
    );
    expect(normalizeVenueCategory("gym fitness_center")).toBe(
      "Gym / Fitness Studio",
    );
  });

  test("uses Google venue metadata before fallback text", () => {
    const category = categoryFromVerifiedVenue(
      {
        name: "Local Gallery",
        address: "1 Art St",
        placeId: "p1",
        coordinates: [-105, 40],
        primaryType: "art_gallery",
        types: ["tourist_attraction"],
      } as any,
      "coffee",
    );
    expect(category).toBe("Art Gallery");
  });

  test("ranks structured-fit candidates over spiritually wrong retail fallback", () => {
    const ranked = rankScoutCandidates(
      [
        candidate({
          venueName: "Liquor Stop",
          venueCategory: "Specialty Shop",
          distanceFromHome: 1,
          rating: 4.8,
        }),
        candidate({
          venueName: "Ceramics Studio",
          venueCategory: "Art Studio / Workshop",
          distanceFromHome: 8,
          rating: 4.2,
        }),
      ],
      brief(),
    );
    expect(ranked[0].venueName).toBe("Ceramics Studio");
  });

  test("builds deterministic fallback candidates from verified venues", () => {
    const candidates = fallbackCandidatesFromVenues({
      venues: [
        {
          name: "Movement Studio",
          address: "2 Fit St",
          placeId: "p2",
          coordinates: [-105, 40],
          primaryType: "gym",
          types: ["fitness_center"],
          rating: 4.6,
        } as any,
      ],
      ctx: { homeLat: 40, homeLng: -105 } as any,
      brief: brief({
        experienceType: "fitness class",
        suggestedCategories: ["Gym / Fitness Studio"],
      }),
      notes: "Verified fallback.",
    });
    expect(candidates[0].venueCategory).toBe("Gym / Fitness Studio");
    expect(candidates[0].source).toBe("search_places");
  });
});
