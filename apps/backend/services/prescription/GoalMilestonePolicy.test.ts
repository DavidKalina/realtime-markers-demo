import { describe, expect, test } from "bun:test";
import { CapacityTrack } from "../../entities/Sidequest";
import type { QuestContract } from "./GoalProgram";
import { applyGoalMilestonePolicy } from "./GoalMilestonePolicy";
import type { StrategyBrief } from "./PrescriptionStrategy";

function brief(overrides: Partial<StrategyBrief> = {}): StrategyBrief {
  return {
    capacityTrack: CapacityTrack.PUBLIC_PRESENCE,
    repIntent: "Be visible.",
    experienceType: "coffee",
    suggestedCategories: ["Coffee Shop"],
    targetCity: "Frederick",
    maxDistanceMiles: 4,
    difficultyRange: [1, 3],
    socialChallengeLevel: "none",
    searchQueries: ["coffee Frederick"],
    avoidVenues: [],
    avoidCategories: [],
    suggestedTiming: "weekday morning",
    rationale: "Build comfort.",
    ...overrides,
  };
}

function questContract(
  overrides: Partial<QuestContract> = {},
): QuestContract {
  return {
    programId: "dating",
    capabilityId: "public_comfort",
    capabilityLabel: "Be visible without performing",
    enactmentPatternId: "public_comfort_people_room",
    enactmentPatternLabel: "Stay in a people room",
    mode: "bfs",
    capacityTrack: CapacityTrack.PUBLIC_PRESENCE,
    repShape: "venue_selection",
    repIntent: "Enter a socially alive space and let the room carry the exposure.",
    experienceType: "Stay in a people room",
    suggestedCategories: ["Board Game Venue", "Brewery / Taproom"],
    searchQueries: ["board game night near Frederick"],
    exampleActions: ["Stay through one round."],
    difficultyRange: [2, 4],
    socialChallengeLevel: "low",
    directGoalTouch: false,
    allowedGoalActionTypes: [],
    forbiddenActions: ["Do not ask someone out yet."],
    successCriteria: ["stayed through a segment"],
    fallback:
      "If the place feels off, leave after a short stay and count the venue read as useful.",
    rationale:
      "This quest is the current dating capability contract: be visible without performing.",
    ...overrides,
  };
}

