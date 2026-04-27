import type { PrescriptionPromptContext } from "../prompts/PrescriptionPromptRegistry";
import type { VerifiedVenue } from "../shared/GooglePlacesService";
import {
  VENUE_CATEGORIES,
  type ScoutCandidate,
  type StrategyBrief,
} from "./PrescriptionStrategy";

export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function canonicalKey(value: string | undefined | null): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactKey(value: string | undefined | null): string {
  return canonicalKey(value).replace(/\s+/g, "");
}

function googleTypeKey(value: string | undefined | null): string {
  return canonicalKey(value).replace(/\s+/g, "_");
}

const DISALLOWED_SOCIAL_GOOGLE_TYPES = new Set([
  "barber_shop",
  "beauty_salon",
  "hair_care",
  "hair_salon",
  "nail_salon",
  "skin_care_clinic",
  "massage",
]);

const DISALLOWED_SOCIAL_NAME_RE =
  /\b(barber|barbershop|hair\s*(care|cut|cuts|salon|studio)|nail\s*(salon|spa|studio)|beauty\s*(bar|salon|spa)|lash(es)?|brow(s)?|waxing|esthetician)\b/i;

export function disallowedSocialVenueReason(
  venue: Partial<VerifiedVenue> & Partial<ScoutCandidate>,
): string | null {
  const googleTypeValues = [
    venue.primaryType,
    venue.googlePrimaryType,
    venue.primaryTypeDisplayName,
    venue.googlePrimaryTypeDisplayName,
    ...(venue.types ?? []),
    ...(venue.googleTypes ?? []),
  ];
  const disallowedType = googleTypeValues.find((value) =>
    DISALLOWED_SOCIAL_GOOGLE_TYPES.has(googleTypeKey(value)),
  );
  if (disallowedType) {
    return `Google Places classified it as "${disallowedType}", which is a personal-service venue rather than an offline social venue`;
  }

  const venueText = [
    venue.name,
    venue.venueName,
    venue.address,
    venue.venueAddress,
  ]
    .filter(Boolean)
    .join(" ");
  if (DISALLOWED_SOCIAL_NAME_RE.test(venueText)) {
    return "The venue name/address looks like a personal-service business rather than an offline social venue";
  }

  return null;
}

export function isDisallowedSocialVenue(
  venue: Partial<VerifiedVenue> & Partial<ScoutCandidate>,
): boolean {
  return disallowedSocialVenueReason(venue) !== null;
}

export function normalizeVenueCategory(raw: string | undefined | null): string {
  const lower = (raw ?? "").toLowerCase();

  const googleTypeMap: Record<string, string> = {
    art_gallery: "Art Gallery",
    bakery: "Bakery / Dessert Shop",
    bar: "Bar",
    book_store: "Bookstore",
    bowling_alley: "Bowling Alley",
    beauty_salon: "Other",
    cafe: "Coffee Shop",
    coffee_shop: "Coffee Shop",
    community_center: "Community Center",
    concert_hall: "Music Venue / Concert Hall",
    event_venue: "Music Venue / Concert Hall",
    fitness_center: "Gym / Fitness Studio",
    gym: "Gym / Fitness Studio",
    hair_care: "Other",
    hair_salon: "Other",
    barber_shop: "Other",
    library: "Library",
    market: "Food Market / Farmers Market",
    museum: "Museum",
    nail_salon: "Other",
    park: "Trail / Park",
    performing_arts_theater: "Theatre / Performing Arts",
    restaurant: "Restaurant",
    sporting_goods_store: "Sports Club",
    sports_activity_location: "Sports Club",
    sports_club: "Sports Club",
    store: "Specialty Shop",
    tourist_attraction: "Other",
    yoga_studio: "Yoga / Pilates Studio",
  };

  for (const [googleType, canonical] of Object.entries(googleTypeMap)) {
    if (
      lower.split(/\s+/).includes(googleType) ||
      lower.includes(googleType.replace(/_/g, " "))
    ) {
      return canonical;
    }
  }

  const keywordMap: [string[], string][] = [
    [
      [
        "board game",
        "game cafe",
        "game store",
        "game venue",
        "tabletop",
        "game night",
        "game meetup",
        "social club",
      ],
      "Board Game Venue",
    ],
    [["coffee"], "Coffee Shop"],
    [["brunch"], "Brunch Spot"],
    [
      [
        "theatre",
        "theater",
        "performing arts",
        "comedy",
        "improv",
        "stand-up",
        "standup",
        "matinee",
      ],
      "Theatre / Performing Arts",
    ],
    [["library"], "Library"],
    [["brewery", "taproom"], "Brewery / Taproom"],
    [["bookstore", "book shop"], "Bookstore"],
    [["art gallery", "gallery"], "Art Gallery"],
    [
      [
        "art studio",
        "art class",
        "arts workshop",
        "ceramics",
        "pottery",
        "craft",
      ],
      "Art Studio / Workshop",
    ],
    [["music venue", "concert", "live music"], "Music Venue / Concert Hall"],
    [["museum"], "Museum"],
    [["yoga", "pilates"], "Yoga / Pilates Studio"],
    [["gym", "fitness studio", "crossfit"], "Gym / Fitness Studio"],
    [["climbing"], "Climbing Gym"],
    [["trail", "park", "greenway", "trailhead", "nature area"], "Trail / Park"],
    [
      ["recreation center", "rec center", "recreation department"],
      "Recreation Center",
    ],
    [
      ["community center", "community arts", "community event"],
      "Community Center",
    ],
    [["maker space", "makerspace", "tinkermill"], "Maker Space"],
    [["coworking", "co-working"], "Coworking Space"],
    [
      [
        "college",
        "adult education",
        "continuing education",
        "community college",
      ],
      "College / Adult Education",
    ],
    [["workshop", "class venue"], "Workshop / Class Venue"],
    [["restaurant", "dining", "eatery"], "Restaurant"],
    [["bar", "pub", "lounge"], "Bar"],
    [["farmers market", "market"], "Food Market / Farmers Market"],
    [
      ["arcade", "entertainment", "go-kart", "bowling", "mini golf"],
      "Arcade / Entertainment",
    ],
    [["karaoke"], "Karaoke Venue"],
    [["surf", "skate"], "Surf / Skate Shop"],
    [["disc golf", "frisbee"], "Disc Golf / Outdoor Activity"],
    [["sports club", "paddle", "run club", "running"], "Sports Club"],
    [["bakery", "dessert", "pastry"], "Bakery / Dessert Shop"],
    [["yarn", "fiber", "knitting", "specialty shop"], "Specialty Shop"],
  ];

  for (const [keywords, canonical] of keywordMap) {
    if (keywords.some((keyword) => lower.includes(keyword))) return canonical;
  }

  return "Other";
}

