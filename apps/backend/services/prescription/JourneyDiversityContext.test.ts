import { describe, expect, test } from "bun:test";
import { buildJourneyDiversityContext } from "./JourneyDiversityContext";

function mockDataSource(rows: unknown[]) {
  return {
    query: async () => rows,
  } as any;
}

describe("buildJourneyDiversityContext", () => {
  test("enters milestone cooldown right after a direct goal touch", async () => {
    const ctx = await buildJourneyDiversityContext({
      dataSource: mockDataSource([
        {
          quest_role: "milestone",
          capacity_track: "SOCIAL_EXTENSION",
          direct_goal_touch: true,
          goal_action_type: "dating_app_invite",
          completed_at: new Date(),
          venue_category: "Coffee Shop",
          venue_name: "Ziggi's Coffee",
        },
        {
          quest_role: "explore",
          capacity_track: "PUBLIC_PRESENCE",
          direct_goal_touch: false,
          goal_action_type: "none",
          completed_at: new Date(),
          venue_category: "Coffee Shop",
          venue_name: "Erie Coffee Roasters",
        },
      ]),
      userId: "user-1",
      completedQuestCount: 12,
    });

    expect(ctx.shouldCooldownMilestone).toBe(true);
    expect(ctx.questsSinceDirectGoalTouch).toBe(0);
    expect(ctx.recentDirectGoalTouchCount).toBe(1);
    expect(ctx.questsSinceDirectDatingRep).toBe(0);
    expect(ctx.recentDirectDatingRepCount).toBe(1);
  });

  test("flags coffee gravity when coffee dominates the recent mix", async () => {
    const ctx = await buildJourneyDiversityContext({
      dataSource: mockDataSource([
        {
          quest_role: "milestone",
          capacity_track: "SOCIAL_EXTENSION",
          direct_goal_touch: false,
          goal_action_type: "none",
          completed_at: new Date(),
          venue_category: "Coffee Shop",
          venue_name: "A",
        },
        {
          quest_role: "milestone",
          capacity_track: "PUBLIC_PRESENCE",
          direct_goal_touch: false,
          goal_action_type: "none",
          completed_at: new Date(),
          venue_category: "Coffee Shop",
          venue_name: "B",
        },
        {
          quest_role: "explore",
          capacity_track: "PUBLIC_PRESENCE",
          direct_goal_touch: false,
          goal_action_type: "none",
          completed_at: new Date(),
          venue_category: "Coffee Shop",
          venue_name: "C",
        },
        {
          quest_role: "deepen",
          capacity_track: "PUBLIC_PRESENCE",
          direct_goal_touch: false,
          goal_action_type: "none",
          completed_at: new Date(),
          venue_category: "Community Center",
          venue_name: "D",
        },
      ]),
      userId: "user-2",
      completedQuestCount: 10,
    });

    expect(ctx.dominantRecentCategory).toBe("Coffee Shop");
    expect(ctx.dominantRecentFamily).toBe("coffee_family");
    expect(ctx.promptBlock).toContain("Repetition warning");
  });

  test("flags park-family dominance as the new safe default", async () => {
    const ctx = await buildJourneyDiversityContext({
      dataSource: mockDataSource([
        {
          quest_role: "deepen",
          capacity_track: "ACTIVATION",
          direct_goal_touch: false,
          goal_action_type: "none",
          completed_at: new Date(),
          venue_category: "Trail / Park",
          venue_name: "Firefighters' Park",
        },
        {
          quest_role: "explore",
          capacity_track: "ACTIVATION",
          direct_goal_touch: false,
          goal_action_type: "none",
          completed_at: new Date(),
          venue_category: "Trail / Park",
          venue_name: "Crist Park",
        },
        {
          quest_role: "enjoy",
          capacity_track: "ACTIVATION",
          direct_goal_touch: false,
          goal_action_type: "none",
          completed_at: new Date(),
          venue_category: "Trail / Park",
          venue_name: "Frederick Rec Area",
        },
        {
          quest_role: "explore",
          capacity_track: "PUBLIC_PRESENCE",
          direct_goal_touch: false,
          goal_action_type: "none",
          completed_at: new Date(),
          venue_category: "Community Center",
          venue_name: "Erie Community Center",
        },
      ]),
      userId: "user-3",
      completedQuestCount: 18,
    });

    expect(ctx.dominantRecentFamily).toBe("park_outdoor");
    expect(ctx.consecutiveSameFamilyCount).toBe(3);
    expect(ctx.promptBlock).toContain("Family warning");
  });

  test("forces a structured floor when late journey is all maintenance", async () => {
    const ctx = await buildJourneyDiversityContext({
      dataSource: mockDataSource([
        {
          quest_role: "deepen",
          capacity_track: "ACTIVATION",
          direct_goal_touch: false,
          goal_action_type: "none",
          completed_at: new Date(),
          venue_category: "Trail / Park",
          venue_name: "A",
        },
        {
          quest_role: "explore",
          capacity_track: "ACTIVATION",
          direct_goal_touch: false,
          goal_action_type: "none",
          completed_at: new Date(),
          venue_category: "Trail / Park",
          venue_name: "B",
        },
        {
          quest_role: "enjoy",
          capacity_track: "ACTIVATION",
          direct_goal_touch: false,
          goal_action_type: "none",
          completed_at: new Date(),
          venue_category: "Trail / Park",
          venue_name: "C",
        },
        {
          quest_role: "deepen",
          capacity_track: "RETURNABILITY",
          direct_goal_touch: false,
          goal_action_type: "none",
          completed_at: new Date(),
          venue_category: "Trail / Park",
          venue_name: "D",
        },
      ]),
      userId: "user-4",
      completedQuestCount: 22,
    });

    expect(ctx.recentStructuredCount).toBe(0);
    expect(ctx.recentBaseRecoveryCount).toBe(4);
    expect(ctx.shouldForceStructuredNext).toBe(true);
    expect(ctx.promptBlock).toContain("Structured floor");
  });
});
