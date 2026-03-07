// utils/categoryColors.ts - Canonical category color palette & helpers

import type { Colors } from "@/theme";

/**
 * 10-color palette chosen for dark-theme readability and hue diversity.
 * Every consumer (markers, clusters, filter sheet, charts) must go through
 * getCategoryColor() so the same category name always maps to the same color.
 */
export const CATEGORY_PALETTE = [
  "#93c5fd", // blue
  "#86efac", // green
  "#fcd34d", // amber
  "#c4b5fd", // violet
  "#fda4af", // rose
  "#34d399", // emerald
  "#fbbf24", // yellow
  "#a78bfa", // purple
  "#fb7185", // pink
  "#22d3ee", // cyan
] as const;

/**
 * Deterministic hash → palette index so the same category name always
 * returns the same color regardless of array order or list position.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit int
  }
  return Math.abs(hash);
}

/** Return a single hex color for a category name. */
export function getCategoryColor(name: string): string {
  return CATEGORY_PALETTE[hashString(name) % CATEGORY_PALETTE.length];
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
