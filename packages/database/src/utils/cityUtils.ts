/**
 * US state/territory full name → two-letter code mapping.
 * Used to coerce "Colorado" → "CO", "New York" → "NY", etc.
 */
const STATE_TO_CODE: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
  "puerto rico": "PR",
  "u.s. virgin islands": "VI",
  guam: "GU",
  "american samoa": "AS",
  "northern mariana islands": "MP",
};

/**
 * Normalize a city string to a canonical "City Name, ST" format.
 *
 * - Trims whitespace around parts
 * - Title-cases the city name
 * - Converts full state names to two-letter codes ("Colorado" → "CO")
 * - Uppercases state codes
 *
 * Examples:
 *   "denver, CO"        → "Denver, CO"
 *   "Denver, Colorado"  → "Denver, CO"
 *   "broomfield,co"     → "Broomfield, CO"
 *   "NEW YORK, ny"      → "New York, NY"
 *   "Flagstaff"         → "Flagstaff"  (no state, left as-is)
 */
export function normalizeCity(city: string): string {
  const parts = city.split(",").map((p) => p.trim());

  // Title-case the city name (first part)
  const cityName = parts[0]
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (parts.length < 2 || !parts[1]) {
    return cityName;
  }

  // Resolve state: if it's already a 2-letter code, uppercase it.
  // Otherwise look up the full name in the mapping.
  const rawState = parts[1].trim();
  let stateCode: string;

  if (rawState.length <= 2) {
    stateCode = rawState.toUpperCase();
  } else {
    stateCode = STATE_TO_CODE[rawState.toLowerCase()] ?? rawState.toUpperCase();
  }

  return `${cityName}, ${stateCode}`;
}

/**
 * Returns true if the city string is in canonical "City, ST" format
 * (i.e. contains a comma with a non-empty state portion).
 */
export function isCityNormalized(city: string): boolean {
  const parts = city.split(",");
  return parts.length >= 2 && parts[1].trim().length > 0;
}
