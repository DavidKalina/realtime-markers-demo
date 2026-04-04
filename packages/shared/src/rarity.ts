export const RARITY_TIERS = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
] as const;

export type Rarity = (typeof RARITY_TIERS)[number];

/** Bump a rarity up by one tier. Returns the same tier if already legendary. */
export function boostRarity(rarity: Rarity): Rarity {
  const idx = RARITY_TIERS.indexOf(rarity);
  return idx < RARITY_TIERS.length - 1 ? RARITY_TIERS[idx + 1] : rarity;
}
