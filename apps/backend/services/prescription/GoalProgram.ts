import type { CapacityTrack } from "../../entities/Sidequest";

export type GoalProgramId =
  | "dating"
  | "homebody_recovery"
  | "community"
  | "hobby"
  | "social_skills";

export type CapabilityStatus =
  | "unavailable"
  | "available"
  | "attempted"
  | "repeatable"
  | "integrated";

export type EnactmentMode = "bfs" | "dfs";

export interface CapabilityNode {
  id: string;
  label: string;
  description: string;
  prerequisites: string[];
  nearTarget?: boolean;
  terminal?: boolean;
  successSignals: string[];
  regressionSignals: string[];
  enactmentPatterns: EnactmentPattern[];
}

export interface EnactmentPattern {
  id: string;
  capabilityId: string;
  label: string;
  description: string;
  modeHint: EnactmentMode;
  capacityTrack: CapacityTrack;
  repShape?: string;
  containerTypes: string[];
  exampleActions: string[];
  difficultyRange: [number, number];
  socialChallengeLevel: "none" | "low" | "medium" | "high";
  directGoalTouch?: boolean;
  goalActionTypes?: string[];
  contraindications?: string[];
}

export interface GoalProgram {
  id: GoalProgramId;
  label: string;
  targetIdentity: string;
  startStatePrompt: string;
  terminalCapabilityId: string;
  goldenLane: string[];
  forbiddenStalls: string[];
  capabilities: CapabilityNode[];
}

export interface QuestContract {
  programId: GoalProgramId;
  capabilityId: string;
  capabilityLabel: string;
  enactmentPatternId: string;
  enactmentPatternLabel: string;
  mode: EnactmentMode;
  capacityTrack: CapacityTrack;
  repShape?: string;
  repIntent: string;
  experienceType: string;
  suggestedCategories: string[];
  searchQueries: string[];
  exampleActions: string[];
  difficultyRange: [number, number];
  socialChallengeLevel: "none" | "low" | "medium" | "high";
  directGoalTouch: boolean;
  allowedGoalActionTypes: string[];
  requiredAction?: string;
  requiredElements?: string[];
  forbiddenActions: string[];
  forbiddenSubstitutions?: string[];
  successCriteria: string[];
  smallerRep?: string;
  tinyRep?: string;
  minimumViableWin?: string;
  exitRamp?: string;
  fallback: string;
  rationale: string;
}

export interface CapabilityEvidence {
  completedQuestCount: number;
  avgRecentRating: number;
  recentStructuredCount: number;
  recentNonSoloCount: number;
  recentDirectGoalTouchCount: number;
  recentDirectDatingRepCount: number;
  recentDraftDatingRepCount: number;
  recentRelationshipEvidenceCount: number;
  recentMilestoneQuestSeen: boolean;
  recentRepPatternIds: string[];
  questsSinceDirectGoalTouch: number | null;
  questsSinceDirectDatingRep: number | null;
}

export interface JourneyCapabilityState {
  program: GoalProgram;
  currentCapability: CapabilityNode;
  currentPattern: EnactmentPattern;
  mode: EnactmentMode;
  status: CapabilityStatus;
  preferredPatterns: EnactmentPattern[];
  questContract: QuestContract;
  cooldownActive: boolean;
  allowTerminalAction: boolean;
  debug: {
    baseCapabilityId: string;
    finalCapabilityId: string;
    promotedByGoalClosure: boolean;
    bridgedToDraftInvite: boolean;
    loweredByBlocker: boolean;
    loweredByRecentDirectRep: boolean;
  };
}

export function findCapability(
  program: GoalProgram,
  capabilityId: string,
): CapabilityNode {
  const capability = program.capabilities.find((c) => c.id === capabilityId);
  if (!capability) {
    throw new Error(
      `Capability "${capabilityId}" not found in goal program "${program.id}"`,
    );
  }
  return capability;
}

export function previousCapability(
  program: GoalProgram,
  capabilityId: string,
): CapabilityNode {
  const index = program.capabilities.findIndex((c) => c.id === capabilityId);
  if (index <= 0) return program.capabilities[0];
  return program.capabilities[index - 1]!;
}

export function nextCapability(
  program: GoalProgram,
  capabilityId: string,
): CapabilityNode {
  const index = program.capabilities.findIndex((c) => c.id === capabilityId);
  if (index < 0 || index >= program.capabilities.length - 1) {
    return program.capabilities[program.capabilities.length - 1]!;
  }
  return program.capabilities[index + 1]!;
}

export function rotatePatternsAwayFromRecent(
  patterns: EnactmentPattern[],
  recentPatternIds: string[],
): EnactmentPattern[] {
  if (patterns.length <= 1) return patterns;
  const latest = recentPatternIds[0];
  if (!latest || patterns[0]?.id !== latest) return patterns;
  return [...patterns.slice(1), patterns[0]!];
}
