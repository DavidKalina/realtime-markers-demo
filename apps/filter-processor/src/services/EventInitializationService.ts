import {
  Event,
  EventStatus,
  Point,
  RecurrenceFrequency,
  DayOfWeek,
} from "../types/types";
import { EventProcessor } from "../handlers/EventProcessor";

export interface EventInitializationService {
  initializeEvents(): Promise<void>;
  clearAllEvents(): void;
  getStats(): Record<string, unknown>;
}

export interface EventInitializationServiceConfig {
  backendUrl?: string;
  pageSize?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export function createEventInitializationService(
  eventProcessor: EventProcessor,
  config: EventInitializationServiceConfig = {},
): EventInitializationService {
  const {
    backendUrl = process.env.BACKEND_URL || "http://backend:3000",
    pageSize = 100,
    maxRetries = 3,
    retryDelay = 1000,
  } = config;

  // Stats for monitoring
  const stats = {
    eventsFetched: 0,
    eventsProcessed: 0,
    apiCalls: 0,
    apiErrors: 0,
    retries: 0,
    lastInitializationTime: 0,
  };

  /**
   * Initialize events by fetching from API and processing them
   */
  async function initializeEvents(): Promise<void> {
    try {
      if (process.env.NODE_ENV !== "production") {
        console.log("[EventInitialization] Initializing events...");
      }

      // Fetch events from the API
      const events = await fetchAllEvents();

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[EventInitialization] Received ${events.length} events for initialization`,
        );
      }

      // Process events in batches
      processEventsBatch(events);

      stats.lastInitializationTime = Date.now();

      if (process.env.NODE_ENV !== "production") {
        console.log("[EventInitialization] Events initialization complete");
      }
    } catch (error) {
      console.error("[EventInitialization] Error initializing events:", error);
      throw error;
    }
  }

  /**
   * Clear all events (for cleanup operations)
   */
  function clearAllEvents(): void {
    // This would typically call a method on the event processor or cache service
    // For now, we'll just log it
    console.log("[EventInitialization] Clearing all events");
  }

  /**
   * Fetch all events from the API or database
   */
  async function fetchAllEvents(): Promise<Event[]> {
    try {
      let currentPage = 1;
      let hasMorePages = true;
      let allEvents: Event[] = [];

      while (hasMorePages) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await fetch(
              `${backendUrl}/api/internal/events?limit=${pageSize}&offset=${
                (currentPage - 1) * pageSize
              }`,
              {
                headers: {
                  Accept: "application/json",
                },
              },
            );

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data || !Array.isArray(data.events)) {
              throw new Error("Invalid response format from backend");
            }

            const { events, hasMore } = data;

            // Process and validate events
            const validEvents = events
              .filter(
                (event: { location?: { coordinates?: number[] } }) =>
                  event.location?.coordinates,
              )
              .map(normalizeEventData);

            // Add to our collection, ensuring no duplicates
            const newEvents = validEvents.filter(
              (event: Event) =>
                !allEvents.some((existing) => existing.id === event.id),
            );
            allEvents = [...allEvents, ...newEvents];

            // Update pagination state
            hasMorePages = hasMore;
            currentPage++;

            stats.apiCalls++;
            stats.eventsFetched += validEvents.length;

            break; // Success, exit retry loop
          } catch (error) {
            console.error(
              `[EventInitialization] Attempt ${attempt}/${maxRetries} failed for page ${currentPage}:`,
              error,
            );

            if (attempt === maxRetries) {
              console.error(
                "[EventInitialization] Max API retries reached for page",
                currentPage,
              );
              hasMorePages = false; // Stop pagination on persistent failure
              break;
            }

            stats.retries++;
            stats.apiErrors++;

            // Exponential backoff
            const currentRetryDelay = retryDelay * Math.pow(2, attempt - 1);
            await new Promise((resolve) =>
              setTimeout(resolve, currentRetryDelay),
            );
          }
        }
      }

      return allEvents;
    } catch (error) {
      console.error("[EventInitialization] Error fetching events:", error);
      return [];
    }
  }

  /**
   * Process a batch of events
   */
  function processEventsBatch(events: Event[]): void {
    try {
      // Remove duplicates based on event ID
      const uniqueEvents = Array.from(
        new Map(events.map((event) => [event.id, event])).values(),
      );

      // Process each event
      for (const event of uniqueEvents) {
        eventProcessor.processEvent({
          operation: "CREATE",
          record: event,
        });
        stats.eventsProcessed++;
      }
    } catch (error) {
      console.error(
        "[EventInitialization] Error processing events batch:",
        error,
      );
    }
  }

  /**
   * Normalize event data from API response
   */
  function normalizeEventData(event: {
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
    categories?: Array<{ name: string }>;
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
    return {
      id: event.id,
      emoji: event.emoji,
      title: event.title,
      description: event.description,
      location: {
        type: "Point",
        coordinates: event.location.coordinates,
      } as Point,
      eventDate:
        event.eventDate ||
        event.start_date ||
        event.startDate ||
        new Date().toISOString(),
      endDate: event.endDate || event.end_date,
      createdAt:
        event.created_at || event.createdAt || new Date().toISOString(),
      updatedAt:
        event.updated_at || event.updatedAt || new Date().toISOString(),
      categories:
        event.categories?.map((cat) => ({ id: cat.name, name: cat.name })) ||
        [],
      embedding: event.embedding,
      status: (event.status as EventStatus) || EventStatus.VERIFIED,
      isPrivate: event.isPrivate || false,
      creatorId: event.creatorId,
      sharedWith:
        event.sharedWith?.map((share) => ({
          sharedWithId: share.sharedWithId,
          sharedById: event.creatorId || "unknown",
        })) || [],
      scanCount: event.scanCount || 0,
      saveCount: event.saveCount || 0,
      confidenceScore: event.confidenceScore,
      timezone: event.timezone,
      address: event.address,
      locationNotes: event.locationNotes,
      // Recurring event fields
      isRecurring: event.isRecurring || false,
      recurrenceFrequency: event.recurrenceFrequency as RecurrenceFrequency,
      recurrenceDays: event.recurrenceDays as DayOfWeek[],
      recurrenceStartDate: event.recurrenceStartDate,
      recurrenceEndDate: event.recurrenceEndDate,
      recurrenceInterval: event.recurrenceInterval,
      recurrenceTime: event.recurrenceTime,
      recurrenceExceptions: event.recurrenceExceptions,
      // RSVP relationship
      rsvps: event.rsvps || [],
    };
  }

  /**
   * Get current statistics
   */
  function getStats(): Record<string, unknown> {
    return {
      ...stats,
    };
  }

  return {
    initializeEvents,
    clearAllEvents,
    getStats,
  };
}
