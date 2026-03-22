import type { DistrictBrowseResponse } from "@/services/api/modules/districts";

export const TAG_EMOJI: Record<string, string> = {
  coffee: "\u2615",
  cafe: "\u2615",
  restaurant: "\u{1F37D}\uFE0F",
  food: "\u{1F37D}\uFE0F",
  dining: "\u{1F37D}\uFE0F",
  bar: "\u{1F378}",
  drinks: "\u{1F378}",
  nightlife: "\u{1F378}",
  park: "\u{1F333}",
  nature: "\u{1F333}",
  outdoors: "\u{1F333}",
  hiking: "\u{1F97E}",
  trail: "\u{1F6B6}",
  museum: "\u{1F3DB}\uFE0F",
  gallery: "\u{1F5BC}\uFE0F",
  art: "\u{1F3A8}",
  market: "\u{1F6D2}",
  shopping: "\u{1F6CD}\uFE0F",
  music: "\u{1F3B5}",
  venue: "\u{1F3A4}",
  fitness: "\u{1F3CB}\uFE0F",
  gym: "\u{1F3CB}\uFE0F",
  yoga: "\u{1F9D8}",
  wellness: "\u{1F9D8}",
  beach: "\u{1F3D6}\uFE0F",
  water: "\u{1F30A}",
  brewery: "\u{1F37A}",
  bakery: "\u{1F950}",
  books: "\u{1F4DA}",
  library: "\u{1F4DA}",
  sports: "\u26BD",
  theater: "\u{1F3AD}",
  cinema: "\u{1F3AC}",
  attraction: "\u{1F3A0}",
};

export const TAG_COLOR: Record<string, string> = {
  // Food & drink — warm amber
  coffee: "#d97706",
  cafe: "#d97706",
  restaurant: "#d97706",
  food: "#d97706",
  dining: "#d97706",
  bakery: "#d97706",
  bar: "#c026d3",
  drinks: "#c026d3",
  nightlife: "#c026d3",
  brewery: "#d97706",
  // Nature & outdoors — earthy green
  park: "#16a34a",
  nature: "#16a34a",
  outdoors: "#16a34a",
  hiking: "#16a34a",
  trail: "#16a34a",
  beach: "#0891b2",
  water: "#0891b2",
  // Culture & arts — blue
  museum: "#2563eb",
  gallery: "#2563eb",
  art: "#2563eb",
  theater: "#2563eb",
  cinema: "#2563eb",
  books: "#2563eb",
  library: "#2563eb",
  // Music & entertainment — purple
  music: "#7c3aed",
  venue: "#7c3aed",
  attraction: "#7c3aed",
  // Shopping — pink
  market: "#db2777",
  shopping: "#db2777",
  // Fitness & wellness — teal
  fitness: "#0d9488",
  gym: "#0d9488",
  yoga: "#0d9488",
  wellness: "#0d9488",
  // Sports — orange
  sports: "#ea580c",
};

const DEFAULT_DISTRICT_COLOR = "#6b7280"; // neutral gray

const DEFAULT_TAG_COLOR = "#6b7280";

/** Returns a color for a single activity tag. */
export function getTagColor(tag: string): string {
  const key = tag.toLowerCase();
  if (TAG_COLOR[key]) return TAG_COLOR[key];
  for (const [k, v] of Object.entries(TAG_COLOR)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return DEFAULT_TAG_COLOR;
}

export function getDistrictColor(district: DistrictBrowseResponse): string {
  for (const tag of district.activityTags) {
    const key = tag.toLowerCase();
    if (TAG_COLOR[key]) return TAG_COLOR[key];
    for (const [k, v] of Object.entries(TAG_COLOR)) {
      if (key.includes(k) || k.includes(key)) return v;
    }
  }
  return DEFAULT_DISTRICT_COLOR;
}

export function getDistrictEmoji(district: DistrictBrowseResponse): string {
  // Try matching top activity tag
  for (const tag of district.activityTags) {
    const key = tag.toLowerCase();
    if (TAG_EMOJI[key]) return TAG_EMOJI[key];
    // Partial match
    for (const [k, v] of Object.entries(TAG_EMOJI)) {
      if (key.includes(k) || k.includes(key)) return v;
    }
  }

  // Fall back to first preview itinerary item emoji
  for (const preview of district.previewItineraries) {
    const firstEmoji = preview.items?.[0]?.emoji;
    if (firstEmoji) return firstEmoji;
  }

  return "\u{1F4CD}"; // pin fallback
}