export function categoryMatches(
  category: string | undefined,
  blocked: readonly string[],
): boolean {
  if (!category) return false;
  return blocked.some((cat) => cat.toLowerCase() === category.toLowerCase());
}

export function categoryFromVerifiedVenue(
  venue: VerifiedVenue,
  fallbackText = "",
): string {
  const primaryCategory = normalizeVenueCategory(venue.primaryType);
  if (primaryCategory !== "Other") {
    return primaryCategory;
  }

  const primaryDisplayCategory = normalizeVenueCategory(
    venue.primaryTypeDisplayName,
  );
  if (primaryDisplayCategory !== "Other") {
    return primaryDisplayCategory;
  }

  if (venue.types?.length) {
    for (const type of venue.types) {
      const secondaryCategory = normalizeVenueCategory(type);
      if (secondaryCategory !== "Other") {
        return secondaryCategory;
      }
    }
  }

  return normalizeVenueCategory(fallbackText);
}

export function scoutCandidateFromVenue(
  venue: VerifiedVenue,
  ctx: PrescriptionPromptContext,
  fallbackText: string,
  notes: string,
): ScoutCandidate {
  const [lng, lat] = venue.coordinates;
  return {
    venueName: venue.name,
    venueAddress: venue.address,
    venueCategory: categoryFromVerifiedVenue(venue, fallbackText),
    latitude: lat,
    longitude: lng,
    placeId: venue.placeId,
    googleTypes: venue.types,
    googlePrimaryType: venue.primaryType,
    googlePrimaryTypeDisplayName: venue.primaryTypeDisplayName,
    rating: venue.rating,
    distanceFromHome: haversineMiles(ctx.homeLat, ctx.homeLng, lat, lng),
    notes,
    source: "search_places",
  };
}

export function matchVerifiedVenue(
  candidate: ScoutCandidate,
  venues: VerifiedVenue[],
): VerifiedVenue | undefined {
  if (candidate.placeId) {
    const byPlaceId = venues.find((v) => v.placeId === candidate.placeId);
    if (byPlaceId) return byPlaceId;
  }

  const candidateName = compactKey(candidate.venueName);
  const candidateAddress = compactKey(candidate.venueAddress);

  const exactName = venues.find((v) => compactKey(v.name) === candidateName);
  if (exactName) return exactName;

  const exactAddress = venues.find(
    (v) => compactKey(v.address) === candidateAddress,
  );
  if (exactAddress) return exactAddress;

  return venues.find((v) => {
    const venueName = compactKey(v.name);
    const venueAddress = compactKey(v.address);
    const nameLooksSame =
      candidateName.length > 4 &&
      venueName.length > 4 &&
      (candidateName.includes(venueName) || venueName.includes(candidateName));
    const addressLooksSame =
      candidateAddress.length > 6 &&
      venueAddress.length > 6 &&
      (candidateAddress.includes(venueAddress) ||
        venueAddress.includes(candidateAddress));
    const distance =
      typeof candidate.latitude === "number" &&
      typeof candidate.longitude === "number"
        ? haversineMiles(
            candidate.latitude,
            candidate.longitude,
            v.coordinates[1],
            v.coordinates[0],
          )
        : Infinity;
    return (nameLooksSame || addressLooksSame) && distance <= 0.25;
  });
}

