// utils/categoryColors.ts - Canonical category color palette & helpers

import type { FoilVariant } from "@/components/effects/HolographicFoil";
import type { Colors } from "@/theme";

/**
 * Explicit category → color mapping for all known categories.
 * Each category gets a visually distinct color on dark backgrounds.
 */
const CATEGORY_COLOR_MAP: Record<string, string> = {
  // Venue categories
  cafe: "#fbbf24", // amber
  coffee: "#fbbf24", // amber (alias)
  restaurant: "#f97316", // orange
  food: "#f97316", // orange (alias)
  bar: "#f472b6", // pink
  nightlife: "#f472b6", // pink (alias)
  brews: "#fb923c", // light orange
  trail: "#4ade80", // green
  hiking: "#4ade80", // green (alias)
  park: "#34d399", // emerald
  outdoors: "#34d399", // emerald (alias)
  walking: "#7dd3fc", // sky accent
  museum: "#c084fc", // violet
  culture: "#c084fc", // violet (alias)
  gallery: "#a78bfa", // purple
  art: "#a78bfa", // purple (alias)
  market: "#fcd34d", // yellow
  thrifting: "#fcd34d", // yellow (alias)
  venue: "#60a5fa", // blue
  music: "#60a5fa", // blue (alias)
  attraction: "#38bdf8", // sky
  sports: "#2dd4bf", // teal
  boarding: "#22d3ee", // cyan
  reading: "#93c5fd", // light blue
  disc_golf: "#a3e635", // lime
  other: "#94a3b8", // slate
};

/**
 * Fallback palette for unknown categories, indexed by hash.
 */
export const CATEGORY_PALETTE = [
  "#93c5fd",
  "#7dd3fc",
  "#fcd34d",
  "#c4b5fd",
  "#fda4af",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#fb7185",
  "#22d3ee",
] as const;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Category → preferred foil variant mapping.
 * Each category has a "vibe" variant it prefers. When rarity allows it,
 * this variant is used. Otherwise it falls back to the rarity pool.
 */
const CATEGORY_FOIL_MAP: Record<string, FoilVariant> = {
  // Warm social → mythic
  restaurant: "mythic",
  food: "mythic",

  // Bars / brews → ember
  bar: "ember",
  brews: "ember",

  // Nature trails → aurora
  trail: "aurora",
  hiking: "aurora",
  outdoors: "aurora",
  sports: "aurora",
  disc_golf: "aurora",

  // Parks / walking → holographic
  park: "holographic",
  walking: "holographic",

  // Culture / arts → prismatic
  museum: "prismatic",
  culture: "prismatic",
  gallery: "prismatic",
  art: "prismatic",
  attraction: "prismatic",

  // Chill / browsing → chrome
  cafe: "chrome",
  coffee: "chrome",
  reading: "chrome",
  market: "chrome",
  thrifting: "chrome",

  // Music / venues → stardust
  music: "stardust",
  venue: "stardust",

  // High energy → speckled
  nightlife: "speckled",
  boarding: "speckled",

  // Water / coastal → cosmic_ocean
  beach: "cosmic_ocean",
  swimming: "cosmic_ocean",
  fishing: "cosmic_ocean",

  // Desert / markets / vintage → grainy_sahara
  thrift: "grainy_sahara",
  antique: "grainy_sahara",
  flea_market: "grainy_sahara",

  // Camping / nature at night → ember_forest
  camping: "ember_forest",
  bonfire: "ember_forest",
  stargazing: "ember_forest",

  // Underground / niche → noisy_cavern
  arcade: "noisy_cavern",
  escape_room: "noisy_cavern",
  brewery: "noisy_cavern",
};

/**
 * Rarity → foil variant pools, ordered subtle → dramatic.
 * Category preference picks within the pool when possible.
 */
