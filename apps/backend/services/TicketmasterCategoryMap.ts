// Static mapping from Ticketmaster classifications to app category names.
// Avoids OpenAI calls for category resolution on every import.

const TM_SEGMENT_MAP: Record<string, string> = {
  Music: "music/concerts",
  Sports: "sports",
  "Arts & Theatre": "arts/theatre",
  Film: "film",
  Miscellaneous: "community",
};

const TM_GENRE_MAP: Record<string, string> = {
  // Music genres
  Rock: "rock",
  Pop: "pop",
  "Hip-Hop/Rap": "hip-hop",
  "R&B": "r&b",
  Jazz: "jazz",
  Classical: "classical",
  Country: "country",
  Electronic: "electronic",
  Latin: "latin",
  Metal: "metal",
  Alternative: "alternative",
  Folk: "folk",
  Reggae: "reggae",
  Blues: "blues",
  World: "world music",
  Punk: "punk",
  Soul: "soul",

  // Sports genres
  Football: "football",
  Basketball: "basketball",
  Baseball: "baseball",
  "Ice Hockey": "hockey",
  Soccer: "soccer",
  Tennis: "tennis",
  Golf: "golf",
  Boxing: "boxing",
  MMA: "mma",
  Wrestling: "wrestling",
  Motorsports: "motorsports",

  // Arts genres
  Comedy: "comedy",
  Dance: "dance",
  Theatre: "theatre",
  Opera: "opera",
  Circus: "circus",
  Magic: "magic",

  // Family
  "Children's Theatre": "family",
  "Ice Shows": "family",
};

interface TmClassification {
  segment?: { name?: string };
  genre?: { name?: string };
  subGenre?: { name?: string };
}

export function resolveTicketmasterCategories(
  classifications: TmClassification[] | undefined,
): string[] {
  if (!classifications || classifications.length === 0) {
    return ["events"];
  }

  const categories: string[] = [];
  const seen = new Set<string>();

  for (const classification of classifications) {
    // Map segment
    const segmentName = classification.segment?.name;
    if (segmentName && TM_SEGMENT_MAP[segmentName] && !seen.has(TM_SEGMENT_MAP[segmentName])) {
      seen.add(TM_SEGMENT_MAP[segmentName]);
      categories.push(TM_SEGMENT_MAP[segmentName]);
    }

    // Map genre
    const genreName = classification.genre?.name;
    if (genreName && TM_GENRE_MAP[genreName] && !seen.has(TM_GENRE_MAP[genreName])) {
      seen.add(TM_GENRE_MAP[genreName]);
      categories.push(TM_GENRE_MAP[genreName]);
    }

    // Map subgenre (also check the genre map)
    const subGenreName = classification.subGenre?.name;
    if (subGenreName && TM_GENRE_MAP[subGenreName] && !seen.has(TM_GENRE_MAP[subGenreName])) {
      seen.add(TM_GENRE_MAP[subGenreName]);
      categories.push(TM_GENRE_MAP[subGenreName]);
    }
  }

  // Return max 3 categories, fall back to "events" if nothing matched
  return categories.length > 0 ? categories.slice(0, 3) : ["events"];
}

export function getSegmentEmoji(
  classifications: TmClassification[] | undefined,
): string {
  if (!classifications || classifications.length === 0) return "\uD83C\uDFAB"; // 🎟️
  const segment = classifications[0]?.segment?.name;
  switch (segment) {
    case "Music":
      return "\uD83C\uDFB5"; // 🎵
    case "Sports":
      return "\uD83C\uDFDF\uFE0F"; // 🏟️
    case "Arts & Theatre":
      return "\uD83C\uDFAD"; // 🎭
    case "Film":
      return "\uD83C\uDFAC"; // 🎬
    default:
      return "\uD83C\uDFAB"; // 🎟️
  }
}