function scoreCandidate(
  candidate: ScoutCandidate,
  brief: StrategyBrief,
): number {
  const category = normalizeVenueCategory(candidate.venueCategory);
  // When the search anchor has been redirected away from home (weak home
  // base), the distance penalty must be measured from the anchor — otherwise
  // the closest-to-home venue keeps winning even after we move the search.
  const envelopeOrigin = brief.searchEnvelope?.originLatLng;
  const distFromAnchor =
    envelopeOrigin &&
    typeof candidate.latitude === "number" &&
    typeof candidate.longitude === "number"
      ? haversineMiles(
          envelopeOrigin.lat,
          envelopeOrigin.lng,
          candidate.latitude,
          candidate.longitude,
        )
      : null;
  const distFromHome = candidate.distanceFromHome ?? Infinity;
  // Use anchor distance as the penalty driver when the envelope tells us
  // home is weak; fall back to home distance otherwise. This is the lever
  // that makes redirect actually redirect.
  const distance =
    brief.searchEnvelope?.homeBaseViability === "weak" &&
    distFromAnchor !== null
      ? distFromAnchor
      : distFromHome;
  const withinDistance = distance <= brief.maxDistanceMiles + 0.25;
  const categoryText = [
    category,
    candidate.venueName,
    candidate.notes,
    candidate.googlePrimaryType,
    candidate.googlePrimaryTypeDisplayName,
    ...(candidate.googleTypes ?? []),
  ]
    .join(" ")
    .toLowerCase();
  const strategyTokens = [
    brief.experienceType,
    brief.repIntent,
    brief.rationale,
  ]
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);

  const tokenFit = new Set(
    strategyTokens.filter((token) => categoryText.includes(token)),
  ).size;
  const avoidCategory = brief.avoidCategories.some(
    (cat) => normalizeVenueCategory(cat) === category,
  );
  let score = 0;
  score += withinDistance ? 1000 : -500;
  if (avoidCategory) score -= 260;
  if (VENUE_CATEGORIES.includes(category as any) && category !== "Other")
    score += 30;
  score += Math.min(80, tokenFit * 12);
  // Zone-bias logic. The candidate's address is matched against home city and
  // the opportunity-zone recommendations to figure out if it's home-base or
  // away-zone. When homeBaseViability is "weak", the scorer applies a real
  // tilt away from home base — without this, the per-mile distance penalty
  // (-3/mi) means the closest home-base cafe always beats a better but
  // farther recommended-zone option.
  const envelope = brief.searchEnvelope;
  const homeBaseViability = envelope?.homeBaseViability ?? null;
  const addressText = candidate.venueAddress.toLowerCase();
  const homeCityToken = envelope?.homeCity
    ? envelope.homeCity.split(",")[0]!.trim().toLowerCase()
    : null;
  const zoneHint = envelope?.preferredZoneHints?.find((zone) =>
    addressText.includes(zone.city.split(",")[0]!.trim().toLowerCase()),
  );
  const isInRecommendedZone = Boolean(zoneHint);
  const isInHomeBase = Boolean(
    homeCityToken && addressText.includes(homeCityToken),
  );

  if (zoneHint) {
    // Weak markets get a much stronger pull toward the recommended zone —
    // enough to overcome the distance penalty from a 5-12mi trip.
    const cap = homeBaseViability === "weak" ? 250 : 90;
    const base = homeBaseViability === "weak" ? 80 : 24;
    score += Math.min(cap, base + zoneHint.opportunityScore * 10);
  }

  if (homeBaseViability === "weak" && isInHomeBase && !isInRecommendedZone) {
    // Don't strand the user if every candidate is in the home base — only
    // tilt against home-base when there's a real away-zone alternative in the
    // candidate pool (other candidates will be checked by the ranker too).
    score -= 200;
  }

  score -= Number.isFinite(distance) ? distance * 3 : 100;
  score += (candidate.rating ?? 0) * 6;
  return score;
}

export function rankScoutCandidates(
  candidates: ScoutCandidate[],
  brief: StrategyBrief,
): ScoutCandidate[] {
  return [...candidates]
    .map((candidate) => ({
      candidate: {
        ...candidate,
        venueCategory: normalizeVenueCategory(candidate.venueCategory),
      },
      score: scoreCandidate(candidate, brief),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ candidate }) => candidate);
}

export function fallbackCandidatesFromVenues(input: {
  venues: VerifiedVenue[];
  ctx: PrescriptionPromptContext;
  brief: StrategyBrief;
  notes: string;
}): ScoutCandidate[] {
  const fallbackText = `${input.brief.suggestedCategories.join(" ")} ${input.brief.experienceType}`;
  const candidates = input.venues
    .filter((venue) => !isDisallowedSocialVenue(venue))
    .map((venue) =>
      scoutCandidateFromVenue(venue, input.ctx, fallbackText, input.notes),
    );
  return rankScoutCandidates(candidates, input.brief).slice(0, 5);
}
