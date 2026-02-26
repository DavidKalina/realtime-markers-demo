// Ticketmaster Discovery API client.
// Uses native fetch (Bun has it built-in) — no new dependencies.

const TM_BASE_URL = "https://app.ticketmaster.com/discovery/v2";

export interface TicketmasterSearchParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  size?: number;
  startDateTime?: string; // ISO 8601 with timezone, e.g. 2024-01-01T00:00:00Z
  endDateTime?: string;
}

export interface TmImage {
  url: string;
  ratio?: string;
  width?: number;
  height?: number;
}

export interface TmClassification {
  segment?: { name?: string };
  genre?: { name?: string };
  subGenre?: { name?: string };
}

export interface TmVenue {
  name?: string;
  address?: { line1?: string; line2?: string };
  city?: { name?: string };
  state?: { stateCode?: string; name?: string };
  country?: { countryCode?: string };
  postalCode?: string;
  location?: { longitude?: string; latitude?: string };
  timezone?: string;
}

export interface TmDate {
  start?: {
    localDate?: string; // YYYY-MM-DD
    localTime?: string; // HH:mm:ss
    dateTime?: string; // ISO 8601
  };
  end?: {
    localDate?: string;
    localTime?: string;
    dateTime?: string;
  };
  timezone?: string;
  status?: { code?: string };
}

export interface TmEvent {
  id: string;
  name: string;
  description?: string;
  info?: string;
  url?: string;
  images?: TmImage[];
  dates?: TmDate;
  classifications?: TmClassification[];
  _embedded?: {
    venues?: TmVenue[];
  };
}

export interface TmSearchResponse {
  _embedded?: {
    events?: TmEvent[];
  };
  page?: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

export interface ParsedTicketmasterEvent {
  externalId: string;
  title: string;
  description: string | undefined;
  eventDate: Date;
  endDate: Date | undefined;
  timezone: string;
  latitude: number;
  longitude: number;
  address: string;
  imageUrl: string | undefined;
  classifications: TmClassification[];
  venueName: string | undefined;
}

export interface TicketmasterService {
  searchEvents(
    params: TicketmasterSearchParams,
  ): Promise<ParsedTicketmasterEvent[]>;
}

export interface TicketmasterServiceDependencies {
  apiKey: string;
}

function buildAddress(venue: TmVenue): string {
  const parts: string[] = [];
  if (venue.name) parts.push(venue.name);
  if (venue.address?.line1) parts.push(venue.address.line1);
  if (venue.city?.name) parts.push(venue.city.name);
  if (venue.state?.stateCode) parts.push(venue.state.stateCode);
  if (venue.postalCode) parts.push(venue.postalCode);
  return parts.join(", ");
}

function pickBestImage(images: TmImage[] | undefined): string | undefined {
  if (!images || images.length === 0) return undefined;
  // Prefer 16:9 ratio with decent width
  const preferred = images.find(
    (img) => img.ratio === "16_9" && (img.width ?? 0) >= 640,
  );
  return preferred?.url ?? images[0].url;
}

function parseEvent(tmEvent: TmEvent): ParsedTicketmasterEvent | null {
  // Skip events without coordinates
  const venue = tmEvent._embedded?.venues?.[0];
  const lat = venue?.location?.latitude
    ? parseFloat(venue.location.latitude)
    : NaN;
  const lng = venue?.location?.longitude
    ? parseFloat(venue.location.longitude)
    : NaN;
  if (isNaN(lat) || isNaN(lng)) return null;

  // Skip events without a date
  const dateStr =
    tmEvent.dates?.start?.dateTime ?? tmEvent.dates?.start?.localDate;
  if (!dateStr) return null;

  const eventDate = new Date(dateStr);
  if (isNaN(eventDate.getTime())) return null;

  // Skip cancelled events
  if (tmEvent.dates?.status?.code === "cancelled") return null;

  let endDate: Date | undefined;
  const endDateStr =
    tmEvent.dates?.end?.dateTime ?? tmEvent.dates?.end?.localDate;
  if (endDateStr) {
    const parsed = new Date(endDateStr);
    if (!isNaN(parsed.getTime())) endDate = parsed;
  }

  return {
    externalId: tmEvent.id,
    title: tmEvent.name,
    description: tmEvent.description || tmEvent.info || undefined,
    eventDate,
    endDate,
    timezone: tmEvent.dates?.timezone ?? venue?.timezone ?? "UTC",
    latitude: lat,
    longitude: lng,
    address: venue ? buildAddress(venue) : "",
    imageUrl: pickBestImage(tmEvent.images),
    classifications: tmEvent.classifications ?? [],
    venueName: venue?.name,
  };
}

export function createTicketmasterService(
  deps: TicketmasterServiceDependencies,
): TicketmasterService {
  return {
    async searchEvents(
      params: TicketmasterSearchParams,
    ): Promise<ParsedTicketmasterEvent[]> {
      const {
        latitude,
        longitude,
        radiusKm = 50,
        size = 100,
        startDateTime,
        endDateTime,
      } = params;

      // Convert km to miles (TM API uses miles)
      const radiusMiles = Math.round(radiusKm * 0.621371);

      const queryParams = new URLSearchParams({
        apikey: deps.apiKey,
        geoPoint: `${latitude},${longitude}`,
        radius: String(radiusMiles),
        unit: "miles",
        size: String(Math.min(size, 200)),
        sort: "date,asc",
      });

      if (startDateTime) {
        queryParams.set("startDateTime", startDateTime);
      } else {
        // Default: from now
        queryParams.set("startDateTime", new Date().toISOString().split(".")[0] + "Z");
      }

      if (endDateTime) {
        queryParams.set("endDateTime", endDateTime);
      }

      const url = `${TM_BASE_URL}/events.json?${queryParams.toString()}`;
      console.log(
        `[TicketmasterService] Searching events near ${latitude},${longitude} radius=${radiusKm}km`,
      );

      const response = await fetch(url);
      if (!response.ok) {
        const body = await response.text();
        console.error(
          `[TicketmasterService] API error ${response.status}: ${body}`,
        );
        throw new Error(
          `Ticketmaster API error: ${response.status} ${response.statusText}`,
        );
      }

      const data: TmSearchResponse = await response.json();
      const tmEvents = data._embedded?.events ?? [];

      console.log(
        `[TicketmasterService] Received ${tmEvents.length} events (total: ${data.page?.totalElements ?? 0})`,
      );

      // Parse and filter — skip events missing coordinates or dates
      const parsed: ParsedTicketmasterEvent[] = [];
      for (const tmEvent of tmEvents) {
        const result = parseEvent(tmEvent);
        if (result) parsed.push(result);
      }

      console.log(
        `[TicketmasterService] Parsed ${parsed.length} valid events from ${tmEvents.length} results`,
      );
      return parsed;
    },
  };
}
