import { describe, expect, test } from "bun:test";
import {
  buildGoalMilestoneContext,
  detectGoalActionType,
  hasConcreteDatingAction,
  hasDirectDatingAction,
  isConcreteGoalActionType,
} from "./GoalMilestoneContext";

describe("GoalMilestoneContext direct-goal detection", () => {
  test("does not count invite-able life prose as direct dating action", () => {
    const text =
      "A quiet creative room is a good place to remember you do have a life someone could someday step into, and it makes asking someone out feel easier later.";
    expect(hasDirectDatingAction(text)).toBe(false);
    expect(detectGoalActionType(text)).toBe("none");
  });

  test("detects a real dating-app invite", () => {
    const text =
      "Send one Hinge match a message inviting them to coffee at this venue on Thursday evening.";
    expect(hasDirectDatingAction(text)).toBe(true);
    expect(hasConcreteDatingAction(text)).toBe(true);
    expect(detectGoalActionType(text)).toBe("dating_app_invite");
    expect(isConcreteGoalActionType(detectGoalActionType(text))).toBe(true);
  });

  test("does not treat vague romantic language as a concrete dating action", () => {
    const text =
      "This is a warm social signal that helps dating feel more real later without forcing anything tonight.";
    expect(hasDirectDatingAction(text)).toBe(false);
    expect(hasConcreteDatingAction(text)).toBe(false);
    expect(isConcreteGoalActionType(detectGoalActionType(text))).toBe(false);
  });

  test("does not count future date-spot scouting as a direct invite", () => {
    const text =
      "Spend 15 minutes here and notice whether it feels like a place you would genuinely suggest for coffee, brunch, or a low-pressure date later.";
    expect(hasDirectDatingAction(text)).toBe(false);
    expect(hasConcreteDatingAction(text)).toBe(false);
    expect(detectGoalActionType(text)).toBe("none");
  });

  test("counts culled completed reps toward dating readiness without using them for stable ratings", async () => {
    const completedAt = new Date("2026-04-24T00:00:00Z");
    const rows = [
      {
        quest_role: "explore",
        goal_action_type: "none",
        rating: 4,
        completed_at: completedAt,
        deleted_at: null,
        venue_category: "Coffee Shop",
        social_context: "met_someone_new",
        would_return: true,
      },
      {
        quest_role: "explore",
        goal_action_type: "none",
        rating: 3,
        completed_at: completedAt,
        deleted_at: null,
        venue_category: "Library",
        social_context: "met_someone_new",
        would_return: false,
      },
      {
        quest_role: "explore",
        goal_action_type: "none",
        rating: 4,
        completed_at: completedAt,
        deleted_at: null,
        venue_category: "Community Center",
        social_context: "with_someone",
        would_return: true,
      },
      {
        quest_role: "explore",
        goal_action_type: "none",
        rating: 3,
        completed_at: completedAt,
        deleted_at: null,
        venue_category: "Restaurant",
        social_context: "with_someone",
        would_return: true,
      },
      {
        quest_role: "explore",
        goal_action_type: "none",
        rating: 4,
        completed_at: completedAt,
        deleted_at: null,
        venue_category: "Coffee Shop",
        social_context: "solo",
        would_return: true,
      },
      ...Array.from({ length: 4 }, () => ({
        quest_role: "explore",
        goal_action_type: "none",
        rating: 3,
        completed_at: completedAt,
        deleted_at: null,
        venue_category: "Restaurant",
        social_context: "solo",
        would_return: true,
      })),
      ...Array.from({ length: 2 }, () => ({
        quest_role: "explore",
        goal_action_type: "none",
        rating: 2,
        completed_at: completedAt,
        deleted_at: completedAt,
        venue_category: "Coffee Shop",
        social_context: "solo",
        would_return: false,
      })),
    ];
    const dataSource = {
      query: async () => rows,
    } as any;

    const result = await buildGoalMilestoneContext({
      dataSource,
      userId: "user-1",
      comfortProfile: {
        goalKey: "start_dating",
        goalTags: ["dating"],
        primaryGoal: "Start dating again",
      },
      goalTags: ["dating"],
      completedQuestCount: 9,
      blockerMeta: null,
    });

    expect(result.goalClosureDue).toBe(true);
    expect(result.effectiveCompletedQuestCount).toBe(11);
    expect(result.promptBlock).toContain("11 completed quests");
    expect(result.promptBlock).toContain("9 still in deck");
  });

  test("marks dating closure due after six strong adjacent reps", async () => {
    const completedAt = new Date("2026-04-24T00:00:00Z");
    const rows = Array.from({ length: 6 }, (_, index) => ({
      quest_role: "explore",
      goal_action_type: "none",
      rating: index === 0 ? 4 : 3,
      completed_at: completedAt,
      deleted_at: null,
      venue_category: index % 2 === 0 ? "Community Center" : "Coffee Shop",
      social_context: index < 2 ? "met_someone_new" : "solo",
      would_return: true,
    }));
    const dataSource = {
      query: async () => rows,
    } as any;

    const result = await buildGoalMilestoneContext({
      dataSource,
      userId: "user-ready-at-six",
      comfortProfile: {
        goalKey: "start_dating",
        goalTags: ["dating"],
        primaryGoal: "Start dating again",
      },
      goalTags: ["dating"],
      completedQuestCount: 6,
      blockerMeta: null,
    });

    expect(result.goalClosureDue).toBe(true);
    expect(result.promptBlock).toContain("6 completed quests");
  });
});
