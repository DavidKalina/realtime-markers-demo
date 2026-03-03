import {
  Event,
  EventStatus,
  RecurrenceFrequency,
  DayOfWeek,
} from "../types/types";
import { UnifiedSpatialCacheService } from "./UnifiedSpatialCacheService";

export interface EventInitializationServiceConfig {
  backendUrl?: string;
  pageSize?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class EventInitializationService {
  readonly entityType = "event";
  private spatialCache: UnifiedSpatialCacheService;
  private backendUrl: string;
  private pageSize: number;
  private maxRetries: number;
  private retryDelay: number;

  // Stats for monitoring
  private stats = {
    eventsFetched: 0,
    eventsProcessed: 0,
    apiCalls: 0,
    apiErrors: 0,
    retries: 0,
    lastInitializationTime: 0,
  };

  constructor(
    spatialCache: UnifiedSpatialCacheService,
    config: EventInitializationServiceConfig = {},
  ) {
    this.spatialCache = spatialCache;
    this.backendUrl =
      config.backendUrl || process.env.BACKEND_URL || "http://backend:3000";
    this.pageSize = config.pageSize || 100;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  async initializeEntities(): Promise<void> {
    const maxRetries = 5;
    const baseDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🔄 [EventInitialization] Starting event initialization (attempt ${attempt}/${maxRetries})...`,
        );

        // Fetch events from the API
        console.log("📡 [EventInitialization] Fetching events from API...");
        const events = await this.fetchAllEvents();

        console.log(
          `📊 [EventInitialization] Received ${events.length} events for initialization`,
        );

        if (events.length === 0) {
          console.warn(
            "⚠️ [EventInitialization] No events found - this may indicate an API issue",
          );
          return;
        }

        // Process events in batches
        console.log("⚙️ [EventInitialization] Processing events...");
        await this.processEventsBatch(events);

        this.stats.lastInitializationTime = Date.now();

        console.log("✅ [EventInitialization] Events initialization complete");
        return; // Success, exit retry loop
      } catch (error) {
        console.error(
          `❌ [EventInitialization] Error initializing events (attempt ${attempt}/${maxRetries}):`,
          error,
        );

        if (attempt === maxRetries) {
          console.error(
            "💥 [EventInitialization] Max retries reached, giving up",
          );
          throw error;
        }

        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ [EventInitialization] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  getStats(): Record<string, unknown> {
    return {
      entityType: this.entityType,
      ...this.stats,
      backendUrl: this.backendUrl,
      pageSize: this.pageSize,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay,
    };
  }

  /**
   * Fetch all events from the API or database
   */
  private async fetchAllEvents(): Promise<Event[]> {
    try {
      console.log(
        `🌐 [EventInitialization] Fetching events from: ${this.backendUrl}`,
      );

      let currentPage = 1;
      let hasMorePages = true;
      let allEvents: Event[] = [];

      while (hasMorePages) {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
          try {
            const url = `${this.backendUrl}/api/internal/events?limit=${this.pageSize}&offset=${
              (currentPage - 1) * this.pageSize
            }`;

            console.log(
              `📡 [EventInitialization] Fetching page ${currentPage}: ${url}`,
            );

            const response = await fetch(url, {
              headers: {
                Accept: "application/json",
              },
            });

            if (!response.ok) {
              throw new Error(
                `HTTP error! status: ${response.status} - ${response.statusText}`,
              );
            }

            const data = await response.json();

            if (!data || !Array.isArray(data.events)) {
              console.error(
                "❌ [EventInitialization] Invalid response format:",
                data,
              );
              throw new Error("Invalid response format from backend");
            }

            const { events, hasMore } = data;

            console.log(
              `📄 [EventInitialization] Page ${currentPage}: received ${events.length} events, hasMore: ${hasMore}`,
            );

            // Process and validate events
            const validEvents = events
              .filter(
                (event: { location?: { coordinates?: number[] } }) =>
                  event.location?.coordinates,
              )
              .map(this.normalizeEventData);

            console.log(
              `✅ [EventInitialization] Page ${currentPage}: ${validEvents.length} valid events after filtering`,
            );

            // Add to our collection, ensuring no duplicates
            const newEvents = validEvents.filter(
              (event: Event) =>
                !allEvents.some((existing) => existing.id === event.id),
            );
            allEvents = [...allEvents, ...newEvents];

            console.log(
              `📊 [EventInitialization] Total events so far: ${allEvents.length}`,
            );

            // Update pagination state
            hasMorePages = hasMore;
            currentPage++;

            this.stats.apiCalls++;
            this.stats.eventsFetched += validEvents.length;

            break; // Success, exit retry loop
          } catch (error) {
            console.error(
              `❌ [EventInitialization] Attempt ${attempt}/${this.maxRetries} failed for page ${currentPage}:`,
              error,
            );

            if (attempt === this.maxRetries) {
              console.error(
                "💥 [EventInitialization] Max API retries reached for page",
                currentPage,
              );
              hasMorePages = false; // Stop pagination on persistent failure
              break;
            }

            this.stats.retries++;
            this.stats.apiErrors++;

            // Exponential backoff
            const currentRetryDelay =
              this.retryDelay * Math.pow(2, attempt - 1);
            console.log(
              `⏳ [EventInitialization] Retrying in ${currentRetryDelay}ms...`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, currentRetryDelay),
            );
          }
        }
      }

      console.log(
        `🎯 [EventInitialization] Total events fetched: ${allEvents.length}`,
      );

      return allEvents;
    } catch (error) {
      console.error("❌ [EventInitialization] Error fetching events:", error);
      throw error;
    }
  }

  /**
   * Process a batch of events
   */
  private async processEventsBatch(events: Event[]): Promise<void> {
    console.log(
      `⚙️ [EventInitialization] Processing ${events.length} events...`,
    );

    const batchSize = 50;
    const batches = [];

    for (let i = 0; i < events.length; i += batchSize) {
      batches.push(events.slice(i, i + batchSize));
    }

    console.log(
      `📦 [EventInitialization] Processing ${batches.length} batches of up to ${batchSize} events each`,
    );

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(
        `📦 [EventInitialization] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} events)`,
      );

      const promises = batch.map(async (event) => {
        try {
          this.spatialCache.addEvent(event);
          this.stats.eventsProcessed++;
        } catch (error) {
          console.error(
            `❌ [EventInitialization] Error processing event ${event.id}:`,
            error,
          );
        }
      });

      await Promise.all(promises);

      console.log(`✅ [EventInitialization] Batch ${batchIndex + 1} complete`);
    }

    console.log(
      `🎯 [EventInitialization] All batches complete. Processed ${this.stats.eventsProcessed} events`,
    );
  }

  private normalizeEventData(event: {
    id: string;
    emoji?: string;
    title: string;
    description?: string;
    location: { coordinates: number[] };
    eventDate?: string;
    start_date?: string;
    startDate?: string;
    endDate?: string;
    end_date?: string;
    created_at?: string;
    createdAt?: string;
    updated_at?: string;
    updatedAt?: string;
    categories?: Array<{ id: string; name: string }>;
    embedding?: string;
    status?: string;
    isPrivate?: boolean;
    creatorId?: string;
    sharedWith?: Array<{ sharedWithId: string }>;
    scanCount?: number;
    saveCount?: number;
    confidenceScore?: number;
    timezone?: string;
    address?: string;
    locationNotes?: string;
    // Recurring event fields
    isRecurring?: boolean;
    recurrenceFrequency?: string;
    recurrenceDays?: string[];
    recurrenceStartDate?: string;
    recurrenceEndDate?: string;
    recurrenceInterval?: number;
    recurrenceTime?: string;
    recurrenceExceptions?: string[];
    // RSVP relationship
    rsvps?: Array<{
      id: string;
      userId: string;
      eventId: string;
      status: "GOING" | "NOT_GOING";
      createdAt: string;
      updatedAt: string;
    }>;
  }): Event {
    // Normalize date fields
    const eventDate = event.eventDate || event.start_date || event.startDate;
    const endDate = event.endDate || event.end_date;
    const createdAt = event.createdAt || event.created_at;
    const updatedAt = event.updatedAt || event.updated_at;

    // Normalize recurrence frequency
    let recurrenceFrequency: RecurrenceFrequency | undefined;
    if (event.recurrenceFrequency) {
      switch (event.recurrenceFrequency.toUpperCase()) {
        case "DAILY":
          recurrenceFrequency = RecurrenceFrequency.DAILY;
          break;
        case "WEEKLY":
          recurrenceFrequency = RecurrenceFrequency.WEEKLY;
          break;
        case "MONTHLY":
          recurrenceFrequency = RecurrenceFrequency.MONTHLY;
          break;
        case "YEARLY":
          recurrenceFrequency = RecurrenceFrequency.YEARLY;
          break;
      }
    }

    // Normalize recurrence days
    const recurrenceDays = event.recurrenceDays?.map((day) => {
      switch (day.toUpperCase()) {
        case "MONDAY":
          return DayOfWeek.MONDAY;
        case "TUESDAY":
          return DayOfWeek.TUESDAY;
        case "WEDNESDAY":
          return DayOfWeek.WEDNESDAY;
        case "THURSDAY":
          return DayOfWeek.THURSDAY;
        case "FRIDAY":
          return DayOfWeek.FRIDAY;
        case "SATURDAY":
          return DayOfWeek.SATURDAY;
        case "SUNDAY":
          return DayOfWeek.SUNDAY;
        default:
          return DayOfWeek.MONDAY; // Default fallback
      }
    });

    // Normalize status
    let status: EventStatus | undefined;
    if (event.status) {
      switch (event.status.toUpperCase()) {
        case "PENDING":
          status = EventStatus.PENDING;
          break;
        case "VERIFIED":
          status = EventStatus.VERIFIED;
          break;
        case "REJECTED":
          status = EventStatus.REJECTED;
          break;
        case "EXPIRED":
          status = EventStatus.EXPIRED;
          break;
      }
    }

    return {
      id: event.id,
      emoji: event.emoji,
      title: event.title,
      description: event.description,
      location: {
        type: "Point",
        coordinates: event.location.coordinates as [number, number],
      },
      eventDate: eventDate || new Date().toISOString(),
      endDate: endDate,
      createdAt: createdAt || new Date().toISOString(),
      updatedAt: updatedAt || new Date().toISOString(),
      categories:
        event.categories?.map((cat) => ({ id: cat.id, name: cat.name })) || [],
      embedding: event.embedding,
      status: status || EventStatus.VERIFIED,
      isPrivate: event.isPrivate || false,
      creatorId: event.creatorId || "unknown",
      sharedWith:
        event.sharedWith?.map((share) => ({
          sharedWithId: share.sharedWithId,
          sharedById: event.creatorId || "unknown",
        })) || [],
      scanCount: event.scanCount || 0,
      saveCount: event.saveCount || 0,
      confidenceScore: event.confidenceScore || 0,
      timezone: event.timezone,
      address: event.address,
      locationNotes: event.locationNotes,
      // Recurring event fields
      isRecurring: event.isRecurring || false,
      recurrenceFrequency,
      recurrenceDays,
      recurrenceStartDate: event.recurrenceStartDate,
      recurrenceEndDate: event.recurrenceEndDate,
      recurrenceInterval: event.recurrenceInterval || 1,
      recurrenceTime: event.recurrenceTime,
      recurrenceExceptions: event.recurrenceExceptions || [],
      // RSVP relationship
      rsvps: event.rsvps || [],
    };
  }
}

/**
 * Factory function to create event initialization service
 */
export function createEventInitializationService(
  spatialCache: UnifiedSpatialCacheService,
  config: EventInitializationServiceConfig = {},
): EventInitializationService {
  return new EventInitializationService(spatialCache, config);
}
