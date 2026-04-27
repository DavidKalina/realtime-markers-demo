import type {
  OpenAIResponsesAgent,
  AgentToolResult,
} from "../shared/OpenAIResponsesAgent";
import { OpenAIModel } from "../shared/OpenAIService";
import type {
  GooglePlacesService,
  VerifiedVenue,
} from "../shared/GooglePlacesService";
import type { OverpassService, Trail } from "../shared/OverpassService";
import {
  VENUE_CATEGORIES,
  type PrescriptionStrategyInput,
  type ScoutCandidate,
  type ScoutCandidateTrace,
  type ScoutResult,
  type ScoutSearchTrace,
  type StrategyBrief,
} from "./PrescriptionStrategy";
import {
  categoryFromVerifiedVenue,
  fallbackCandidatesFromVenues,
  haversineMiles,
  isDisallowedSocialVenue,
  matchVerifiedVenue,
  normalizeVenueCategory,
  scoutCandidateFromVenue,
} from "./ScoutCandidateGrounding";

interface VenueScoutAgentDeps {
  agent: OpenAIResponsesAgent;
  placesService: GooglePlacesService;
  overpassService: OverpassService;
  model: string;
}

export class VenueScoutAgent {
  private agent: OpenAIResponsesAgent;
  private placesService: GooglePlacesService;
  private overpassService: OverpassService;
  private model: string;

  constructor(deps: VenueScoutAgentDeps) {
    this.agent = deps.agent;
    this.placesService = deps.placesService;
    this.overpassService = deps.overpassService;
    this.model = deps.model;
  }

