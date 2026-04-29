import { describe, expect, test } from "bun:test";
import {
  applyInterestAlignmentGate,
  buildInterestSignals,
} from "./InterestAlignmentSelectionGate";
import type { InterestSignals } from "./InterestAlignmentPolicy";
import type { ScoutCandidate } from "./PrescriptionStrategy";
import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";

function userContext(
  overrides: Partial<PrescriptionPromptContext["user"]> = {},
): PrescriptionPromptContext["user"] {
  return {
    comfortProfile: null,
    onboardingProfile: null,
    pacePreference: null,
    reachMode: null,
    fearLadder: null,
    expectancyCalibration: null,
    socialSituation: null,
    ...overrides,
  };
}

function candidate(overrides: Partial<ScoutCandidate> = {}): ScoutCandidate {
  return {
    venueName: "Test Venue",
    venueAddress: "123 Test St",
    venueCategory: "Other",
    latitude: 0,
    longitude: 0,
    source: "search_places",
    ...overrides,
  };
}

function signals(overrides: Partial<InterestSignals> = {}): InterestSignals {
  return {
    activities: [],
    goalTags: [],
    primaryGoal: null,
    ...overrides,
  };
}

describe("applyInterestAlignmentGate — first-5-reps gate", () => {
  test("passes through once the user is past their first 5 prescriptions", () => {
    const decision = applyInterestAlignmentGate({
      candidates: [candidate({ venueCategory: "Climbing Gym" })],
      signals: signals({ activities: ["climbing"] }),
      completedQuestCount: 5,
    });
    expect(decision.kind).toBe("passthrough");
    if (decision.kind === "passthrough") {
      expect(decision.reason).toBe("past_first_five");
    }
  });
});

describe("applyInterestAlignmentGate — slate construction", () => {
  test("returns a use_slate decision front-loaded by alignment when the floor is met", () => {
    // Use distinct signal types so ordering is unambiguous:
    //   activity → 1.0, primaryGoal → 0.6, goalTag → 0.4.
    const decision = applyInterestAlignmentGate({
      candidates: [
        candidate({ venueName: "filler-1", venueCategory: "Coffee Shop" }),
        candidate({
          venueName: "weak-aligned",
          venueCategory: "Workshop / Class Venue",
        }),
        candidate({ venueName: "filler-2", venueCategory: "Coffee Shop" }),
        candidate({ venueName: "strong-aligned", venueCategory: "Climbing Gym" }),
        candidate({ venueName: "mid-aligned", venueCategory: "Pottery Studio" }),
      ],
      signals: signals({
        activities: ["climbing"],
        primaryGoal: "find a pottery class",
        goalTags: ["discover_hobby"],
      }),
      completedQuestCount: 0,
    });
    expect(decision.kind).toBe("use_slate");
    if (decision.kind === "use_slate") {
      const names = decision.slate.map((c) => c.venueName);
      expect(names.slice(0, 3)).toEqual([
        "strong-aligned",
        "mid-aligned",
        "weak-aligned",
      ]);
      expect(decision.slate).toHaveLength(5);
      expect(decision.alignedCount).toBe(3);
    }
  });

  test("passes through when fewer than 3 aligned candidates exist — fallback path runs unchanged", () => {
    // Two aligned, three filler — under the 3-of-5 floor.
    const decision = applyInterestAlignmentGate({
      candidates: [
        candidate({ venueName: "aligned-1", venueCategory: "Climbing Gym" }),
        candidate({ venueName: "aligned-2", venueCategory: "Climbing Gym" }),
        candidate({ venueName: "filler-1", venueCategory: "Coffee Shop" }),
        candidate({ venueName: "filler-2", venueCategory: "Coffee Shop" }),
        candidate({ venueName: "filler-3", venueCategory: "Coffee Shop" }),
      ],
      signals: signals({ activities: ["climbing"] }),
      completedQuestCount: 1,
    });
    expect(decision.kind).toBe("passthrough");
    if (decision.kind === "passthrough") {
      expect(decision.reason).toBe("insufficient_aligned");
    }
  });
});

describe("buildInterestSignals — pulls from the three onboarding sources", () => {
  test("populates activities, primaryGoal, and goalTags from a fully-filled user", () => {
    const built = buildInterestSignals(
      userContext({
        onboardingProfile: { activities: ["climbing", "yoga"] },
        comfortProfile: {
          primaryGoal: "find a pottery class",
          goalTags: ["discover_hobby", "community"],
        },
      }),
    );
    expect(built.activities).toEqual(["climbing", "yoga"]);
    expect(built.primaryGoal).toBe("find a pottery class");
    expect(built.goalTags).toEqual(["discover_hobby", "community"]);
  });

  test("tolerates a sparse user — empty arrays and null primaryGoal — so the gate degrades to passthrough cleanly", () => {
    const built = buildInterestSignals(userContext());
    expect(built.activities).toEqual([]);
    expect(built.goalTags).toEqual([]);
    expect(built.primaryGoal).toBeNull();
  });
});
