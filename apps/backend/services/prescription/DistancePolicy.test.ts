import { describe, expect, test } from "bun:test";
import { RejectionReason } from "../../entities/SidequestRejection";
import {
  REGIONAL_FLOOR_MILES,
  classifyScope,
  resolveDistancePolicy,
  type DistancePolicyInput,
} from "./DistancePolicy";

function baseInput(
  overrides: Partial<DistancePolicyInput> = {},
): DistancePolicyInput {
  return {
    radius: 4,
    isEarlyCalibration: false,
    completedQuestCount: 10,
    lastRejectionReason: null,
    rejectionPatternReason: null,
    goalClosureDue: false,
    regionalInfrastructureEligible: false,
    strategyMaxDistance: 8,
    ...overrides,
  };
}

describe("resolveDistancePolicy — early calibration", () => {
  test("clamps strategy max to the user's comfort radius", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        isEarlyCalibration: true,
        completedQuestCount: 1,
        radius: 2,
        strategyMaxDistance: 10,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(2);
    expect(policy.scope).toBe("local_home_base");
    expect(policy.wasClampedByRejection).toBe(false);
    expect(policy.shouldFrameTravel).toBe(false);
  });

  test("leaves strategy max alone when already inside radius", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        isEarlyCalibration: true,
        completedQuestCount: 2,
        radius: 5,
        strategyMaxDistance: 3,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(3);
    expect(policy.scope).toBe("local_home_base");
  });

  test("suppresses regional floor even when goal closure is due", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        isEarlyCalibration: true,
        completedQuestCount: 3,
        radius: 2,
        goalClosureDue: true,
        regionalInfrastructureEligible: true,
        strategyMaxDistance: 20,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(2);
    expect(policy.scope).toBe("local_home_base");
  });
});

describe("resolveDistancePolicy — fresh rejection clamps", () => {
  test("TOO_FAR clamps to max(1, radius * 0.75)", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 4,
        strategyMaxDistance: 15,
        lastRejectionReason: RejectionReason.TOO_FAR,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(3);
    expect(policy.wasClampedByRejection).toBe(true);
    expect(policy.scope).toBe("clamped_home");
    expect(policy.shouldFrameTravel).toBe(false);
  });

  test("TOO_FAR respects the 1-mile floor", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 1,
        strategyMaxDistance: 10,
        lastRejectionReason: RejectionReason.TOO_FAR,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(1);
    expect(policy.scope).toBe("clamped_home");
  });

  test("NEED_GENTLER clamps distance to max(1, radius)", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 3,
        strategyMaxDistance: 12,
        lastRejectionReason: RejectionReason.NEED_GENTLER,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(3);
    expect(policy.wasClampedByRejection).toBe(true);
    expect(policy.scope).toBe("clamped_home");
  });

  test("rejections that are not distance-related do not clamp distance", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 4,
        strategyMaxDistance: 9,
        lastRejectionReason: RejectionReason.TOO_PUBLIC,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(9);
    expect(policy.wasClampedByRejection).toBe(false);
    expect(policy.scope).toBe("nearby_social_zone");
  });
});

describe("resolveDistancePolicy — rejection pattern clamps", () => {
  test("TOO_FAR pattern clamps harder than fresh — radius * 0.5", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 4,
        strategyMaxDistance: 20,
        rejectionPatternReason: RejectionReason.TOO_FAR,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(2);
    expect(policy.wasClampedByRejection).toBe(true);
    expect(policy.scope).toBe("clamped_home");
  });

  test("TOO_FAR pattern stacks with fresh TOO_FAR — takes the tighter clamp", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 4,
        strategyMaxDistance: 20,
        lastRejectionReason: RejectionReason.TOO_FAR,
        rejectionPatternReason: RejectionReason.TOO_FAR,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(2);
    expect(policy.wasClampedByRejection).toBe(true);
    expect(policy.scope).toBe("clamped_home");
  });
});

describe("resolveDistancePolicy — regional infrastructure allowance", () => {
  test("raises to regional floor when goal is people-rich and user has 5+ quests", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 3,
        strategyMaxDistance: 5,
        completedQuestCount: 6,
        regionalInfrastructureEligible: true,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(REGIONAL_FLOOR_MILES);
    expect(policy.scope).toBe("regional_opportunity");
    expect(policy.shouldFrameTravel).toBe(true);
    expect(policy.travelRationale).not.toBeNull();
  });

  test("does not raise below 5 completed quests", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 3,
        strategyMaxDistance: 5,
        completedQuestCount: 4,
        regionalInfrastructureEligible: true,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(5);
    expect(policy.scope).toBe("nearby_social_zone");
  });

  test("TOO_FAR fresh rejection suppresses regional allowance", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 4,
        strategyMaxDistance: 20,
        completedQuestCount: 10,
        regionalInfrastructureEligible: true,
        lastRejectionReason: RejectionReason.TOO_FAR,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(3);
    expect(policy.scope).toBe("clamped_home");
    expect(policy.shouldFrameTravel).toBe(false);
  });

  test("TOO_FAR pattern suppresses regional allowance", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 4,
        strategyMaxDistance: 20,
        completedQuestCount: 10,
        regionalInfrastructureEligible: true,
        rejectionPatternReason: RejectionReason.TOO_FAR,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(2);
    expect(policy.scope).toBe("clamped_home");
  });

  test("NEED_GENTLER fresh rejection suppresses regional allowance", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 4,
        strategyMaxDistance: 20,
        completedQuestCount: 10,
        regionalInfrastructureEligible: true,
        lastRejectionReason: RejectionReason.NEED_GENTLER,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(4);
    expect(policy.scope).toBe("clamped_home");
  });
});

