/**
 * Shared types for quest prescription.
 */

import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
import type { SidequestProgressCallback } from "../SidequestPrescriptionService";
import type { VerifiedVenue } from "../shared/GooglePlacesService";
import type { Trail } from "../shared/OverpassService";
import type { CapacityTrack } from "../../entities/Sidequest";
import type { OpportunityScope } from "./DistancePolicy";
import type { DatingRepShape, DatingStage } from "./DatingProgressionPolicy";
import type { QuestContract } from "./GoalProgram";
import type { SearchEnvelope } from "./SearchEnvelope";

// ── LLM Response types (shared output contract) ─────────────

export interface LLMItemRaw {
  t: string; // title
  d: string; // description (the full rep)
  e: string; // emoji
  ec: number | null; // estimated cost
  vn: string; // venue name
  va: string; // venue address
  eid: string | null; // event ID
  vc: string; // venue category
  hook: string;
  sa: string[] | null; // suggested activities
  ai: string[] | null; // action items
  jp: string | null; // journal prompt
  df: number; // difficulty
  act: string; // actionability
  // ── Rep variants (Slice A) ─────────────────────────────
  sr?: string | null; // smaller rep — reduced-intensity version
  tr?: string | null; // tiny rep — minimum viable action
  mvw?: string | null; // minimum viable win — what counts as "I did the thing"
  er?: string | null; // exit ramp — how to leave without failure
  dgt?: boolean | null; // direct goal touch — true when the full rep directly advances named goal
  gat?: string | null; // goal action type — see Sidequest.goalActionType
}

export interface LLMResponseRaw {
  t: string; // title
  s: string; // summary
  sn?: string; // strategy note — why this quest was chosen for this user
  mr?: string | null; // market reflection — what the system sees about market viability for this goal
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
  /** Dev tracer context. NOOP_TRACE when tracing is disabled. */
  trace?: import("../TraceCollector").TraceContext;
}

export interface PrescriptionStrategyResult {
  raw: LLMResponseRaw;
  allVenues: VerifiedVenue[];
  allTrails: Trail[];
  /** Slice C — capacity rep picked by the strategist. Persisted onto the
   *  sidequest so downstream UI + analytics can attribute the completion. */
  brief: StrategyBrief;
}

// ── Multi-agent intermediate types ──────────────────────────

export interface StrategyBrief {
  /** Slice C — capacity muscle being trained. Picked BEFORE the venue. */
  capacityTrack: CapacityTrack;
  /** One-line description of the specific rep, in capacity terms. */
  repIntent: string;
  experienceType: string;
  suggestedCategories: string[];
  targetCity: string;
  maxDistanceMiles: number;
  difficultyRange: [number, number];
  socialChallengeLevel: "none" | "low" | "medium" | "high";
  searchQueries: string[];
  /** When the Strategist recommends returning to a known anchor venue, its name goes here. */
  preferredVenue?: string;
  avoidVenues: string[];
  avoidCategories: string[];
  /** When to do this quest, e.g. "weekday evening after work", "Saturday morning" */
  suggestedTiming: string;
  rationale: string;
  /** Geographic intent selected by DistancePolicy / post-validation. Internal only. */
  opportunityScope?: OpportunityScope;
  /** Why this quest is worth any travel beyond the user's home base. */
  travelRationale?: string;
  /** Search envelope: home-centered search radius + query families + soft zone hints. */
  searchEnvelope?: SearchEnvelope;
  /**
   * Quality profile for the desired venue, in qualitative language
   * (people-rich, drop-in-friendly, low-social-pressure, etc.) instead of
   * fixed categories. The Strategist composes this from policy priors and
   * the LLM may refine it; the Validator checks candidate venues against it.
   */
  venueQualities?: import("./VenueQualities").VenueQualityProfile;
  /**
   * Web-research verification of the chosen winner. Stashed here so the
   * Writer can quote real hours / pricing / events instead of generic
   * placeholders. Set after the Validator picks but before the Writer runs.
   */
  venueVerification?: import("./WinnerVerificationAgent").VenueVerification;
  /** Dating ladder metadata — internal planning only. */
  datingStage?: DatingStage;
  datingRepShape?: DatingRepShape;
  allowDirectDatingRep?: boolean;
  preferredDatingRepShapes?: DatingRepShape[];
  questContract?: QuestContract;
  /** Compact debug trace for why a venue was selected. */
  venueSelectionTrace?: VenueSelectionTrace;
}

/**
 * Canonical venue categories. The Scout must pick from this list.
 * Pathway detection, diversity enforcement, and venue repeat logic all
 * depend on consistent category strings — free-text categories fragment
 * pathways and prevent "becoming a regular" from being detected.
 */
export const VENUE_CATEGORIES = [
  // Food & Drink
  "Coffee Shop",
  "Restaurant",
  "Brunch Spot",
  "Brewery / Taproom",
  "Bar",
  "Bakery / Dessert Shop",
  "Food Market / Farmers Market",

  // Social & Games
  "Board Game Venue",
  "Arcade / Entertainment",
  "Bowling Alley",
  "Karaoke Venue",

  // Arts & Culture
  "Art Gallery",
  "Art Studio / Workshop",
  "Theatre / Performing Arts",
  "Music Venue / Concert Hall",
  "Museum",
  "Bookstore",
  "Library",

  // Fitness & Outdoors
  "Gym / Fitness Studio",
  "Yoga / Pilates Studio",
  "Climbing Gym",
  "Trail / Park",
  "Recreation Center",
  "Sports Club",
  "Disc Golf / Outdoor Activity",

  // Learning & Community
  "Maker Space",
  "Community Center",
  "Coworking Space",
  "College / Adult Education",
  "Workshop / Class Venue",

  // Retail & Specialty
  "Specialty Shop",
  "Surf / Skate Shop",

  // Other
  "Other",
] as const;

export type VenueCategory = (typeof VENUE_CATEGORIES)[number];

export interface ScoutCandidate {
  venueName: string;
  venueAddress: string;
  venueCategory: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  googleTypes?: string[];
  googlePrimaryType?: string;
  googlePrimaryTypeDisplayName?: string;
  rating?: number;
  distanceFromHome?: number;
  source: "search_places" | "search_trails" | "web_search";
  notes?: string;
}

export interface ScoutResult {
  candidates: ScoutCandidate[];
  allVenues: VerifiedVenue[];
  allTrails: Trail[];
  trace?: ScoutTrace;
}

export interface ScoutTrace {
  searches: ScoutSearchTrace[];
  submittedCandidates: ScoutCandidateTrace[];
  fallbackReason?: string;
}

export interface ScoutSearchTrace {
  tool: "search_places" | "search_trails" | "submit_candidates";
  query: string;
  radiusMiles?: number;
  returned: number;
  acceptedNew?: number;
  terminal?: boolean;
  note?: string;
  results?: ScoutCandidateTrace[];
}

export interface ScoutCandidateTrace {
  name: string;
  category: string;
  distanceMiles?: number;
  rating?: number;
  source?: string;
  primaryType?: string;
  notes?: string;
}

export interface VenueSelectionTrace {
  attempts: VenueSelectionAttemptTrace[];
  finalWinner?: ScoutCandidateTrace;
}

export interface VenueSelectionAttemptTrace {
  attempt: number;
  searches: ScoutSearchTrace[];
  submittedCandidates: ScoutCandidateTrace[];
  accepted: boolean;
  winner?: ScoutCandidateTrace;
  rejectionCodes: string[];
  rejectionReasons: string[];
  fallbackWinner?: ScoutCandidateTrace;
  fallbackReason?: string;
  forcedFallback?: boolean;
}