  async run(
    input: PrescriptionStrategyInput,
    brief: StrategyBrief,
    extraConstraints: string,
  ): Promise<ScoutResult> {
    const allVenues: VerifiedVenue[] = [];
    const searches: ScoutSearchTrace[] = [];
    const seenVenueIds = new Set<string>();
    const allTrails: Trail[] = [];
    const seenTrailIds = new Set<number>();
    const seenSearchQueries = new Set<string>();
    const searchBasinCounts = new Map<string, number>();
    let emptyPlacesSearchCount = 0;
    let placesSearchCount = 0;
    const maxPlacesSearches = 5;
    const scoutDiscoveryMode = scoutDiscoveryModeFor(brief);

    const instructions = buildScoutInstructions(input, brief, extraConstraints);
    type Tool = import("openai/resources/responses/responses").Tool;
    const tools: Tool[] = buildScoutTools(input.city);

    let candidates: ScoutCandidate[] = [];
    const buildDeterministicCandidates = (notes: string) => {
      candidates = fallbackCandidatesFromVenues({
        venues: allVenues,
        ctx: input.promptContext,
        brief,
        notes,
      });
      return candidates;
    };
    const basinKeyFor = (query: string) =>
      query
        .toLowerCase()
        .replace(
          /\b(frederick|longmont|brighton|thornton|erie|boulder|denver|colorado|co|near|nearby|event|events)\b/g,
          " ",
        )
        .replace(/\s+/g, " ")
        .trim();

    const toolHandlers: Record<
      string,
      (args: Record<string, unknown>) => Promise<AgentToolResult>
    > = {
      search_places: async (args) => {
        const query = args.query as string;
        const lat = args.latitude as number;
        const lng = args.longitude as number;
        const radiusMiles = (args.radiusMiles as number) ?? 5;
        const radiusMeters = Math.round(radiusMiles * 1609.34);
        const queryKey = query.toLowerCase().trim().replace(/\s+/g, " ");

        if (
          scoutDiscoveryMode === "event_container" &&
          isAbstractEventDiscoveryQuery(query)
        ) {
          return {
            output: `Use web_search first for abstract event/class/social discovery queries like "${query}".`,
            rejection: `Use web_search first for abstract event/class/social discovery queries like "${query}". Find concrete venue or event names, then call search_places on those specific names to verify them.`,
          };
        }

        if (isMalformedPlacesDiscoveryQuery(query)) {
          return {
            output: `Places query "${query}" is too blended to verify reliably.`,
            rejection: `The query "${query}" mixes too many venue/event concepts together. Use a cleaner search. For event/container discovery, use web_search first and then verify a concrete venue name with search_places. For stable venue discovery, use a single canonical venue family like "brewery near Frederick" or an exact venue name.`,
          };
        }

        if (isTooGenericPlacesQuery(query)) {
          return {
            output: `Places query "${query}" is too generic to be useful.`,
            rejection: `The query "${query}" is too generic for search_places. Use a specific venue name, or a canonical family query like "brewery near Frederick" / "board game cafe near Frederick".`,
          };
        }

        if (seenSearchQueries.has(queryKey)) {
          if (allVenues.length >= 2) {
            const ranked = buildDeterministicCandidates(
              `Deterministic fallback after repeated query "${query}".`,
            );
            searches.push({
              tool: "search_places",
              query,
              radiusMiles,
              returned: 0,
              acceptedNew: 0,
              terminal: true,
              note: "repeated query; deterministic fallback",
              results: traceCandidates(ranked),
            });
            return {
              output: `Repeated query "${query}" after verified venues were found. Backend selected ${ranked.length} verified candidates directly.`,
              terminal: true,
            };
          }
          return {
            output: `Already searched "${query}". Do not repeat it. Use a meaningfully different query/category or submit candidates from the venues already found.`,
          };
        }

        if (placesSearchCount >= maxPlacesSearches) {
          if (allVenues.length > 0) {
            const ranked = buildDeterministicCandidates(
              `Deterministic fallback after ${maxPlacesSearches} place searches.`,
            );
            return {
              output: `Search budget exhausted after ${maxPlacesSearches} place searches. Backend selected ${ranked.length} verified candidates directly.`,
              terminal: true,
            };
          }
          throw new Error(
            `Search budget exhausted after ${maxPlacesSearches} place searches with no verified venues.`,
          );
        }

        seenSearchQueries.add(queryKey);
        placesSearchCount += 1;
        const basinKey = basinKeyFor(queryKey) || queryKey;
        const basinCount = (searchBasinCounts.get(basinKey) ?? 0) + 1;
        searchBasinCounts.set(basinKey, basinCount);

        try {
          const near = `${lat},${lng}`;
          const areaLabel =
            brief.searchEnvelope?.searchLabel || brief.targetCity || near;
          let venues = await this.placesService.searchPlacesByCategory(
            query,
            areaLabel,
            { lat, lng },
            5,
            radiusMeters,
          );
          if (venues.length === 0 && scoutDiscoveryMode === "stable_venue") {
            for (const fallbackQuery of buildStableVenueFallbackQueries(
              query,
              brief,
            )) {
              if (seenSearchQueries.has(normalizeScoutQuery(fallbackQuery))) {
                continue;
              }
              const fallbackVenues =
                await this.placesService.searchPlacesByCategory(
                  fallbackQuery,
                  areaLabel,
                  { lat, lng },
                  5,
                  radiusMeters,
                );
              if (fallbackVenues.length > 0) {
                console.log(
                  `[multi-agent] Scout stable fallback: "${query}" -> "${fallbackQuery}"`,
                );
                venues = fallbackVenues;
                break;
              }
            }
          }
          const newVenues = venues.filter(
            (v: VerifiedVenue) =>
              !seenVenueIds.has(v.placeId) && !isDisallowedSocialVenue(v),
          );
          for (const v of newVenues) {
            seenVenueIds.add(v.placeId);
            allVenues.push(v);
          }

          if (newVenues.length === 0) {
            emptyPlacesSearchCount += 1;
            if (scoutDiscoveryMode === "event_container") {
              return {
                output: `No verified venues found for "${query}".`,
                rejection: `No verified venue came back for "${query}". Return to web_search, find 2-3 concrete venue or event names for this class/social/event idea, then use search_places on those exact names.`,
              };
            }
            if (emptyPlacesSearchCount >= 2 && allVenues.length === 0) {
              return {
                output: `No verified venues found after ${emptyPlacesSearchCount} stable-venue searches.`,
                rejection: `You have hit repeated empty Places results. Broaden once to a nearby stronger zone or a neighboring stable venue family, then stop searching and submit any verified results you get.`,
              };
            }
          } else {
            emptyPlacesSearchCount = 0;
          }

          if (input.onProgress) {
            await input.onProgress(
              35,
              `Found ${newVenues.length} spots for "${query}"`,
            );
          }
          if (
            (placesSearchCount >= 3 && allVenues.length >= 3) ||
            (basinCount >= 2 && allVenues.length >= 2)
          ) {
            const ranked = buildDeterministicCandidates(
              basinCount >= 2
                ? `Deterministic fallback after repeated "${basinKey}" search basin.`
                : "Deterministic fallback after 3 useful Places searches.",
            );
            searches.push({
              tool: "search_places",
              query,
              radiusMiles,
              returned: venues.length,
              acceptedNew: newVenues.length,
              terminal: true,
              note:
                basinCount >= 2
                  ? `repeated search basin "${basinKey}"; deterministic fallback`
                  : "3 useful Places searches; deterministic fallback",
              results: traceCandidates(ranked),
            });
            return {
              output: `${JSON.stringify(
                ranked.map((v: ScoutCandidate) => ({
                  name: v.venueName,
                  address: v.venueAddress,
                  placeId: v.placeId,
                  primaryType: v.googlePrimaryType,
                  primaryTypeDisplayName: v.googlePrimaryTypeDisplayName,
                  types: v.googleTypes,
                  canonicalCategory: v.venueCategory,
                  rating: v.rating,
                  latitude: v.latitude,
                  longitude: v.longitude,
                  distanceFromHomeMiles: Number(
                    (v.distanceFromHome ?? 0).toFixed(2),
                  ),
                  withinStrategyDistance:
                    (v.distanceFromHome ?? Infinity) <=
                    brief.maxDistanceMiles + 0.25,
                })),
              )}\nBackend selected verified candidates directly; do not search again.`,
              terminal: true,
            };
          }

          searches.push({
            tool: "search_places",
            query,
            radiusMiles,
            returned: venues.length,
            acceptedNew: newVenues.length,
            results: traceCandidates(
              formatVenueToolResults(newVenues, input, brief).map((venue) => ({
                venueName: venue.name,
                venueAddress: venue.address,
                venueCategory: venue.canonicalCategory,
                latitude: venue.latitude,
                longitude: venue.longitude,
                placeId: venue.placeId,
                googlePrimaryType: venue.primaryType,
                googlePrimaryTypeDisplayName: venue.primaryTypeDisplayName,
                googleTypes: venue.types,
                rating: venue.rating,
                distanceFromHome: venue.distanceFromHomeMiles,
                source: "search_places" as const,
              })),
            ),
          });
          return {
            output: JSON.stringify(
              formatVenueToolResults(newVenues, input, brief),
            ),
          };
        } catch (err) {
          return { output: `Search failed: ${err}` };
        }
      },

      search_trails: async (args) => {
        const lat = args.latitude as number;
        const lng = args.longitude as number;
        const radiusMeters = (args.radiusMeters as number) ?? 5000;
        const surfaceType = (args.surfaceType as string) ?? "any";

        try {
          const foundTrails =
            surfaceType === "unpaved"
              ? await this.overpassService.fetchHikingTrails(
                  lat,
                  lng,
                  radiusMeters,
                  10,
                )
              : await this.overpassService.fetchPavedTrails(
                  lat,
                  lng,
                  radiusMeters,
                  10,
                );
          const newTrails = foundTrails.filter(
            (t: Trail) => !seenTrailIds.has(t.id),
          );
          for (const t of newTrails) {
            seenTrailIds.add(t.id);
            allTrails.push(t);
          }
          searches.push({
            tool: "search_trails",
            query: surfaceType,
            radiusMiles: radiusMeters / 1609.34,
            returned: foundTrails.length,
            acceptedNew: newTrails.length,
            results: newTrails.slice(0, 5).map((trail) => ({
              name: trail.name ?? "Unnamed trail",
              category: "Trail / Park",
              source: "search_trails",
            })),
          });

          return {
            output: JSON.stringify(
              newTrails.slice(0, 5).map((t: Trail) => ({
                name: t.name ?? "Unnamed trail",
                surface: t.surface,
                latitude: t.center?.[1],
                longitude: t.center?.[0],
              })),
            ),
          };
        } catch (err) {
          return { output: `Trail search failed: ${err}` };
        }
      },

      submit_candidates: async (args) => {
        const rawCandidates = args.candidates as ScoutCandidate[];
        candidates = rawCandidates.map((c) => {
          const verified = matchVerifiedVenue(c, allVenues);
          if (verified) {
            return {
              ...scoutCandidateFromVenue(
                verified,
                input.promptContext,
                `${brief.suggestedCategories.join(" ")} ${brief.experienceType}`,
                c.notes ?? "Verified Google Places candidate.",
              ),
              source: "search_places" as const,
            };
          }

          return {
            ...c,
            venueCategory: normalizeVenueCategory(c.venueCategory),
            source: "search_places" as const,
          };
        });
        searches.push({
          tool: "submit_candidates",
          query: "submitted by scout",
          returned: candidates.length,
          terminal: true,
          results: traceCandidates(candidates),
        });
        return { output: "Candidates accepted", terminal: true };
      },
    };

    try {
      await this.agent.run(
        {
          instructions,
          tools,
          toolHandlers,
          maxRounds: 5,
          temperature: 0.5,
          maxOutputTokens: 1500,
          caller: "scout_agent",
          model: this.model as OpenAIModel,
        },
        "Find venues matching the strategy brief. Use search_places to verify each candidate.",
      );
    } catch (err) {
      if (allVenues.length === 0) throw err;
      console.warn(
        `[multi-agent] Scout did not submit candidates (${err instanceof Error ? err.message : String(err)}); falling back to verified search results`,
      );
    }

    if (candidates.length === 0 && allVenues.length > 0) {
      candidates = fallbackCandidatesFromVenues({
        venues: allVenues,
        ctx: input.promptContext,
        brief,
        notes: "Fallback candidate from verified place search results.",
      });
      console.log(
        `[multi-agent] Scout fallback: using ${candidates.length} verified search results after no submit_candidates call`,
      );
    }

    return {
      candidates,
      allVenues,
      allTrails,
      trace: {
        searches,
        submittedCandidates: traceCandidates(candidates),
        fallbackReason:
          candidates.length > 0 && !searches.some((s) => s.tool === "submit_candidates")
            ? "fallback candidates from verified search results"
            : undefined,
      },
    };
  }
}