describe("resolveDistancePolicy — goal closure milestones", () => {
  test("goal closure raises to regional floor when not clamped", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 3,
        strategyMaxDistance: 6,
        completedQuestCount: 8,
        goalClosureDue: true,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(REGIONAL_FLOOR_MILES);
    expect(policy.scope).toBe("regional_opportunity");
    expect(policy.shouldFrameTravel).toBe(true);
    expect(policy.travelRationale).not.toBeNull();
  });

  test("goal closure keeps higher strategy max when strategist already pushed", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 3,
        strategyMaxDistance: 22,
        completedQuestCount: 8,
        goalClosureDue: true,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(22);
    expect(policy.scope).toBe("regional_opportunity");
  });

  test("goal closure suppressed by fresh TOO_FAR rejection", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 4,
        strategyMaxDistance: 20,
        completedQuestCount: 10,
        goalClosureDue: true,
        lastRejectionReason: RejectionReason.TOO_FAR,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(3);
    expect(policy.scope).toBe("clamped_home");
  });

  test("goal closure suppressed by TOO_FAR pattern", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 4,
        strategyMaxDistance: 20,
        completedQuestCount: 10,
        goalClosureDue: true,
        rejectionPatternReason: RejectionReason.TOO_FAR,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(2);
    expect(policy.scope).toBe("clamped_home");
  });

  test("goal closure suppressed by fresh NEED_GENTLER rejection", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 4,
        strategyMaxDistance: 20,
        completedQuestCount: 10,
        goalClosureDue: true,
        lastRejectionReason: RejectionReason.NEED_GENTLER,
      }),
    );
    expect(policy.maxDistanceMiles).toBe(4);
    expect(policy.scope).toBe("clamped_home");
  });
});

describe("resolveDistancePolicy — travel framing", () => {
  test("local_home_base does not ask the writer to frame travel", () => {
    const policy = resolveDistancePolicy(
      baseInput({ radius: 5, strategyMaxDistance: 3 }),
    );
    expect(policy.scope).toBe("local_home_base");
    expect(policy.shouldFrameTravel).toBe(false);
    expect(policy.travelRationale).toBeNull();
  });

  test("nearby_social_zone asks the writer to frame travel", () => {
    const policy = resolveDistancePolicy(
      baseInput({ radius: 3, strategyMaxDistance: 10 }),
    );
    expect(policy.scope).toBe("nearby_social_zone");
    expect(policy.shouldFrameTravel).toBe(true);
    expect(policy.travelRationale).not.toBeNull();
  });

  test("clamped_home never frames travel regardless of distance", () => {
    const policy = resolveDistancePolicy(
      baseInput({
        radius: 10,
        strategyMaxDistance: 20,
        lastRejectionReason: RejectionReason.TOO_FAR,
      }),
    );
    expect(policy.scope).toBe("clamped_home");
    expect(policy.shouldFrameTravel).toBe(false);
    expect(policy.travelRationale).toBeNull();
  });
});

describe("classifyScope — realized venue distance", () => {
  test("within max(radius+0.25, 4) is local_home_base", () => {
    expect(classifyScope(2.5, 2, false)).toBe("local_home_base");
    expect(classifyScope(4, 2, false)).toBe("local_home_base");
    expect(classifyScope(6, 6, false)).toBe("local_home_base");
  });

  test("between local ceiling and 12 is nearby_social_zone", () => {
    expect(classifyScope(8, 2, false)).toBe("nearby_social_zone");
    expect(classifyScope(12, 2, false)).toBe("nearby_social_zone");
  });

  test("beyond 12 is regional_opportunity", () => {
    expect(classifyScope(15, 3, false)).toBe("regional_opportunity");
    expect(classifyScope(25, 3, false)).toBe("regional_opportunity");
  });

  test("wasClampedByRejection reports clamped_home even when venue is local", () => {
    expect(classifyScope(1.5, 4, true)).toBe("clamped_home");
    expect(classifyScope(3, 4, true)).toBe("clamped_home");
  });
});
