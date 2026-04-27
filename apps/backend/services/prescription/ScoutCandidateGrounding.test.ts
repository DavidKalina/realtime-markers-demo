import { describe, expect, test } from "bun:test";
import { CapacityTrack } from "../../entities/Sidequest";
import {
  categoryFromVerifiedVenue,
  disallowedSocialVenueReason,
  fallbackCandidatesFromVenues,
  isDisallowedSocialVenue,
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

  test("uses Google primaryType before secondary type bag", () => {
    const category = categoryFromVerifiedVenue(
      {
        name: "MeCo Coffee Collective",
        address: "318 Fifth St",
        placeId: "p-coffee",
        coordinates: [-104.98, 40.1],
        primaryType: "cafe",
        primaryTypeDisplayName: "Cafe",
        types: ["bar", "food", "point_of_interest", "establishment"],
      } as any,
      "bar social room",
    );
    expect(category).toBe("Coffee Shop");
  });

  test("falls back to secondary Google types when primary type is generic", () => {
    const category = categoryFromVerifiedVenue(
      {
        name: "Local Yoga",
        address: "2 Main St",
        placeId: "p-yoga",
        coordinates: [-104.98, 40.1],
        primaryType: "establishment",
        types: ["yoga_studio", "fitness_center"],
      } as any,
      "workshop",
    );
    expect(category).toBe("Yoga / Pilates Studio");
  });

  test("flags personal-service venues from Google Places metadata", () => {
    expect(
      disallowedSocialVenueReason({
        name: "Creative Minds Barbershop",
        address: "10 Main St",
        placeId: "p-barber",
        coordinates: [-104.98, 40.1],
        primaryType: "barber_shop",
        types: ["hair_care", "establishment"],
      } as any),
    ).toContain("personal-service");
  });

  test("flags personal-service venues from name even when Google type is generic", () => {
    expect(
      isDisallowedSocialVenue({
        name: "Creative Minds Barbershop",
        address: "10 Main St",
        placeId: "p-barber",
        coordinates: [-104.98, 40.1],
        primaryType: "establishment",
        types: ["point_of_interest"],
      } as any),
    ).toBe(true);
  });

  test("scoring stays category-neutral — close+rated wins on a tie", () => {
    // The scorer no longer awards a +280 category-position bonus, so a closer
    // well-rated venue beats a farther one when no avoid signal applies.
    // Category-aware re-ranking happens later via classifyCandidateQualities.
    const ranked = rankScoutCandidates(
      [
        candidate({
          venueName: "Nearest Cafe",
          venueCategory: "Coffee Shop",
          distanceFromHome: 1,
          rating: 4.8,
        }),
        candidate({
          venueName: "Far Studio",
          venueCategory: "Art Studio / Workshop",
          distanceFromHome: 7,
          rating: 4.2,
        }),
      ],
      brief({ experienceType: "easy public outing" }),
    );
    expect(ranked[0].venueName).toBe("Nearest Cafe");
  });

  test("penalizes avoided categories even when they are close", () => {
    const ranked = rankScoutCandidates(
      [
        candidate({
          venueName: "Nearest Coffee",
          venueCategory: "Coffee Shop",
          distanceFromHome: 1,
          rating: 4.8,
        }),
        candidate({
          venueName: "Small Museum",
          venueCategory: "Museum",
          distanceFromHome: 6,
          rating: 4.1,
        }),
      ],
      brief({
        experienceType: "quiet public room",
        suggestedCategories: ["Museum", "Coffee Shop"],
        avoidCategories: ["Coffee Shop"],
      }),
    );
    expect(ranked[0].venueName).toBe("Small Museum");
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

  test("drops disallowed personal-service venues from deterministic fallbacks", () => {
    const candidates = fallbackCandidatesFromVenues({
      venues: [
        {
          name: "Creative Minds Barbershop",
          address: "10 Main St",
          placeId: "p-barber",
          coordinates: [-105, 40],
          primaryType: "barber_shop",
          types: ["hair_care"],
          rating: 4.9,
        } as any,
        {
          name: "Local Cafe",
          address: "1 Main St",
          placeId: "p-cafe",
          coordinates: [-105, 40],
          primaryType: "cafe",
          types: ["food"],
          rating: 4.3,
        } as any,
      ],
      ctx: { homeLat: 40, homeLng: -105 } as any,
      brief: brief({
        experienceType: "low-pressure coffee",
        suggestedCategories: ["Coffee Shop"],
      }),
      notes: "Verified fallback.",
    });
    expect(candidates.map((c) => c.venueName)).toEqual(["Local Cafe"]);
  });
});
