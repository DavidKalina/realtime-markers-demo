import { describe, expect, test } from "bun:test";
import {
  analyzeOpportunityZones,
  applyOpportunityZonePolicy,
} from "./OpportunityZonePolicy";
import { CapacityTrack } from "../../entities/Sidequest";
import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
import type { StrategyBrief } from "./PrescriptionStrategy";

function makeBrief(overrides: Partial<StrategyBrief> = {}): StrategyBrief {
  return {
    capacityTrack: CapacityTrack.SOCIAL_EXTENSION,
    repIntent: "Join a room with real social potential",
    experienceType: "structured social room",
    suggestedCategories: ["Community Center", "Workshop / Class Venue"],
    targetCity: "Frederick, CO",
    maxDistanceMiles: 8,
    difficultyRange: [3, 6],
    socialChallengeLevel: "low",
    searchQueries: [
      "community class Frederick CO",
      "adult workshop Frederick CO",
    ],
    avoidVenues: [],
    avoidCategories: [],
    suggestedTiming: "weekday evening after 6pm",
    rationale: "Stay gentle, but move toward real social opportunity.",
    ...overrides,
  };
}

function makePromptContext(
  overrides: Partial<PrescriptionPromptContext> = {},
): PrescriptionPromptContext {
  return {
    user: {
      comfortProfile: null,
      onboardingProfile: null,
      pacePreference: null,
      reachMode: null,
      fearLadder: null,
      expectancyCalibration: null,
      socialSituation: null,
    },
    homeLat: 40.1,
    homeLng: -105,
    searchLat: 40.1,
    searchLng: -105,
    city: "Frederick, CO",
    homeCity: "Frederick, CO",
    isAwayFromHome: false,
    distFromHome: 0,
    radius: 8,
    pace: "steady",
    hour: 18,
    dayOfWeek: "Tuesday",
    historyContext: "",
    coverageContext: "",
    explorationProfileLabel: "",
    expansionTarget: "",
    phaseContext: "",
    timelineContext: "",
    fearLadderContext: "",
    expectancyContext: "",
    difficultyGuidance: "",
    siblingInstructions: "",
    blockerContext: "",
    socialMicroRepContext: "",
    socialSituationContext: "",
    offlineSocialFrameworkContext: "",
    offlineSocialFrameworkPlan: null,
    opportunityZoneContext: "",
    opportunityZones: null,
    journeyPhaseContext: "",
    journeyPhase: null,
    journeyDiversityContext: "",
    journeyDiversity: null,
    goalMilestoneContext: "",
    activeGoalMilestone: null,
    goalTags: ["dating"],
    questRole: "explore",
    isStretch: false,
    isEnjoy: false,
    siblingContext: null,
    ...overrides,
  };
}