function traceCandidates(candidates: ScoutCandidate[]): ScoutCandidateTrace[] {
  return candidates.slice(0, 8).map((candidate) => ({
    name: candidate.venueName,
    category: candidate.venueCategory,
    distanceMiles:
      typeof candidate.distanceFromHome === "number"
        ? Number(candidate.distanceFromHome.toFixed(2))
        : undefined,
    rating: candidate.rating,
    source: candidate.source,
    primaryType:
      candidate.googlePrimaryTypeDisplayName ??
      candidate.googlePrimaryType ??
      candidate.googleTypes?.[0],
    notes: candidate.notes,
  }));
}

function buildScoutInstructions(
  input: PrescriptionStrategyInput,
  brief: StrategyBrief,
  extraConstraints: string,
): string {
  const discoveryMode = scoutDiscoveryModeFor(brief);
  return `You are a Venue Scout. Find 3-5 real venues matching this strategy brief.

STRATEGY:
- Experience type: ${brief.experienceType}
- Categories to search: ${brief.suggestedCategories.join(", ")}
- Search envelope: ${brief.searchEnvelope?.searchLabel ?? `near ${input.city}`}
- Max distance: ${brief.maxDistanceMiles.toFixed(1)} miles from user's home
- Opportunity scope: ${brief.opportunityScope ?? "auto-classify from chosen venue distance"}
${brief.travelRationale ? `- Travel rationale: ${brief.travelRationale}` : ""}
- Social challenge: ${brief.socialChallengeLevel}
- Suggested timing: ${brief.suggestedTiming || "flexible"} — find venues that are OPEN and active at this time
- Rationale: ${brief.rationale}
${brief.searchEnvelope?.preferredZoneHints?.length ? `- Preferred zone hints: ${brief.searchEnvelope.preferredZoneHints.map((zone) => `${zone.city} (${zone.distanceMiles.toFixed(1)}mi, score ${zone.opportunityScore.toFixed(1)})`).join("; ")}` : ""}

USER HOME: ${input.city} (${input.searchLat.toFixed(4)}, ${input.searchLng.toFixed(4)})
SEARCH CENTER: home coordinates above. Search within ${brief.maxDistanceMiles.toFixed(1)} miles of home and let verified results reveal which nearby city actually fits best.
 - Discovery mode: ${discoveryMode === "event_container" ? "event/container discovery" : "stable venue discovery"}

SEARCH QUERIES TO TRY: ${(brief.searchEnvelope?.queryFamilies ?? brief.searchQueries).join(", ")}

QUERY INTENT:
- Broad, goal-shaped queries like "social board game night in Colorado" or "beginner dance class in Colorado" are for web_search discovery.
- Home-anchored queries like "brewery near Frederick" or "recreation center near Frederick" are for search_places verification of stable venue families.
- Let verified distance from USER HOME decide what survives. Do not collapse broad discovery back into the weakest nearby town by default.

${brief.preferredVenue ? `SUGGESTED RETURN VENUE: "${brief.preferredVenue}" — The Strategist thinks this could be a good return visit. Use search_places to verify it exists and get its exact address. Include it as a candidate alongside new options.` : ""}
${brief.avoidVenues.length > 0 ? `AVOID THESE VENUES: ${brief.avoidVenues.join(", ")}` : ""}
${brief.avoidCategories.length > 0 ? `AVOID THESE CATEGORIES (overrepresented): ${brief.avoidCategories.join(", ")}` : ""}
${extraConstraints ? `\nADDITIONAL CONSTRAINTS (from previous failed attempt):\n${extraConstraints}` : ""}

TOOLS:
- web_search: find events, classes, meetups
- search_places: verify named venues with Google Places (cafes, libraries, breweries, gyms, recreation, art, retail)
- search_trails: find trails, greenways, and park paths from OpenStreetMap. Trails are first-class third places — call this whenever the brief mentions outdoor, trail, park, walk, hike, or whenever an ACTIVATION / PUBLIC_PRESENCE / RETURNABILITY rep would land well outside. Do NOT skip trails just because they aren't in Google Places.
- submit_candidates: finalize your venue list (TERMINAL)

VENUE DIVERSITY RULE:
- Do not stack two indoor seated-room reps in a row (cafe → library → bookstore is a stale pattern).
- A single search batch should mix at least two distinct families when the brief allows it (e.g. one indoor + one outdoor; one stable place + one event/class).
- Climbing gyms, bowling alleys, disc golf courses, karaoke venues, popular trails, and farmers markets are valid third places — not afterthoughts.

Find REAL venues with verified addresses. Use search_places to confirm. Prefer candidates where search_places returns withinStrategyDistance=true, and copy canonicalCategory/placeId from search_places into submit_candidates. Do not let a weak home-base town monopolize the search if stronger in-range results show up nearby. Do not submit candidates outside the max distance from USER HOME unless no in-range venue exists and your notes explicitly say it is outside range. Submit 3-5 candidates ranked by fit.

${
  discoveryMode === "event_container"
    ? `EVENT/CONTAINER DISCOVERY RULE:
- Start with web_search for abstract queries about classes, socials, meetups, trivia, dance, open mics, live music, singles events, workshops, leagues, or mixers.
- Extract concrete venue/event names from web_search results.
- Then use search_places to verify those exact venue names and addresses.
- Do NOT use search_places as the first move on abstract discovery queries like "trivia night near Frederick" or "beginner dance class near Frederick".`
    : `STABLE VENUE DISCOVERY RULE:
- For stable venue families like libraries, gyms, rec centers, breweries, cafes, coworking, or bookstores, search_places can be the first move.`
}

PLACES QUERY HYGIENE:
- Good search_places queries:
  - exact venue names like "Longmont Public House"
  - simple stable families like "brewery near Frederick" or "recreation center near Frederick"
- Bad search_places queries:
  - "coffee shop live music near Frederick"
  - "live music Longmont seated venue brewery coffee shop"
  - "brewery" (too generic)
- Never mash multiple venue families together in one Places query.

SEARCH BUDGET:
- After 3 useful place searches with any verified venues, submit candidates instead of repeating abstract event searches.
- If an abstract event query is not producing a verified event, pivot to a verified venue that supports the same rep more gently.
- Do not get stuck in one city/query basin. Submit the best verified candidates you have.`;
}

function normalizeScoutQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, " ");
}

function stripState(city: string): string {
  return city.split(",")[0]?.trim() ?? city.trim();
}

const EVENT_DISCOVERY_PATTERN =
  /\b(class|lesson|social|meetup|mixer|open mic|comedy|trivia|dance|salsa|swing|bachata|live music|concert|show|speed dating|singles|run club|volunteer|workshop|club|league|open play|book club|author event|language exchange|game night)\b/i;

function isAbstractEventDiscoveryQuery(query: string): boolean {
  return EVENT_DISCOVERY_PATTERN.test(query);
}

const STABLE_VENUE_PATTERN =
  /\b(coffee shop|coffeehouse|cafe|brewery|taproom|bar|restaurant|brunch|library|rec(?:reation)? center|community center|gym|fitness studio|climbing gym|coworking|bookstore|board game cafe|music venue|theatre|maker space|park|trail)\b/i;

function isMalformedPlacesDiscoveryQuery(query: string): boolean {
  const normalized = normalizeScoutQuery(query);
  const eventHits = [
    "live music",
    "open mic",
    "trivia",
    "dance",
    "class",
    "lesson",
    "meetup",
    "mixer",
    "social",
    "singles",
    "workshop",
    "league",
    "open play",
    "game night",
  ].filter((token) => normalized.includes(token)).length;
  const stableHits = [
    "coffee shop",
    "coffeehouse",
    "cafe",
    "brewery",
    "taproom",
    "bar",
    "restaurant",
    "library",
    "community center",
    "recreation center",
    "gym",
    "fitness studio",
    "board game",
  ].filter((token) => normalized.includes(token)).length;

  return (
    (eventHits >= 1 && stableHits >= 2) ||
    eventHits + stableHits >= 4 ||
    /\bvenue\b/.test(normalized)
  );
}

