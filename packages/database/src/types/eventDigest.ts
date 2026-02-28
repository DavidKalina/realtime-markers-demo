export interface EventDigest {
  summary: string; // 1-2 sentence overview (always present)
  cost: string | null; // Price/admission info, null if free/unknown
  highlights: string[] | null; // Practical bullet items (max 5), null if none
  contact: string | null; // Contact info, social media, website
}
