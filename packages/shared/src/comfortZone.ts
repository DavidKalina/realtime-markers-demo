export const DEFAULT_COMFORT_RADIUS_MILES = 2.0;
export const MIN_RADIUS_MILES = 0.5;
export const MAX_RADIUS_MILES = 100;

/** How much to expand per completed quest (before pace multiplier) */
export const BASE_EXPANSION_MILES = 0.3;

/** Pace preference → expansion multiplier */
export const PACE_MULTIPLIERS: Record<string, number> = {
  gentle: 0.5,
  steady: 1.0,
  push_me: 1.8,
};
