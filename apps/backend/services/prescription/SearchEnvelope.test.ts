import { describe, expect, test } from "bun:test";
import { CapacityTrack } from "../../entities/Sidequest";
import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
import type { StrategyBrief } from "./PrescriptionStrategy";
import { buildSearchEnvelope, localSearchCeilingMiles } from "./SearchEnvelope";
import type { DistancePolicyDecision } from "./DistancePolicy";

function makeBrief(overrides: Partial<StrategyBrief> = {}): StrategyBrief {
  return {
    capacityTrack: CapacityTrack.PUBLIC_PRESENCE,
    repIntent: "Be visible in a new room",
    experienceType: "structured social room",
    suggestedCategories: ["Board Game Venue", "Workshop / Class Venue"],
    targetCity: "Frederick, CO",
    maxDistanceMiles: 18,
    difficultyRange: [2, 5],
    socialChallengeLevel: "low",
    searchQueries: [
      "board game night Frederick CO",
      "beginner social dance Longmont CO",
    ],
    avoidVenues: [],
    avoidCategories: [],
    suggestedTiming: "weekday evening",
    rationale: "Find a better social room nearby.",
    ...overrides,
  };
}

function makeCtx(
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
    homeLng: -104.97,
    searchLat: 40.1,
    searchLng: -104.97,
    city: "Frederick, CO",
    homeCity: "Frederick, CO",
    isAwayFromHome: false,
    distFromHome: 0,
    radius: 3.5,
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
    opportunityZones: {
      homeBaseViability: "weak",
      recommendedCity: "Longmont, CO",
      fallbackCity: "Erie, CO",
      zones: [
        {
          city: "Longmont, CO",
          distanceMiles: 9.5,
          population: 98700,
          opportunityScore: 6.2,
          tier: "nearby_growth_zone",
          rationale: ["better odds of classes/clubs"],
          isHomeBase: false,
        },
        {
          city: "Erie, CO",
          distanceMiles: 4.2,
          population: 33000,
          opportunityScore: 5.1,
          tier: "nearby_growth_zone",
          rationale: ["closer fallback"],
          isHomeBase: false,
        },
        {
          city: "Frederick, CO",
          distanceMiles: 0,
          population: 14000,
          opportunityScore: 2.9,
          tier: "home_base",
          rationale: ["sparse social pool"],
          isHomeBase: true,
        },
      ],
    },
    journeyPhaseContext: "",
    journeyPhase: {
      phase: "goal_closure_due",
      requireMilestoneQuest: true,
      requireStructuredNonEnjoy: false,
      forbidParkForNonEnjoy: false,
      fallbackLane: "open",
    },
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

function makeDistancePolicy(
  overrides: Partial<DistancePolicyDecision> = {},
): DistancePolicyDecision {
  return {
    scope: "regional_opportunity",
    maxDistanceMiles: 18,
    travelRationale: "Travel is part of the rep.",
    wasClampedByRejection: false,
    shouldFrameTravel: true,
    ...overrides,
  };
}

describe("buildSearchEnvelope", () => {
  test("keeps users local when no reach mode is chosen yet", () => {
    const envelope = buildSearchEnvelope({
      brief: makeBrief(),
      ctx: makeCtx(),
      distancePolicy: makeDistancePolicy(),
    });

    expect(envelope.maxRadiusMiles).toBe(localSearchCeilingMiles(3.5));
    expect(envelope.queryFamilies[0]).toContain("near Frederick");
    expect(envelope.preferredZoneHints.length).toBe(0);
  });

  test("allows nearby opportunity hints when nearby_mix is selected", () => {
    const envelope = buildSearchEnvelope({
      brief: makeBrief(),
      ctx: makeCtx({
        user: {
          comfortProfile: null,
          onboardingProfile: null,
          pacePreference: null,
          reachMode: "nearby_mix",
          fearLadder: null,
          expectancyCalibration: null,
          socialSituation: null,
        },
      }),
      distancePolicy: makeDistancePolicy(),
    });

    expect(envelope.maxRadiusMiles).toBe(12);
    expect(envelope.preferredZoneHints.map((hint) => hint.city)).toContain(
      "Longmont, CO",
    );
  });
});
