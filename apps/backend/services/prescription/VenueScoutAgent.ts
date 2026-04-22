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
  type ScoutResult,
  type StrategyBrief,
} from "./PrescriptionStrategy";
import {
  categoryFromVerifiedVenue,
  fallbackCandidatesFromVenues,
  haversineMiles,
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
    const seenVenueIds = new Set<string>();
    const allTrails: Trail[] = [];
    const seenTrailIds = new Set<number>();
    const seenSearchQueries = new Set<string>();
    const searchBasinCounts = new Map<string, number>();
    let placesSearchCount = 0;
    const maxPlacesSearches = 5;

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

        if (seenSearchQueries.has(queryKey)) {
          if (allVenues.length >= 2) {
            const ranked = buildDeterministicCandidates(
              `Deterministic fallback after repeated query "${query}".`,
            );
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
          const venues = await this.placesService.searchPlacesByCategory(
            query,
            areaLabel,
            { lat, lng },
            5,
            radiusMeters,
          );
          const newVenues = venues.filter(
            (v: VerifiedVenue) => !seenVenueIds.has(v.placeId),
          );
          for (const v of newVenues) {
            seenVenueIds.add(v.placeId);
            allVenues.push(v);
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

    return { candidates, allVenues, allTrails };
  }
}

function buildScoutInstructions(
  input: PrescriptionStrategyInput,
  brief: StrategyBrief,
  extraConstraints: string,
): string {
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

SEARCH QUERIES TO TRY: ${(brief.searchEnvelope?.queryFamilies ?? brief.searchQueries).join(", ")}

${brief.preferredVenue ? `SUGGESTED RETURN VENUE: "${brief.preferredVenue}" — The Strategist thinks this could be a good return visit. Use search_places to verify it exists and get its exact address. Include it as a candidate alongside new options.` : ""}
${brief.avoidVenues.length > 0 ? `AVOID THESE VENUES: ${brief.avoidVenues.join(", ")}` : ""}
${brief.avoidCategories.length > 0 ? `AVOID THESE CATEGORIES (overrepresented): ${brief.avoidCategories.join(", ")}` : ""}
${extraConstraints ? `\nADDITIONAL CONSTRAINTS (from previous failed attempt):\n${extraConstraints}` : ""}

TOOLS:
- web_search: find events, classes, meetups
- search_places: verify venues with Google Places
- search_trails: find trails from OpenStreetMap
- submit_candidates: finalize your venue list (TERMINAL)

Find REAL venues with verified addresses. Use search_places to confirm. Prefer candidates where search_places returns withinStrategyDistance=true, and copy canonicalCategory/placeId from search_places into submit_candidates. Do not let a weak home-base town monopolize the search if stronger in-range results show up nearby. Do not submit candidates outside the max distance from USER HOME unless no in-range venue exists and your notes explicitly say it is outside range. Submit 3-5 candidates ranked by fit.

SEARCH BUDGET:
- After 3 useful place searches with any verified venues, submit candidates instead of repeating abstract event searches.
- If an abstract event query is not producing a verified event, pivot to a verified venue that supports the same rep more gently.
- Do not get stuck in one city/query basin. Submit the best verified candidates you have.`;
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
      description: "Find trails/paths from OpenStreetMap.",
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
