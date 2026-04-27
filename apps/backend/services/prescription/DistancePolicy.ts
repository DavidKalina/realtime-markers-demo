/**
 * DistancePolicy — the single source of truth for how far a quest may travel.
 *
 * Before this module lived here, distance logic was split across five clamp
 * blocks in MultiAgentStrategy, a scope classifier, a validator filter, and a
 * retry-on-TOO_FAR shortcut. That made it hard to predict which rule would
 * win when (early calibration vs. TOO_FAR fresh vs. pattern vs. goal closure).
 *
 * This module folds those rules into one pure function the strategist,
 * scout, validator, writer, and simulator all read from.
 */

import { RejectionReason } from "../../entities/SidequestRejection";

export type OpportunityScope =
  | "local_home_base"
  | "nearby_social_zone"
  | "regional_opportunity"
  | "clamped_home";

export interface DistancePolicyInput {
  /** User's current comfort radius in miles. */
  radius: number;
  /** True when the user has <5 completed quests and the trust-over-growth rules apply. */
  isEarlyCalibration: boolean;
  /** Completed quest count; drives the regional-infrastructure gate. */
  completedQuestCount: number;
  /** The most recent single rejection reason, if any (same-session recalibration). */
  lastRejectionReason?: string | null;
  /** The recurring rejection pattern reason, if any (3+ of the same in last 5). */
  rejectionPatternReason?: string | null;
  /** True when the active goal-closure milestone is due (e.g. dating-intent rep). */
  goalClosureDue: boolean;
  /**
   * True when the goal context suggests people-rich infrastructure the user's
   * home base may lack (dating, classes, clubs, meetups, workshops, etc.).
   * The caller is responsible for the keyword match — the policy only owns
   * the distance math.
   */
  regionalInfrastructureEligible: boolean;
  /** maxDistanceMiles the strategist LLM proposed. The policy may clamp or raise it. */
  strategyMaxDistance: number;
}

export interface DistancePolicyDecision {
  /** Intent scope — what kind of geography the quest is allowed to touch. */
  scope: OpportunityScope;
  /** Hard ceiling used by scout search, validator, and retry logic. */
  maxDistanceMiles: number;
  /** Generic rationale for the writer; null when travel should not be framed. */
  travelRationale: string | null;
  /** True when a TOO_FAR / NEED_GENTLER signal pulled the ceiling toward home. */
  wasClampedByRejection: boolean;
  /** True when the writer should name the travel as part of the rep. */
  shouldFrameTravel: boolean;
}

export const REGIONAL_FLOOR_MILES = 18;
const LOCAL_CEILING_FLOOR_MILES = 4;
const NEARBY_CEILING_MILES = 12;
const MIN_CLAMPED_MILES = 1;

const TRAVEL_RATIONALE_REGIONAL =
  "Local options may be too thin for this goal — the travel is part of the growth rep and should be named in the difficulty.";
const TRAVEL_RATIONALE_NEARBY =
  "Brief travel to a nearby area — include the trip in the difficulty framing.";

/**
 * Resolve the intent-scope policy for a prescription attempt.
 *
 * Precedence (highest wins):
 *   1. Early calibration clamps to the user's comfort radius.
 *   2. Rejection clamps (TOO_FAR pattern → radius*0.5, fresh TOO_FAR → radius*0.75,
 *      fresh NEED_GENTLER → radius); all mark wasClampedByRejection.
 *   3. Regional floor (18mi) applies only when NOT clamped and either
 *      goalClosureDue or regionalInfrastructureEligible with 5+ quests.
 *   4. Otherwise the strategist's proposal stands.
 *
 * NOTE: NEED_GENTLER currently clamps distance unconditionally. The underlying
 * rejection signal does not disambiguate "travel load" from "interaction load".
 * When that signal exists, this function should skip the distance clamp when
 * interaction — not travel — was the issue.
 */
