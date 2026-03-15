export type OnboardingStepType =
  | "info"
  | "interests"
  | "vibes"
  | "ideal_day"
  | "pace"
  | "complete";

export interface OnboardingStep {
  type: OnboardingStepType;
  /** Index into info pages array (only for type "info") */
  infoIndex?: number;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { type: "info", infoIndex: 0 },
  { type: "info", infoIndex: 1 },
  { type: "interests" },
  { type: "vibes" },
  { type: "ideal_day" },
  { type: "pace" },
  { type: "complete" },
];
