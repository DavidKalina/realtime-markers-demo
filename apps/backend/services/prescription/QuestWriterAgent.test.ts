import { describe, expect, test } from "bun:test";
import { CapacityTrack } from "../../entities/Sidequest";
import { normalizeWriterOutput } from "./QuestWriterAgent";
import type { StrategyBrief } from "./PrescriptionStrategy";

function directInviteBrief(): StrategyBrief {
  return {
    capacityTrack: CapacityTrack.SOCIAL_EXTENSION,
    repIntent: "Send one specific invite.",
    experienceType: "message-first dating invite",
    suggestedCategories: ["Coffee Shop"],
    targetCity: "Frederick",
    maxDistanceMiles: 4,
    difficultyRange: [3, 5],
    socialChallengeLevel: "low",
    searchQueries: ["date-worthy coffee near Frederick"],
    avoidVenues: [],
    avoidCategories: [],
    suggestedTiming: "weekday evening",
    rationale: "Closure is due.",
    allowDirectDatingRep: true,
    datingRepShape: "send_specific_invite",
    questContract: {
      programId: "dating",
      capabilityId: "specific_invitation",
      capabilityLabel: "Make a specific invitation",
      enactmentPatternId: "specific_invitation_message_first",
      enactmentPatternLabel: "Message-first specific invite",
      mode: "bfs",
      capacityTrack: CapacityTrack.SOCIAL_EXTENSION,
      repShape: "send_specific_invite",
      repIntent: "Use a real place to send one concrete invitation.",
      experienceType: "Message-first specific invite",
      suggestedCategories: ["Coffee Shop"],
      searchQueries: ["date-worthy coffee near Frederick"],
      exampleActions: ["Send one invite with a specific place."],
      difficultyRange: [3, 5],
      socialChallengeLevel: "low",
      directGoalTouch: true,
      allowedGoalActionTypes: [
        "dating_app_invite",
        "suggest_coffee",
        "natural_invitation",
      ],
      requiredAction:
        "Send one message-first, low-pressure dating invite to a real person using a specific venue and time window.",
      requiredElements: ["Name one specific venue from the quest."],
      forbiddenActions: [],
      forbiddenSubstitutions: [
        "Do not replace the invite with smiling, thanking staff, or being friendly to a server.",
      ],
      successCriteria: ["sent invite"],
      smallerRep:
        "Draft the exact invite to one real person, including the venue and time windows, but do not send it yet.",
      tinyRep:
        "Pick the person and the venue, then write the first sentence of the invite.",
      minimumViableWin:
        "You created a specific dating invite for a real person.",
      exitRamp:
        "If sending feels too sharp, save the complete draft and decide later.",
      fallback: "If sending feels too sharp, draft the specific invite first.",
      rationale: "Direct dating action is due.",
    },
  };
}

describe("normalizeWriterOutput", () => {
  test("repairs weak dating milestone prose into the planner-owned invite script", () => {
    const parsed = {
      t: "Warm Exit Line",
      s: "Practice being a little warmer.",
      items: [
        {
          t: "Say Thanks",
          d: "Go to Ziggi's and say thanks to the barista with a genuine smile.",
          sr: "Smile at staff.",
          tr: "Walk in.",
          mvw: "You were friendly.",
          er: "Leave when done.",
          e: "☕",
          ec: null,
          vn: "Old",
          va: "Old",
          eid: null,
          vc: "Coffee Shop",
          hook: "This is gentle.",
          sa: [],
          ai: [],
          jp: "How did it feel?",
          df: 4,
          act: "actionable",
          dgt: false,
          gat: "none",
        },
      ],
    };

    normalizeWriterOutput(
      parsed,
      {
        promptContext: {
          datingProgression: {
            isRelevant: true,
            allowDirectDatingRep: true,
          },
          activeGoalMilestone: { goalClosureDue: true },
          historyContext: "",
        },
      } as any,
      directInviteBrief(),
      {
        venueName: "Ziggi's Coffee",
        venueAddress: "3450 State Hwy 52",
        venueCategory: "Coffee Shop",
        latitude: 40,
        longitude: -105,
        source: "search_places",
      },
    );

    const item = (parsed as any).items[0];
    expect(item.d).toContain("dating-app match");
    expect(item.d).toContain("Ziggi's Coffee");
    expect(item.gat).toBe("dating_app_invite");
    expect(item.dgt).toBe(true);
    expect(item.mvw).toBe(
      "You created a specific dating invite for a real person.",
    );
  });

  test("downgrades direct invite prose when the active contract is a draft bridge", () => {
    const parsed = {
      t: "Draft First",
      s: "Prepare the ask.",
      items: [
        {
          t: "Send the Invite",
          d: "Open Hinge and send an invite to meet at Prairie Greens Thursday.",
          sr: "Draft it.",
          tr: "Pick the person.",
          mvw: "You sent it.",
          er: "Stop if needed.",
          e: "💬",
          ec: null,
          vn: "Old",
          va: "Old",
          eid: null,
          vc: "Art Gallery",
          hook: "This is direct.",
          sa: [],
          ai: ["Send the invite."],
          jp: "How did it feel?",
          df: 4,
          act: "actionable",
          dgt: true,
          gat: "dating_app_invite",
        },
      ],
    };
    const brief = directInviteBrief();
    brief.allowDirectDatingRep = false;
    brief.datingRepShape = "draft_message";
    brief.questContract = {
      ...brief.questContract!,
      enactmentPatternId: "specific_invitation_draft_first",
      enactmentPatternLabel: "Draft the specific invite",
      repShape: "draft_message",
      directGoalTouch: false,
      allowedGoalActionTypes: [],
      forbiddenActions: ["Do not ask someone out yet."],
      requiredAction:
        "Draft one message-first, low-pressure dating invite to a real person using a specific venue and time window. Do not send it yet.",
    };

    normalizeWriterOutput(
      parsed,
      {
        promptContext: {
          datingProgression: {
            isRelevant: true,
            allowDirectDatingRep: true,
            stage: "message_closure",
          },
          activeGoalMilestone: { goalClosureDue: true },
          historyContext: "",
        },
      } as any,
      brief,
      {
        venueName: "Prairie Greens",
        venueAddress: "7781 Mountain View Dr",
        venueCategory: "Art Gallery",
        latitude: 40,
        longitude: -105,
        source: "search_places",
      },
    );

    const item = (parsed as any).items[0];
    expect(item.d).toContain("draft one low-pressure invite");
    expect(item.d).toContain("without sending it today");
    expect(item.gat).toBe("none");
    expect(item.dgt).toBe(false);
    expect(item.act).toBe("suggestive");
  });
});