const RARITY_FOIL_POOLS: Record<string, FoilVariant[]> = {
  common: ["stardust", "chrome"],
  uncommon: ["holographic", "speckled", "grainy_sahara"],
  rare: ["prismatic", "ember", "ember_forest"],
  epic: ["aurora", "cosmic_ocean", "noisy_cavern"],
  legendary: ["mythic"],
};

const ALL_FOIL_VARIANTS: FoilVariant[] = [
  "holographic",
  "speckled",
  "chrome",
  "prismatic",
  "ember",
  "aurora",
  "stardust",
  "mythic",
  "cosmic_ocean",
  "grainy_sahara",
  "ember_forest",
  "noisy_cavern",
];

/**
 * Pick a foil variant based on rarity + category + distance.
 *
 * - Rarity determines the pool (common = subtle, legendary = mythic).
 * - If the category's preferred variant lives in that pool, use it.
 * - Otherwise, distance seeds a hash to pick from the pool.
 */
export function getFoilVariant(
  rarity: string | undefined,
  category: string | undefined,
  distanceFromHome: number | undefined,
): FoilVariant {
  const rarityKey = (rarity ?? "common").toLowerCase();
  const pool = RARITY_FOIL_POOLS[rarityKey] ?? RARITY_FOIL_POOLS.common;

  // Check if category's preferred variant is available in this rarity pool
  if (category) {
    const preferred = CATEGORY_FOIL_MAP[category.toLowerCase().trim()];
    if (preferred && pool.includes(preferred)) {
      return preferred;
    }
  }

  // Fall back: use distance + category to pick from the pool
  const seed = hashString(
    `${category ?? "x"}-${Math.round(distanceFromHome ?? 0)}`,
  );
  return pool[seed % pool.length];
}

/** @deprecated Use getFoilVariant instead */
export function getCategoryFoilVariant(name: string): FoilVariant {
  const key = name.toLowerCase().trim();
  return CATEGORY_FOIL_MAP[key] ?? ALL_FOIL_VARIANTS[hashString(key) % ALL_FOIL_VARIANTS.length];
}

/** Return a single hex color for a category name. */
export function getCategoryColor(name: string): string {
  const key = name.toLowerCase().trim();
  return (
    CATEGORY_COLOR_MAP[key] ??
    CATEGORY_PALETTE[hashString(key) % CATEGORY_PALETTE.length]
  );
}

/** Darken a hex color by a factor (0-1, where 0 = black). */
function darken(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = Math.max(0, Math.min(1, factor));
  return `#${Math.round(r * f)
    .toString(16)
    .padStart(2, "0")}${Math.round(g * f)
    .toString(16)
    .padStart(2, "0")}${Math.round(b * f)
    .toString(16)
    .padStart(2, "0")}`;
}

/** MarkerSVG-compatible color scheme derived from a category name. */
export function getCategoryColorScheme(
  colors: Colors,
  name?: string,
): {
  fill: string;
  stroke: string;
  circleStroke: string;
  text: string;
} {
  if (!name) {
    return {
      fill: colors.bg.primary,
      stroke: colors.fixed.white,
      circleStroke: colors.brand.markerStroke,
      text: colors.text.primary,
    };
  }
  const base = getCategoryColor(name);
  return {
    fill: base,
    stroke: darken(base, 0.6),
    circleStroke: darken(base, 0.5),
    text: colors.text.primary,
  };
}

/**
 * Given an array of child marker IDs and a lookup map (markerId → primary category),
 * return the most common category among the children, or null if none have categories.
 */
export function getDominantCategory(
  childIds: string[],
  lookup: Map<string, string>,
): string | null {
  const counts = new Map<string, number>();
  for (const id of childIds) {
    const cat = lookup.get(id);
    if (cat) {
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
  }
  if (counts.size === 0) return null;

  let best = "";
  let bestCount = 0;
  for (const [cat, count] of counts) {
    if (count > bestCount) {
      best = cat;
      bestCount = count;
    }
  }
  return best;
}