export function resolveDistancePolicy(
  input: DistancePolicyInput,
): DistancePolicyDecision {
  const {
    radius,
    isEarlyCalibration,
    completedQuestCount,
    lastRejectionReason,
    rejectionPatternReason,
    goalClosureDue,
    regionalInfrastructureEligible,
    strategyMaxDistance,
  } = input;

  let maxDistance = strategyMaxDistance;
  let wasClampedByRejection = false;

  if (isEarlyCalibration) {
    maxDistance = Math.min(maxDistance, radius);
  }

  if (rejectionPatternReason === RejectionReason.TOO_FAR) {
    maxDistance = Math.min(maxDistance, radius * 0.5);
    wasClampedByRejection = true;
  }

  if (lastRejectionReason === RejectionReason.TOO_FAR) {
    maxDistance = Math.min(
      maxDistance,
      Math.max(MIN_CLAMPED_MILES, radius * 0.75),
    );
    wasClampedByRejection = true;
  } else if (lastRejectionReason === RejectionReason.NEED_GENTLER) {
    maxDistance = Math.min(maxDistance, Math.max(MIN_CLAMPED_MILES, radius));
    wasClampedByRejection = true;
  }

  const regionalEligibleByInfra =
    !isEarlyCalibration &&
    completedQuestCount >= 5 &&
    regionalInfrastructureEligible;
  const regionalEligibleByGoal = !isEarlyCalibration && goalClosureDue;

  if (
    !wasClampedByRejection &&
    (regionalEligibleByInfra || regionalEligibleByGoal)
  ) {
    maxDistance = Math.max(maxDistance, REGIONAL_FLOOR_MILES);
  }

  const scope = resolveIntentScope({
    maxDistance,
    radius,
    wasClampedByRejection,
    regionalRaised:
      !wasClampedByRejection &&
      (regionalEligibleByInfra || regionalEligibleByGoal) &&
      maxDistance >= REGIONAL_FLOOR_MILES,
  });

  const { travelRationale, shouldFrameTravel } = framingFor(scope);

  return {
    scope,
    maxDistanceMiles: maxDistance,
    travelRationale,
    wasClampedByRejection,
    shouldFrameTravel,
  };
}

/**
 * Classify a realized venue distance after a winner is picked.
 * Used by the writer framing and the simulator metrics — different from
 * resolveDistancePolicy which classifies the intent, not the realized venue.
 */
export function classifyScope(
  distanceMiles: number,
  radius: number,
  wasClampedByRejection: boolean,
): OpportunityScope {
  if (wasClampedByRejection) return "clamped_home";
  const localCeiling = Math.max(radius + 0.25, LOCAL_CEILING_FLOOR_MILES);
  if (distanceMiles <= localCeiling) return "local_home_base";
  if (distanceMiles <= NEARBY_CEILING_MILES) return "nearby_social_zone";
  return "regional_opportunity";
}

function resolveIntentScope(args: {
  maxDistance: number;
  radius: number;
  wasClampedByRejection: boolean;
  regionalRaised: boolean;
}): OpportunityScope {
  if (args.wasClampedByRejection) return "clamped_home";
  if (args.regionalRaised) return "regional_opportunity";
  const localCeiling = Math.max(args.radius + 0.25, LOCAL_CEILING_FLOOR_MILES);
  if (args.maxDistance <= localCeiling) return "local_home_base";
  if (args.maxDistance <= NEARBY_CEILING_MILES) return "nearby_social_zone";
  return "regional_opportunity";
}

function framingFor(scope: OpportunityScope): {
  travelRationale: string | null;
  shouldFrameTravel: boolean;
} {
  switch (scope) {
    case "local_home_base":
    case "clamped_home":
      return { travelRationale: null, shouldFrameTravel: false };
    case "nearby_social_zone":
      return {
        travelRationale: TRAVEL_RATIONALE_NEARBY,
        shouldFrameTravel: true,
      };
    case "regional_opportunity":
      return {
        travelRationale: TRAVEL_RATIONALE_REGIONAL,
        shouldFrameTravel: true,
      };
  }
}

/**
 * Surface-layer label for the scope, used for logs / prompt framing.
 */
export function opportunityScopeLabel(scope: OpportunityScope): string {
  switch (scope) {
    case "local_home_base":
      return "local home-base";
    case "nearby_social_zone":
      return "nearby social-zone";
    case "regional_opportunity":
      return "regional opportunity";
    case "clamped_home":
      return "pulled-back home-base";
  }
}