function isTooGenericPlacesQuery(query: string): boolean {
  const normalized = normalizeScoutQuery(query);
  if (!STABLE_VENUE_PATTERN.test(normalized)) return false;
  if (/\bnear\b/.test(normalized)) return false;
  if (normalized.split(" ").length >= 2 && /^[a-z]/i.test(normalized)) {
    const exactishVenueName = /[A-Z]/.test(
      query.trim().replace(/\b(CO|USA)\b/g, ""),
    );
    if (exactishVenueName) return false;
  }
  return normalized.split(" ").length <= 2;
}

function canonicalStableVenueFamily(
  query: string,
  brief: StrategyBrief,
): string {
  const normalized = normalizeScoutQuery(query);
  if (/\bcoffee shop|coffeehouse|cafe\b/.test(normalized)) return "coffee shop";
  if (/\bbrewery|taproom\b/.test(normalized)) return "brewery";
  if (/\bbar\b/.test(normalized)) return "bar";
  if (/\brestaurant\b/.test(normalized)) return "restaurant";
  if (/\bbrunch\b/.test(normalized)) return "brunch";
  if (/\blibrary\b/.test(normalized)) return "library";
  if (/\bcommunity center\b/.test(normalized)) return "community center";
  if (/\brecreation center|rec center\b/.test(normalized))
    return "recreation center";
  if (/\bgym|fitness studio\b/.test(normalized)) return "gym";
  if (/\bbookstore\b/.test(normalized)) return "bookstore";
  if (/\bcoworking\b/.test(normalized)) return "coworking";
  if (/\bpark|trail\b/.test(normalized)) return "park";

  const primaryCategory = brief.suggestedCategories[0] ?? "";
  switch (primaryCategory) {
    case "Coffee Shop":
      return "coffee shop";
    case "Brewery / Taproom":
      return "brewery";
    case "Bar":
      return "bar";
    case "Restaurant":
      return "restaurant";
    case "Brunch Spot":
      return "brunch";
    case "Library":
      return "library";
    case "Community Center":
      return "community center";
    case "Recreation Center":
      return "recreation center";
    case "Gym / Fitness Studio":
    case "Yoga / Pilates Studio":
    case "Climbing Gym":
      return "gym";
    case "Bookstore":
      return "bookstore";
    case "Coworking Space":
      return "coworking";
    case "Trail / Park":
      return "park";
    default:
      return primaryCategory.toLowerCase() || "venue";
  }
}

