export interface TierInfo {
  name: string;
  minXp: number;
  emoji: string;
}

export const TIERS: TierInfo[] = [
  { name: "Explorer", minXp: 0, emoji: "\u{1F9ED}" },
  { name: "Scout", minXp: 500, emoji: "\u{1F52D}" },
  { name: "Curator", minXp: 2000, emoji: "\u2B50" },
  { name: "Ambassador", minXp: 5000, emoji: "\u{1F451}" },
];

export function getTierForXP(xp: number): TierInfo {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (xp >= TIERS[i].minXp) {
      return TIERS[i];
    }
  }
  return TIERS[0];
}

export function getTierByName(name: string): TierInfo {
  return TIERS.find((t) => t.name === name) || TIERS[0];
}

export function getNextTierThreshold(xp: number): number | null {
  for (const tier of TIERS) {
    if (xp < tier.minXp) {
      return tier.minXp;
    }
  }
  return null; // Max tier reached
}

export function getXPProgressPercent(xp: number): number {
  const currentTier = getTierForXP(xp);
  const nextThreshold = getNextTierThreshold(xp);

  if (nextThreshold === null) {
    return 100; // Max tier
  }

  const currentMin = currentTier.minXp;
  const range = nextThreshold - currentMin;
  const progress = xp - currentMin;

  return Math.min(100, Math.round((progress / range) * 100));
}
