import { describe, expect, test } from "bun:test";
import {
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
});