describe("applyGoalMilestonePolicy", () => {
  test("does nothing when goal closure is not due", () => {
    const b = brief();
    const decision = applyGoalMilestonePolicy({
      brief: b,
      ctx: { activeGoalMilestone: { goalClosureDue: false } } as any,
    });
    expect(decision.applied).toBe(false);
    expect(b.capacityTrack).toBe(CapacityTrack.PUBLIC_PRESENCE);
  });

  test("applies the current dating quest contract before closure is due", () => {
    const b = brief({
      capacityTrack: CapacityTrack.ACTIVATION,
      repIntent: "Generic gentle outing.",
      suggestedCategories: ["Trail / Park"],
    });
    const contract = questContract();
    const decision = applyGoalMilestonePolicy({
      brief: b,
      ctx: {
        activeGoalMilestone: { goalClosureDue: false },
        datingProgression: {
          isRelevant: true,
          stage: "room_exposure",
          allowDirectDatingRep: false,
          cooldownActive: false,
          preferredRepShapes: ["venue_selection"],
          questContract: contract,
        },
        lastRejection: null,
        city: "Frederick",
      } as any,
    });

    expect(decision.applied).toBe(true);
    expect(b.questContract).toBe(contract);
    expect(b.capacityTrack).toBe(CapacityTrack.PUBLIC_PRESENCE);
    // Categories are not overwritten from the contract — qualities express
    // the intent and the Strategist LLM picks specific categories.
    expect(b.suggestedCategories).toEqual(["Trail / Park"]);
    expect(b.repIntent).toContain("socially alive space");
    expect(b.venueQualities?.must.length ?? 0).toBeGreaterThan(0);
  });

  test("nudges goal closure toward a direct social-extension rep", () => {
    const b = brief();
    const decision = applyGoalMilestonePolicy({
      brief: b,
      ctx: {
        activeGoalMilestone: { goalClosureDue: true },
        datingProgression: {
          isRelevant: true,
          stage: "message_closure",
          allowDirectDatingRep: true,
          cooldownActive: false,
          preferredRepShapes: ["send_specific_invite"],
        },
        lastRejection: null,
        city: "Frederick",
      } as any,
    });
    expect(decision.applied).toBe(true);
    expect(b.capacityTrack).toBe(CapacityTrack.SOCIAL_EXTENSION);
    expect(b.socialChallengeLevel).toBe("low");
    expect(b.datingRepShape).toBe("send_specific_invite");
    expect(b.allowDirectDatingRep).toBe(true);
    expect(b.questContract?.capabilityId).toBe("message_closure");
    expect(b.questContract?.directGoalTouch).toBe(true);
    expect(b.questContract?.requiredAction).toContain("specific venue");
    expect(b.questContract?.forbiddenSubstitutions?.join(" ")).toContain(
      "being friendly to a server",
    );
    expect(b.rationale).toContain("dating-ladder milestone");
  });

  test("does not raise difficulty when responding to a fresh rejection", () => {
    const b = brief({ difficultyRange: [1, 2] });
    applyGoalMilestonePolicy({
      brief: b,
      ctx: {
        activeGoalMilestone: { goalClosureDue: true },
        datingProgression: {
          isRelevant: true,
          stage: "conversation_continuation",
          allowDirectDatingRep: false,
          cooldownActive: true,
          preferredRepShapes: ["continue_conversation", "draft_message"],
        },
        lastRejection: { reason: "NEED_GENTLER" },
        city: "Frederick",
      } as any,
    });
    expect(b.difficultyRange).toEqual([1, 2]);
    expect(b.datingRepShape).toBe("continue_conversation");
    expect(b.allowDirectDatingRep).toBe(false);
    expect(b.repIntent).toContain("conversation");
  });

  test("fresh public rejection lowers dose without dropping the dating contract", () => {
    const b = brief({
      difficultyRange: [3, 5],
      socialChallengeLevel: "medium",
    });
    const contract = questContract({
      capabilityId: "public_comfort",
      capacityTrack: CapacityTrack.PUBLIC_PRESENCE,
      difficultyRange: [2, 4],
      socialChallengeLevel: "low",
      suggestedCategories: ["Gym / Fitness Studio", "Brewery / Taproom"],
      searchQueries: ["gym near Frederick", "brewery near Frederick"],
    });
    applyGoalMilestonePolicy({
      brief: b,
      ctx: {
        activeGoalMilestone: { goalClosureDue: false },
        datingProgression: {
          isRelevant: true,
          stage: "room_exposure",
          allowDirectDatingRep: false,
          cooldownActive: false,
          preferredRepShapes: ["venue_selection"],
          questContract: contract,
        },
        lastRejection: { reason: "TOO_PUBLIC" },
        city: "Frederick",
      } as any,
    });

    expect(b.questContract).toBe(contract);
    expect(b.capacityTrack).toBe(CapacityTrack.PUBLIC_PRESENCE);
    expect(b.socialChallengeLevel).toBe("none");
    expect(b.difficultyRange).toEqual([1, 3]);
    // TOO_PUBLIC patches qualities (low-traffic, quiet) instead of
    // hardcoding category replacements.
    expect(b.venueQualities?.must).toContain("low-traffic");
    expect(b.venueQualities?.avoid).toContain("people-rich");
  });

  test("turns an enjoy role into a goal-owned dating enjoy contract", () => {
    const b = brief({
      difficultyRange: [4, 6],
      socialChallengeLevel: "medium",
    });
    const contract = questContract({
      capabilityId: "specific_invitation",
      enactmentPatternId: "specific_invitation_draft_first",
      repShape: "draft_message",
      capacityTrack: CapacityTrack.SOCIAL_EXTENSION,
      difficultyRange: [3, 5],
      requiredAction:
        "Draft one message-first, low-pressure dating invite to a real person using a specific venue and time window.",
      requiredElements: ["Name one specific venue from the quest."],
      forbiddenSubstitutions: ["Do not replace the invite with an errand."],
    });
    const decision = applyGoalMilestonePolicy({
      brief: b,
      ctx: {
        questRole: "enjoy",
        activeGoalMilestone: { goalClosureDue: true },
        datingProgression: {
          isRelevant: true,
          stage: "message_closure",
          allowDirectDatingRep: true,
          cooldownActive: false,
          preferredRepShapes: ["draft_message", "send_specific_invite"],
          questContract: contract,
        },
        lastRejection: null,
        city: "Frederick",
      } as any,
    });

    expect(decision.applied).toBe(true);
    expect(b.questContract?.repShape).toBe("venue_selection");
    expect(b.questContract?.directGoalTouch).toBe(false);
    expect(b.allowDirectDatingRep).toBe(false);
    expect(b.capacityTrack).toBe(CapacityTrack.IDENTITY_EVIDENCE);
    expect(b.socialChallengeLevel).toBe("none");
    expect(b.difficultyRange).toEqual([1, 3]);
    expect(b.repIntent).toContain("Enjoy one date-worthy place");
    expect(b.rationale).toContain("Goal-owned enjoy adapter");
  });

  test("does nothing for non-dating goals even if closure is due", () => {
    const b = brief();
    const decision = applyGoalMilestonePolicy({
      brief: b,
      ctx: {
        activeGoalMilestone: { goalClosureDue: true },
        datingProgression: { isRelevant: false },
      } as any,
    });
    expect(decision.applied).toBe(false);
  });
});
