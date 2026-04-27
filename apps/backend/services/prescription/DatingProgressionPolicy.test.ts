import { describe, expect, test } from "bun:test";
import {
  buildDatingProgressionContext,
  downgradeDatingRepShape,
  inferDatingRepShape,
} from "./DatingProgressionPolicy";

function mockDataSource(rows: unknown[]) {
  return {
    query: async () => rows,
  } as any;
}

describe("DatingProgressionPolicy", () => {
  test("keeps early dating journeys in room exposure", async () => {
    const ctx = await buildDatingProgressionContext({
      dataSource: mockDataSource([]),
      userId: "user-1",
      comfortProfile: {
        primaryGoal: "Start dating again",
        goalTags: ["dating"],
      },
      goalTags: ["dating"],
      completedQuestCount: 2,
      milestoneQuestSeen: false,
      goalClosureDue: false,
      blockerMeta: null,
    });

    expect(ctx.stage).toBe("room_exposure");
    expect(ctx.allowDirectDatingRep).toBe(false);
    expect(ctx.preferredRepShapes).toEqual(["venue_selection"]);
    expect(ctx.questContract?.suggestedCategories).not.toContain(
      "Coffee Shop",
    );
    expect(ctx.questContract?.suggestedCategories).not.toContain("Bookstore");
    expect(ctx.questContract?.searchQueries.join(" ")).not.toMatch(/coffee/i);
    expect(ctx.questContract?.searchQueries.join(" ")).not.toMatch(
      /bookstore/i,
    );
  });

  test("moves through near-target capabilities before a direct invite", async () => {
    const ctx = await buildDatingProgressionContext({
      dataSource: mockDataSource([
        {
          quest_role: "milestone",
          goal_action_type: "none",
          rating: 4,
          social_context: "solo",
          rep_intent: "Keep one conversation alive with one honest follow-up.",
          description: "Reply to one match with one real question.",
          action_items: ["Reply with one question."],
          venue_category: "Board Game Venue",
        },
        {
          quest_role: "deepen",
          goal_action_type: "none",
          rating: 4,
          social_context: "group",
          rep_intent: "Spend time in a date-worthy room.",
          description: "Stay at the game night and notice the room.",
          action_items: [],
          venue_category: "Workshop / Class Venue",
        },
      ]),
      userId: "user-2",
      comfortProfile: {
        primaryGoal: "Start dating again",
        goalTags: ["dating"],
      },
      goalTags: ["dating"],
      completedQuestCount: 11,
      milestoneQuestSeen: true,
      goalClosureDue: false,
      blockerMeta: null,
    });

    expect(ctx.capabilityId).toBe("interest_signal");
    expect(ctx.stage).toBe("conversation_continuation");
    expect(ctx.enactmentMode).toBe("bfs");
    expect(ctx.allowDirectDatingRep).toBe(false);
  });

  test("promotes to a specific invitation draft when goal closure is due", async () => {
    const ctx = await buildDatingProgressionContext({
      dataSource: mockDataSource([
        {
          quest_role: "milestone",
          goal_action_type: "none",
          rating: 4,
          social_context: "solo",
          rep_intent: "Keep one conversation alive with one honest follow-up.",
          description: "Reply to one match with one real question.",
          action_items: ["Reply with one question."],
          venue_category: "Board Game Venue",
        },
        {
          quest_role: "deepen",
          goal_action_type: "none",
          rating: 4,
          social_context: "group",
          rep_intent: "Spend time in a date-worthy room.",
          description: "Stay at the game night and notice the room.",
          action_items: [],
          venue_category: "Workshop / Class Venue",
        },
      ]),
      userId: "user-2",
      comfortProfile: {
        primaryGoal: "Start dating again",
        goalTags: ["dating"],
      },
      goalTags: ["dating"],
      completedQuestCount: 11,
      milestoneQuestSeen: true,
      goalClosureDue: true,
      blockerMeta: null,
    });

    expect(ctx.capabilityId).toBe("specific_invitation");
    expect(ctx.stage).toBe("message_closure");
    expect(ctx.allowDirectDatingRep).toBe(true);
    expect(ctx.questContract?.capabilityId).toBe("specific_invitation");
    expect(ctx.questContract?.repShape).toBe("draft_message");
    expect(ctx.questContract?.directGoalTouch).toBe(false);
    expect(ctx.questContract?.requiredAction).toContain(
      "Draft one message-first",
    );
    expect(ctx.questContract?.requiredElements).toContain(
      "Name one specific venue from the quest.",
    );
    expect(ctx.questContract?.forbiddenSubstitutions?.join(" ")).toContain(
      "thanking staff",
    );
    expect(ctx.questContract?.forbiddenActions).toContain(
      "Do not ask someone out yet.",
    );
    expect(ctx.preferredPatternIds).toContain(
      "specific_invitation_draft_first",
    );
    expect(ctx.debug.bridgedToDraftInvite).toBe(true);
  });

  test("sends the specific invitation after a draft bridge exists", async () => {
    const ctx = await buildDatingProgressionContext({
      dataSource: mockDataSource([
        {
          quest_role: "milestone",
          goal_action_type: "none",
          rating: 4,
          social_context: "solo",
          rep_intent: "Draft one honest dating message without sending it yet.",
          description: "Draft the invite to one match with a real venue.",
          action_items: ["Draft the invite but do not send it yet."],
          venue_category: "Art Gallery",
        },
        {
          quest_role: "deepen",
          goal_action_type: "none",
          rating: 4,
          social_context: "group",
          rep_intent: "Spend time in a date-worthy room.",
          description: "Stay at the game night and notice the room.",
          action_items: [],
          venue_category: "Workshop / Class Venue",
        },
      ]),
      userId: "user-after-draft",
      comfortProfile: {
        primaryGoal: "Start dating again",
        goalTags: ["dating"],
      },
      goalTags: ["dating"],
      completedQuestCount: 11,
      milestoneQuestSeen: true,
      goalClosureDue: true,
      blockerMeta: null,
    });

    expect(ctx.capabilityId).toBe("specific_invitation");
    expect(ctx.allowDirectDatingRep).toBe(true);
    expect(ctx.questContract?.repShape).toBe("send_specific_invite");
    expect(ctx.questContract?.directGoalTouch).toBe(true);
    expect(ctx.questContract?.requiredAction).toContain("Send one");
    expect(ctx.debug.bridgedToDraftInvite).toBe(false);
  });

  test("goal closure jumps to the specific invitation capability as soon as readiness is due", async () => {
    const ctx = await buildDatingProgressionContext({
      dataSource: mockDataSource([
        {
          quest_role: "explore",
          goal_action_type: "none",
          rating: 4,
          social_context: "met_someone_new",
          rep_intent: "Ask one easy question about the shared activity.",
          description: "Ask someone how long they have been coming.",
          action_items: ["Ask one context question."],
          venue_category: "Community Center",
        },
      ]),
      userId: "user-ready-at-six",
      comfortProfile: {
        primaryGoal: "Start dating again",
        goalTags: ["dating"],
      },
      goalTags: ["dating"],
      completedQuestCount: 6,
      milestoneQuestSeen: false,
      goalClosureDue: true,
      blockerMeta: null,
    });

    expect(ctx.capabilityId).toBe("specific_invitation");
    expect(ctx.allowDirectDatingRep).toBe(true);
    expect(ctx.questContract?.repShape).toBe("draft_message");
    expect(ctx.questContract?.directGoalTouch).toBe(false);
    expect(ctx.debug.stagePromotedByGoalClosure).toBe(true);
    expect(ctx.debug.bridgedToDraftInvite).toBe(true);
  });

  test("keeps message-first invitation when closure is due after public-pressure rejections", async () => {
    const ctx = await buildDatingProgressionContext({
      dataSource: mockDataSource([
        {
          quest_role: "deepen",
          goal_action_type: "none",
          rating: 4,
          social_context: "met_someone_new",
          rep_intent: "Ask one easy question about the shared activity.",
          description: "Ask someone how long they have been coming.",
          action_items: ["Ask one context question."],
          venue_category: "Gym / Fitness Studio",
        },
        {
          quest_role: "deepen",
          goal_action_type: "none",
          rating: 4,
          social_context: "group",
          rep_intent: "Spend time in a date-worthy room.",
          description: "Stay at the game night and notice the room.",
          action_items: [],
          venue_category: "Workshop / Class Venue",
        },
      ]),
      userId: "user-closure-public-pressure",
      comfortProfile: {
        primaryGoal: "Start dating again",
        goalTags: ["dating"],
      },
      goalTags: ["dating"],
      completedQuestCount: 11,
      milestoneQuestSeen: false,
      goalClosureDue: true,
      blockerMeta: {
        type: "TOO_PUBLIC",
        severity: "medium",
        phase: "building",
      },
      rejectionPattern: { reason: "TOO_PUBLIC", count: 3 },
    });

    expect(ctx.capabilityId).toBe("specific_invitation");
    expect(ctx.allowDirectDatingRep).toBe(true);
    expect(ctx.questContract?.repShape).toBe("draft_message");
    expect(ctx.questContract?.directGoalTouch).toBe(false);
    expect(ctx.questContract?.socialChallengeLevel).toBe("low");
  });

  test("cools direct reps down for two quests after a concrete invite", async () => {
    const ctx = await buildDatingProgressionContext({
      dataSource: mockDataSource([
        {
          quest_role: "milestone",
          goal_action_type: "dating_app_invite",
          rating: 4,
          social_context: "solo",
          rep_intent: "Send one specific invite.",
          description: "Send one Hinge invite for coffee.",
          action_items: ["Send the invite."],
          venue_category: "Art Gallery",
        },
        {
          quest_role: "deepen",
          goal_action_type: "none",
          rating: 4,
          social_context: "solo",
          rep_intent: "Be in a date-worthy room.",
          description: "Go to the gallery.",
          action_items: [],
          venue_category: "Art Gallery",
        },
      ]),
      userId: "user-3",
      comfortProfile: {
        primaryGoal: "Start dating again",
        goalTags: ["dating"],
      },
      goalTags: ["dating"],
      completedQuestCount: 14,
      milestoneQuestSeen: true,
      goalClosureDue: false,
      blockerMeta: null,
    });

    expect(ctx.cooldownActive).toBe(true);
    expect(ctx.allowDirectDatingRep).toBe(false);
    expect(ctx.capabilityId).not.toBe("specific_invitation");
    expect(ctx.preferredRepShapes[0]).not.toBe("send_specific_invite");
  });

  test("remembers culled failed direct attempts for cooldown", async () => {
    const ctx = await buildDatingProgressionContext({
      dataSource: mockDataSource([
        {
          quest_role: "explore",
          goal_action_type: "none",
          rating: 4,
          deleted_at: null,
          social_context: "met_someone_new",
          rep_intent: "Stay in a people room.",
          description: "Stay through one round.",
          action_items: [],
          venue_category: "Gym / Fitness Studio",
        },
        {
          quest_role: "milestone",
          goal_action_type: "dating_app_invite",
          rating: 1,
          deleted_at: new Date("2026-04-24T00:00:00Z"),
          social_context: "solo",
          rep_intent: "Send one specific invite.",
          description: "Send one Hinge invite for coffee.",
          action_items: ["Send the invite."],
          venue_category: "Coffee Shop",
        },
      ]),
      userId: "user-culled-direct",
      comfortProfile: {
        primaryGoal: "Start dating again",
        goalTags: ["dating"],
      },
      goalTags: ["dating"],
      completedQuestCount: 9,
      milestoneQuestSeen: true,
      goalClosureDue: false,
      blockerMeta: null,
    });

    expect(ctx.cooldownActive).toBe(true);
    expect(ctx.recentDirectDatingRepCount).toBe(1);
    expect(ctx.allowDirectDatingRep).toBe(false);
    expect(ctx.capabilityId).not.toBe("specific_invitation");
  });

  test("downgrades rep shapes in the intended order", () => {
    expect(downgradeDatingRepShape("send_specific_invite")).toBe(
      "draft_message",
    );
    expect(downgradeDatingRepShape("draft_message")).toBe("venue_selection");
    expect(downgradeDatingRepShape("continue_conversation")).toBe(
      "draft_message",
    );
  });

  test("infers rep shape from text", () => {
    expect(
      inferDatingRepShape({
        text: "Draft one honest message to a match, but don't send it yet.",
      }),
    ).toBe("draft_message");
    expect(
      inferDatingRepShape({
        text: "Reply to the chat with one real question.",
      }),
    ).toBe("continue_conversation");
  });
});