describe("analyzeOpportunityZones", () => {
  test("keeps home base during early calibration even when viability is weak", () => {
    const analysis = analyzeOpportunityZones({
      homeCity: "Frederick, CO",
      nearbyCities: [
        {
          name: "Longmont, CO",
          lat: 40.16,
          lng: -105.1,
          population: 98700,
          distanceMeters: 18000,
        },
      ],
      goalTags: ["dating"],
      completedQuestCount: 1,
      isEarlyCalibration: true,
      journeyPhase: "calibration",
    });

    // Honest viability label — Frederick is sparse for a dating goal even on
    // quest 1. But during early calibration we still recommend home as the
    // safe trust zone, so the search-anchor redirect won't fire.
    expect(analysis.homeBaseViability).toBe("weak");
    expect(analysis.recommendedCity).toBe("Frederick, CO");
  });

  test("classifies sparse home as weak from quest 1 (no 5-quest gate)", () => {
    const analysis = analyzeOpportunityZones({
      homeCity: "Frederick, CO",
      nearbyCities: [
        {
          name: "Longmont, CO",
          lat: 40.16,
          lng: -105.1,
          population: 98700,
          distanceMeters: 18000,
        },
      ],
      goalTags: ["dating"],
      completedQuestCount: 0,
      isEarlyCalibration: false,
      journeyPhase: "calibration",
    });

    expect(analysis.homeBaseViability).toBe("weak");
    expect(analysis.recommendedCity).toBe("Longmont, CO");
  });

  test("penalizes far cities past the 25-mile knee even when population is huge", () => {
    const analysis = analyzeOpportunityZones({
      homeCity: "Frederick, CO",
      nearbyCities: [
        {
          name: "Longmont, CO",
          lat: 40.16,
          lng: -105.1,
          population: 98700,
          distanceMeters: 18000, // ~11 mi
        },
        {
          name: "Denver, CO",
          lat: 39.74,
          lng: -104.99,
          population: 720000,
          distanceMeters: 80000, // ~50 mi
        },
      ],
      goalTags: ["dating"],
      completedQuestCount: 5,
      isEarlyCalibration: false,
      journeyPhase: "calibration",
    });

    // Longmont (11mi) should outrank Denver (50mi) despite Denver's larger pop.
    expect(analysis.recommendedCity).toBe("Longmont, CO");
    const denverZone = analysis.zones.find((z) => z.city === "Denver, CO");
    const longmontZone = analysis.zones.find((z) => z.city === "Longmont, CO");
    expect(longmontZone!.opportunityScore).toBeGreaterThan(
      denverZone!.opportunityScore,
    );
  });

  test("prefers a stronger nearby city once a sparse home base is limiting growth", () => {
    const analysis = analyzeOpportunityZones({
      homeCity: "Frederick, CO",
      nearbyCities: [
        {
          name: "Firestone, CO",
          lat: 40.12,
          lng: -104.95,
          population: 17000,
          distanceMeters: 5000,
        },
        {
          name: "Longmont, CO",
          lat: 40.16,
          lng: -105.1,
          population: 98700,
          distanceMeters: 18500,
        },
        {
          name: "Boulder, CO",
          lat: 40.01,
          lng: -105.27,
          population: 108000,
          distanceMeters: 36000,
        },
      ],
      goalTags: ["dating", "community"],
      completedQuestCount: 9,
      isEarlyCalibration: false,
      journeyPhase: "goal_closure_due",
    });

    expect(analysis.homeBaseViability).toBe("weak");
    expect(analysis.recommendedCity).toBe("Longmont, CO");
    expect(analysis.zones[0]?.city).toBe("Longmont, CO");
  });
});

describe("applyOpportunityZonePolicy", () => {
  test("adds opportunity framing without hard-retargeting the brief", () => {
    const decision = applyOpportunityZonePolicy({
      brief: makeBrief(),
      ctx: makePromptContext({
        opportunityZones: {
          homeBaseViability: "weak",
          recommendedCity: "Longmont, CO",
          fallbackCity: "Boulder, CO",
          zones: [
            {
              city: "Longmont, CO",
              lat: 40.16,
              lng: -105.1,
              distanceMiles: 12.2,
              population: 98700,
              opportunityScore: 6.2,
              tier: "nearby_growth_zone",
              rationale: ["better odds of classes/clubs"],
              isHomeBase: false,
            },
            {
              city: "Frederick, CO",
              lat: 40.1,
              lng: -105,
              distanceMiles: 0,
              population: 14000,
              opportunityScore: 2.9,
              tier: "home_base",
              rationale: ["low-friction trust zone"],
              isHomeBase: true,
            },
          ],
        },
      }),
    });

    expect(decision.applied).toBe(true);
    expect(decision.logLine).toContain(
      "Opportunity zone advisory: Longmont, CO",
    );
  });

  test("does nothing when the recommended zone is not materially better", () => {
    const brief = makeBrief();
    const decision = applyOpportunityZonePolicy({
      brief,
      ctx: makePromptContext({
        opportunityZones: {
          homeBaseViability: "limited",
          recommendedCity: "Firestone, CO",
          fallbackCity: "Longmont, CO",
          zones: [
            {
              city: "Firestone, CO",
              lat: 40.12,
              lng: -104.95,
              distanceMiles: 4,
              population: 17000,
              opportunityScore: 3.5,
              tier: "nearby_growth_zone",
              rationale: ["general nearby option"],
              isHomeBase: false,
            },
            {
              city: "Frederick, CO",
              lat: 40.1,
              lng: -105,
              distanceMiles: 0,
              population: 14000,
              opportunityScore: 3.1,
              tier: "home_base",
              rationale: ["low-friction trust zone"],
              isHomeBase: true,
            },
          ],
        },
      }),
    });

    expect(decision.applied).toBe(false);
    expect(brief.targetCity).toBe("Frederick, CO");
    expect(brief.searchQueries[0]).toContain("Frederick");
  });
});
