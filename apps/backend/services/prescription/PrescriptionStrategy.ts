/**
 * Strategy interface for quest prescription.
 * Abstracts monolithic (single-agent) vs multi-agent approaches
 * so they can be A/B tested with the same input/output contract.
 */

import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
import type { SidequestProgressCallback } from "../SidequestPrescriptionService";
import type { VerifiedVenue } from "../shared/GoogleGeocodingService";
import type { Trail } from "../shared/OverpassService";

// ── LLM Response types (shared output contract) ─────────────

export interface LLMItemRaw {
  t: string;    // title
  d: string;    // description
  e: string;    // emoji
  ec: number | null; // estimated cost
  vn: string;   // venue name
  va: string;   // venue address
  eid: string | null; // event ID
  vc: string;   // venue category
  hook: string;
  sa: string[] | null; // suggested activities
  ai: string[] | null; // action items
  jp: string | null;   // journal prompt
  df: number;   // difficulty
  act: string;  // actionability
}

export interface LLMResponseRaw {
  t: string;       // title
  s: string;       // summary
  items: LLMItemRaw[];
}

// ── Strategy input/output ───────────────────────────────────

export interface PrescriptionStrategyInput {
  promptContext: PrescriptionPromptContext;
  promptVersion: string;
  city: string;
  searchLat: number;
  searchLng: number;
  radius: number;
  prescriptionModel?: string;
  inputModelOverride?: string;
  onProgress?: SidequestProgressCallback;
}

export interface PrescriptionStrategyResult {
  raw: LLMResponseRaw;
  allVenues: VerifiedVenue[];
  allTrails: Trail[];
}

export interface PrescriptionStrategy {
  execute(input: PrescriptionStrategyInput): Promise<PrescriptionStrategyResult>;
}

// ── Multi-agent intermediate types ──────────────────────────

export interface StrategyBrief {
  experienceType: string;
  suggestedCategories: string[];
  targetCity: string;
  maxDistanceMiles: number;
  difficultyRange: [number, number];
  socialChallengeLevel: "none" | "low" | "medium" | "high";
  searchQueries: string[];
  avoidVenues: string[];
  avoidCategories: string[];
  rationale: string;
}

export interface ScoutCandidate {
  venueName: string;
  venueAddress: string;
  venueCategory: string;
  latitude: number;
  longitude: number;
  rating?: number;
  distanceFromHome?: number;
  source: "search_places" | "search_trails" | "web_search";
  notes?: string;
}

export interface ScoutResult {
  candidates: ScoutCandidate[];
  allVenues: VerifiedVenue[];
  allTrails: Trail[];
}

export interface ValidationResult {
  accepted: boolean;
  winner?: ScoutCandidate;
  rejectionReasons: string[];
  constraintsForRetry?: string;
}
