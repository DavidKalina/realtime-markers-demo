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

/**
 * US state bounding boxes: [south, west, north, east] (lat/lng).
 * Used to resolve a state code from coordinates when Overpass tags are missing.
 * Boxes overlap at borders — smallest-area match wins (favours smaller states
 * like DC, RI, CT over larger neighbours).
 */
const STATE_BOUNDS: {
  code: string;
  s: number;
  w: number;
  n: number;
  e: number;
}[] = [
  { code: "AL", s: 30.22, w: -88.47, n: 35.01, e: -84.89 },
  { code: "AK", s: 51.21, w: -179.15, n: 71.39, e: -129.98 },
  { code: "AZ", s: 31.33, w: -114.81, n: 37.0, e: -109.04 },
  { code: "AR", s: 33.0, w: -94.62, n: 36.5, e: -89.64 },
  { code: "CA", s: 32.53, w: -124.41, n: 42.01, e: -114.13 },
  { code: "CO", s: 36.99, w: -109.06, n: 41.0, e: -102.04 },
  { code: "CT", s: 40.99, w: -73.73, n: 42.05, e: -71.79 },
  { code: "DE", s: 38.45, w: -75.79, n: 39.84, e: -75.05 },
  { code: "DC", s: 38.79, w: -77.12, n: 38.99, e: -76.91 },
  { code: "FL", s: 24.4, w: -87.63, n: 31.0, e: -80.03 },
  { code: "GA", s: 30.36, w: -85.61, n: 35.0, e: -80.84 },
  { code: "HI", s: 18.91, w: -160.24, n: 22.24, e: -154.81 },
  { code: "ID", s: 41.99, w: -117.24, n: 49.0, e: -111.04 },
  { code: "IL", s: 36.97, w: -91.51, n: 42.51, e: -87.02 },
  { code: "IN", s: 37.77, w: -88.1, n: 41.76, e: -84.78 },
  { code: "IA", s: 40.37, w: -96.64, n: 43.5, e: -90.14 },
  { code: "KS", s: 36.99, w: -102.05, n: 40.0, e: -94.59 },
  { code: "KY", s: 36.5, w: -89.57, n: 39.15, e: -81.96 },
  { code: "LA", s: 28.93, w: -94.04, n: 33.02, e: -89.0 },
  { code: "ME", s: 43.06, w: -71.08, n: 47.46, e: -66.95 },
  { code: "MD", s: 37.91, w: -79.49, n: 39.72, e: -75.05 },
  { code: "MA", s: 41.24, w: -73.51, n: 42.89, e: -69.93 },
  { code: "MI", s: 41.7, w: -90.42, n: 48.3, e: -82.12 },
  { code: "MN", s: 43.5, w: -97.24, n: 49.38, e: -89.49 },
  { code: "MS", s: 30.17, w: -91.66, n: 35.0, e: -88.1 },
  { code: "MO", s: 35.99, w: -95.77, n: 40.61, e: -89.1 },
  { code: "MT", s: 44.36, w: -116.05, n: 49.0, e: -104.04 },
  { code: "NE", s: 39.99, w: -104.05, n: 43.0, e: -95.31 },
  { code: "NV", s: 35.0, w: -120.01, n: 42.0, e: -114.04 },
  { code: "NH", s: 42.7, w: -72.56, n: 45.31, e: -70.7 },
  { code: "NJ", s: 38.93, w: -75.56, n: 41.36, e: -73.89 },
  { code: "NM", s: 31.33, w: -109.05, n: 37.0, e: -103.0 },
  { code: "NY", s: 40.5, w: -79.76, n: 45.02, e: -71.86 },
  { code: "NC", s: 33.84, w: -84.32, n: 36.59, e: -75.46 },
  { code: "ND", s: 45.94, w: -104.05, n: 49.0, e: -96.55 },
  { code: "OH", s: 38.4, w: -84.82, n: 41.98, e: -80.52 },
  { code: "OK", s: 33.62, w: -103.0, n: 37.0, e: -94.43 },
  { code: "OR", s: 41.99, w: -124.57, n: 46.29, e: -116.46 },
  { code: "PA", s: 39.72, w: -80.52, n: 42.27, e: -74.69 },
  { code: "RI", s: 41.15, w: -71.86, n: 42.02, e: -71.12 },
  { code: "SC", s: 32.05, w: -83.35, n: 35.22, e: -78.54 },
  { code: "SD", s: 42.48, w: -104.06, n: 45.94, e: -96.44 },
  { code: "TN", s: 34.98, w: -90.31, n: 36.68, e: -81.65 },
  { code: "TX", s: 25.84, w: -106.65, n: 36.5, e: -93.51 },
  { code: "UT", s: 36.99, w: -114.05, n: 42.0, e: -109.04 },
  { code: "VT", s: 42.73, w: -73.44, n: 45.02, e: -71.46 },
  { code: "VA", s: 36.54, w: -83.68, n: 39.47, e: -75.24 },
  { code: "WA", s: 45.54, w: -124.85, n: 49.0, e: -116.92 },
  { code: "WV", s: 37.2, w: -82.64, n: 40.64, e: -77.72 },
  { code: "WI", s: 42.49, w: -92.89, n: 47.08, e: -86.25 },
  { code: "WY", s: 40.99, w: -111.06, n: 45.01, e: -104.05 },
  { code: "PR", s: 17.88, w: -67.95, n: 18.52, e: -65.22 },
];

/**
 * Resolve a US state code from latitude/longitude using bounding-box lookup.
 * When multiple boxes match (border overlap), the smallest-area box wins.
 * Returns the two-letter code (e.g. "CO") or null if no match.
 */
export function stateCodeFromCoords(lat: number, lng: number): string | null {
  let best: { code: string; area: number } | null = null;
  for (const b of STATE_BOUNDS) {
    if (lat >= b.s && lat <= b.n && lng >= b.w && lng <= b.e) {
      const area = (b.n - b.s) * (b.e - b.w);
      if (!best || area < best.area) {
        best = { code: b.code, area };
      }
    }
  }
  return best?.code ?? null;
}