function buildStableVenueFallbackQueries(
  query: string,
  brief: StrategyBrief,
): string[] {
  const family = canonicalStableVenueFamily(query, brief);
  const seen = new Set<string>();
  const variants: string[] = [];

  const push = (value: string) => {
    const normalized = normalizeScoutQuery(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    variants.push(value);
  };

  for (const zone of brief.searchEnvelope?.preferredZoneHints ?? []) {
    push(`${family} near ${stripState(zone.city)}`);
    if (variants.length >= 2) return variants;
  }

  if (family === "coffee shop") {
    push(
      `cafe ${brief.searchEnvelope?.searchLabel ?? `near ${brief.targetCity}`}`,
    );
    push(
      `brunch ${brief.searchEnvelope?.searchLabel ?? `near ${brief.targetCity}`}`,
    );
  } else if (family === "brewery") {
    push(
      `bar ${brief.searchEnvelope?.searchLabel ?? `near ${brief.targetCity}`}`,
    );
    push(
      `taproom ${brief.searchEnvelope?.searchLabel ?? `near ${brief.targetCity}`}`,
    );
  } else if (family === "gym") {
    push(
      `recreation center ${brief.searchEnvelope?.searchLabel ?? `near ${brief.targetCity}`}`,
    );
    push(
      `fitness studio ${brief.searchEnvelope?.searchLabel ?? `near ${brief.targetCity}`}`,
    );
  }

  return variants.slice(0, 2);
}

function scoutDiscoveryModeFor(
  brief: StrategyBrief,
): "event_container" | "stable_venue" {
  const text = [
    brief.experienceType,
    ...brief.searchQueries,
    ...(brief.searchEnvelope?.queryFamilies ?? []),
    ...brief.suggestedCategories,
  ].join(" ");
  return isAbstractEventDiscoveryQuery(text)
    ? "event_container"
    : "stable_venue";
}

function buildScoutTools(
  city: string,
): import("openai/resources/responses/responses").Tool[] {
  return [
    {
      type: "web_search",
      user_location: {
        type: "approximate",
        city,
        country: "US",
      },
      search_context_size: "medium",
    },
    {
      type: "function",
      strict: false,
      name: "search_places",
      description: "Search Google Places for verified venues near a location.",
      parameters: {
        type: "object" as const,
        properties: {
          query: { type: "string", description: "Search query" },
          latitude: { type: "number" },
          longitude: { type: "number" },
          radiusMiles: {
            type: "number",
            description: "Search radius in miles (default 5)",
          },
        },
        required: ["query", "latitude", "longitude"],
      },
    },
    {
      type: "function",
      strict: false,
      name: "search_trails",
      description:
        "Find named trails, greenways, and park paths from OpenStreetMap. Use this whenever the rep would benefit from outdoor presence or movement — popular trails are first-class third places, not fallbacks. Especially useful for ACTIVATION, PUBLIC_PRESENCE, RETURNABILITY reps and any goal where being-out-in-the-world matters more than being in a specific kind of room.",
      parameters: {
        type: "object" as const,
        properties: {
          latitude: { type: "number" },
          longitude: { type: "number" },
          radiusMeters: { type: "number" },
          surfaceType: { type: "string", enum: ["paved", "unpaved", "any"] },
        },
        required: ["latitude", "longitude"],
      },
    },
    {
      type: "function",
      strict: false,
      name: "submit_candidates",
      description:
        "Submit your ranked venue candidates. This is the terminal action.",
      parameters: {
        type: "object" as const,
        properties: {
          candidates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                venueName: { type: "string" },
                venueAddress: { type: "string" },
                venueCategory: {
                  type: "string",
                  enum: VENUE_CATEGORIES as unknown as string[],
                  description:
                    "Use the canonicalCategory returned by search_places when available; otherwise pick the closest match from this list",
                },
                latitude: { type: "number" },
                longitude: { type: "number" },
                placeId: {
                  type: "string",
                  description:
                    "Google Places placeId returned by search_places when available",
                },
                notes: {
                  type: "string",
                  description: "Why this venue fits the strategy",
                },
              },
              required: [
                "venueName",
                "venueAddress",
                "venueCategory",
                "latitude",
                "longitude",
              ],
            },
            minItems: 1,
            maxItems: 5,
          },
        },
        required: ["candidates"],
      },
    },
  ];
}

function formatVenueToolResults(
  venues: VerifiedVenue[],
  input: PrescriptionStrategyInput,
  brief: StrategyBrief,
) {
  return venues.map((v: VerifiedVenue) => ({
    name: v.name,
    address: v.address,
    placeId: v.placeId,
    primaryType: v.primaryType,
    primaryTypeDisplayName: v.primaryTypeDisplayName,
    types: v.types,
    canonicalCategory: categoryFromVerifiedVenue(
      v,
      `${brief.suggestedCategories.join(" ")} ${brief.experienceType}`,
    ),
    rating: v.rating,
    latitude: v.coordinates[1],
    longitude: v.coordinates[0],
    distanceFromHomeMiles: Number(
      haversineMiles(
        input.promptContext.homeLat,
        input.promptContext.homeLng,
        v.coordinates[1],
        v.coordinates[0],
      ).toFixed(2),
    ),
    withinStrategyDistance:
      haversineMiles(
        input.promptContext.homeLat,
        input.promptContext.homeLng,
        v.coordinates[1],
        v.coordinates[0],
      ) <=
      brief.maxDistanceMiles + 0.25,
  }));
}
