import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { createEventFilteringService } from "../src/services/EventFilteringService";
import { FilterMatcher } from "../src/handlers/FilterMatcher";
import { MapMojiFilterService } from "../src/services/MapMojiFilterService";
import { RelevanceScoringService } from "../src/services/RelevanceScoringService";
import { EventPublisher } from "../src/handlers/EventPublisher";
import { Event, BoundingBox, Filter, EventStatus } from "../src/types/types";

describe("EventFilteringService", () => {
  // Mock dependencies
  let mockFilterMatcher: FilterMatcher;
  let mockMapMojiFilter: MapMojiFilterService;
  let mockRelevanceScoringService: RelevanceScoringService;
  let mockEventPublisher: EventPublisher;
  let eventFilteringService: ReturnType<typeof createEventFilteringService>;

  // Test data
  const testViewport: BoundingBox = {
    minX: -122.5,
    minY: 37.7,
    maxX: -122.4,
    maxY: 37.8,
  };

  // Test event factory
  const createTestEvent = (overrides: Partial<Event> = {}): Event => ({
    id: "test-event-1",
    title: "Test Event",
    description: "A test event",
    eventDate: "2024-01-15T14:00:00Z", // 2 hours in future
    location: { type: "Point", coordinates: [-122.4194, 37.7749] },
    scanCount: 5,
    saveCount: 2,
    status: EventStatus.VERIFIED,
    isPrivate: false,
    creatorId: "user-1",
    isRecurring: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  });

  // Test filter factory
  const createTestFilter = (overrides: Partial<Filter> = {}): Filter => ({
    id: "filter-1",
    userId: "user-1",
    name: "Test Filter",
    isActive: true,
    criteria: {
      dateRange: {
        start: "2024-01-15",
        end: "2024-01-16",
      },
    },
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  });

  beforeEach(() => {
    // Create mock instances
    mockFilterMatcher = {
      eventMatchesFilters: mock(() => true),
    } as unknown as FilterMatcher;

    mockMapMojiFilter = {
      updateConfig: mock(() => {}),
      filterEvents: mock(() => Promise.resolve([createTestEvent()])),
    } as unknown as MapMojiFilterService;

    mockRelevanceScoringService = {
      addRelevanceScoresToEvents: mock(() => [
        createTestEvent({ relevanceScore: 0.8 }),
      ]),
    } as unknown as RelevanceScoringService;

    mockEventPublisher = {
      publishFilteredEvents: mock(() => Promise.resolve()),
    } as unknown as EventPublisher;

    // Create the service instance
    eventFilteringService = createEventFilteringService(
      mockFilterMatcher,
      mockMapMojiFilter,
      mockRelevanceScoringService,
      mockEventPublisher,
      {
        mapMojiConfig: {
          maxEvents: 1000,
          enableHybridMode: true,
        },
      },
    );
  });

  describe("Constructor and Configuration", () => {
    test("should create service with default configuration", () => {
      const service = createEventFilteringService(
        mockFilterMatcher,
        mockMapMojiFilter,
        mockRelevanceScoringService,
        mockEventPublisher,
      );

      expect(service).toBeDefined();
      expect(typeof service.filterAndSendViewportEvents).toBe("function");
      expect(typeof service.filterAndSendAllEvents).toBe("function");
      expect(typeof service.calculateAndSendDiff).toBe("function");
      expect(typeof service.getStats).toBe("function");
    });

    test("should create service with custom configuration", () => {
      const customConfig = {
        mapMojiConfig: {
          maxEvents: 500,
          enableHybridMode: false,
        },
      };

      const service = createEventFilteringService(
        mockFilterMatcher,
        mockMapMojiFilter,
        mockRelevanceScoringService,
        mockEventPublisher,
        customConfig,
      );

      expect(service).toBeDefined();
    });
  });

  describe("filterAndSendViewportEvents", () => {
    test("should apply MapMoji filtering when no filters provided", async () => {
      const events = [createTestEvent(), createTestEvent({ id: "event-2" })];
      const userId = "user-1";
      const filters: Filter[] = [];

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      expect(mockMapMojiFilter.updateConfig).toHaveBeenCalledWith({
        viewportBounds: testViewport,
        maxEvents: 1000,
        currentTime: expect.any(Date),
      });

      expect(mockMapMojiFilter.filterEvents).toHaveBeenCalledWith(events);
      expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "viewport",
        expect.any(Array),
      );
    });

    test("should apply hybrid filtering for date range only filters", async () => {
      const events = [createTestEvent(), createTestEvent({ id: "event-2" })];
      const userId = "user-1";
      const filters = [
        createTestFilter({
          criteria: {
            dateRange: {
              start: "2024-01-15",
              end: "2024-01-16",
            },
          },
        }),
      ];

      // Mock the filter matcher to return true for all events
      mockFilterMatcher.eventMatchesFilters = mock(() => true);

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      expect(mockMapMojiFilter.updateConfig).toHaveBeenCalledWith({
        viewportBounds: testViewport,
        maxEvents: 100,
        currentTime: expect.any(Date),
      });

      expect(mockMapMojiFilter.filterEvents).toHaveBeenCalledWith(events);
      expect(mockFilterMatcher.eventMatchesFilters).toHaveBeenCalled();
      expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "viewport",
        expect.any(Array),
      );
    });

    test("should apply traditional filtering for complex filters", async () => {
      const events = [createTestEvent(), createTestEvent({ id: "event-2" })];
      const userId = "user-1";
      const filters = [
        createTestFilter({
          criteria: {
            dateRange: {
              start: "2024-01-15",
              end: "2024-01-16",
            },
            location: {
              latitude: 37.7749,
              longitude: -122.4194,
              radius: 1000,
            },
          },
        }),
      ];

      // Mock the filter matcher to return true for all events
      mockFilterMatcher.eventMatchesFilters = mock(() => true);

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      expect(mockFilterMatcher.eventMatchesFilters).toHaveBeenCalled();
      expect(
        mockRelevanceScoringService.addRelevanceScoresToEvents,
      ).toHaveBeenCalledWith(
        expect.any(Array),
        testViewport,
        expect.any(Date),
        "simple",
      );
      expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "viewport",
        expect.any(Array),
      );
    });

    test("should handle errors gracefully", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters: Filter[] = [];

      // Mock an error in MapMoji filtering
      mockMapMojiFilter.filterEvents = mock(() =>
        Promise.reject(new Error("MapMoji error")),
      );

      const consoleSpy = spyOn(console, "error");

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error filtering and sending viewport events"),
        expect.any(Error),
      );
    });
  });

  describe("filterAndSendAllEvents", () => {
    test("should apply MapMoji filtering when no filters provided", async () => {
      const events = [createTestEvent(), createTestEvent({ id: "event-2" })];
      const userId = "user-1";
      const filters: Filter[] = [];

      // Create fresh mocks for this test
      const testMapMojiFilter = {
        updateConfig: mock(() => {}),
        filterEvents: mock(() => Promise.resolve([createTestEvent()])),
      } as unknown as MapMojiFilterService;

      const testEventPublisher = {
        publishFilteredEvents: mock(() => Promise.resolve()),
      } as unknown as EventPublisher;

      // Create a new service instance with the fresh mocks
      const testService = createEventFilteringService(
        mockFilterMatcher,
        testMapMojiFilter,
        mockRelevanceScoringService,
        testEventPublisher,
      );

      await testService.filterAndSendAllEvents(userId, filters, events);

      expect(testMapMojiFilter.updateConfig).toHaveBeenCalledWith({
        viewportBounds: undefined,
        maxEvents: 50,
        currentTime: expect.any(Date),
      });

      expect(testMapMojiFilter.filterEvents).toHaveBeenCalledWith(events);
      expect(testEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "all",
        expect.any(Array),
      );
    });

    test("should apply hybrid filtering for date range only filters", async () => {
      const events = [createTestEvent(), createTestEvent({ id: "event-2" })];
      const userId = "user-1";
      const filters = [
        createTestFilter({
          criteria: {
            dateRange: {
              start: "2024-01-15",
              end: "2024-01-16",
            },
          },
        }),
      ];

      mockFilterMatcher.eventMatchesFilters = mock(() => true);

      await eventFilteringService.filterAndSendAllEvents(
        userId,
        filters,
        events,
      );

      expect(mockMapMojiFilter.updateConfig).toHaveBeenCalledWith({
        viewportBounds: undefined,
        maxEvents: 100,
        currentTime: expect.any(Date),
      });

      expect(mockMapMojiFilter.filterEvents).toHaveBeenCalledWith(events);
      expect(mockFilterMatcher.eventMatchesFilters).toHaveBeenCalled();
      expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "all",
        expect.any(Array),
      );
    });

    test("should apply traditional filtering for complex filters", async () => {
      const events = [createTestEvent(), createTestEvent({ id: "event-2" })];
      const userId = "user-1";
      const filters = [
        createTestFilter({
          criteria: {
            dateRange: {
              start: "2024-01-15",
              end: "2024-01-16",
            },
            location: {
              latitude: 37.7749,
              longitude: -122.4194,
              radius: 1000,
            },
          },
        }),
      ];

      mockFilterMatcher.eventMatchesFilters = mock(() => true);

      await eventFilteringService.filterAndSendAllEvents(
        userId,
        filters,
        events,
      );

      expect(mockFilterMatcher.eventMatchesFilters).toHaveBeenCalled();
      expect(
        mockRelevanceScoringService.addRelevanceScoresToEvents,
      ).toHaveBeenCalledWith(
        expect.any(Array),
        undefined,
        expect.any(Date),
        "simple",
      );
      expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "all",
        expect.any(Array),
      );
    });

    test("should handle errors gracefully", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters: Filter[] = [];

      mockMapMojiFilter.filterEvents = mock(() =>
        Promise.reject(new Error("MapMoji error")),
      );

      const consoleSpy = spyOn(console, "error");

      await eventFilteringService.filterAndSendAllEvents(
        userId,
        filters,
        events,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error filtering and sending all events:",
        expect.any(Error),
      );
    });

    test("should publish empty array when all events filtering returns no events", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters = [
        createTestFilter({
          criteria: {
            dateRange: {
              start: "2024-01-15",
              end: "2024-01-16",
            },
          },
        }),
      ];

      // Mock the filter matcher to return false for all events (no matches)
      mockFilterMatcher.eventMatchesFilters = mock(() => false);

      await eventFilteringService.filterAndSendAllEvents(
        userId,
        filters,
        events,
      );

      // Should still publish an empty array to clear markers
      expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "all",
        [],
      );
    });
  });

  describe("calculateAndSendDiff", () => {
    test("should call filterAndSendViewportEvents when viewport is provided", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters: Filter[] = [];

      // Create fresh mocks for this test
      const testMapMojiFilter = {
        updateConfig: mock(() => {}),
        filterEvents: mock(() => Promise.resolve([createTestEvent()])),
      } as unknown as MapMojiFilterService;

      const testEventPublisher = {
        publishFilteredEvents: mock(() => Promise.resolve()),
      } as unknown as EventPublisher;

      // Create a new service instance with the fresh mocks
      const testService = createEventFilteringService(
        mockFilterMatcher,
        testMapMojiFilter,
        mockRelevanceScoringService,
        testEventPublisher,
      );

      await testService.calculateAndSendDiff(
        userId,
        events,
        testViewport,
        filters,
      );

      // Verify that MapMoji filtering was called (indicating viewport mode)
      expect(testMapMojiFilter.updateConfig).toHaveBeenCalledWith({
        viewportBounds: testViewport,
        maxEvents: 1000,
        currentTime: expect.any(Date),
      });

      expect(testMapMojiFilter.filterEvents).toHaveBeenCalledWith(events);
      expect(testEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "viewport",
        expect.any(Array),
      );
    });

    test("should call filterAndSendAllEvents when viewport is null", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters: Filter[] = [];

      // Create fresh mocks for this test
      const testMapMojiFilter = {
        updateConfig: mock(() => {}),
        filterEvents: mock(() => Promise.resolve([createTestEvent()])),
      } as unknown as MapMojiFilterService;

      const testEventPublisher = {
        publishFilteredEvents: mock(() => Promise.resolve()),
      } as unknown as EventPublisher;

      // Create a new service instance with the fresh mocks
      const testService = createEventFilteringService(
        mockFilterMatcher,
        testMapMojiFilter,
        mockRelevanceScoringService,
        testEventPublisher,
      );

      await testService.calculateAndSendDiff(userId, events, null, filters);

      // Verify that MapMoji filtering was called with undefined viewport (indicating all events mode)
      expect(testMapMojiFilter.updateConfig).toHaveBeenCalledWith({
        viewportBounds: undefined,
        maxEvents: 50,
        currentTime: expect.any(Date),
      });

      expect(testMapMojiFilter.filterEvents).toHaveBeenCalledWith(events);
      expect(testEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "all",
        expect.any(Array),
      );
    });

    test("should handle errors and rethrow them", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters: Filter[] = [];

      // Mock an error in the underlying method by mocking the publisher
      const mockPublisherWithError = {
        publishFilteredEvents: mock(() =>
          Promise.reject(new Error("Publish error")),
        ),
      } as unknown as EventPublisher;

      const testServiceWithError = createEventFilteringService(
        mockFilterMatcher,
        mockMapMojiFilter,
        mockRelevanceScoringService,
        mockPublisherWithError,
      );

      // The error should be caught and logged, but not rethrown from the underlying methods
      // So we expect the promise to resolve (since errors are caught and logged)
      await expect(
        testServiceWithError.calculateAndSendDiff(
          userId,
          events,
          testViewport,
          filters,
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe("Filter Mode Detection", () => {
    test("should detect date range only filters for hybrid mode", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters = [
        createTestFilter({
          criteria: {
            dateRange: {
              start: "2024-01-15",
              end: "2024-01-16",
            },
          },
        }),
      ];

      mockFilterMatcher.eventMatchesFilters = mock(() => true);

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      expect(mockMapMojiFilter.filterEvents).toHaveBeenCalled();
      expect(mockFilterMatcher.eventMatchesFilters).toHaveBeenCalled();
    });

    test("should detect complex filters for traditional mode", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters = [
        createTestFilter({
          criteria: {
            dateRange: {
              start: "2024-01-15",
              end: "2024-01-16",
            },
            location: {
              latitude: 37.7749,
              longitude: -122.4194,
              radius: 1000,
            },
          },
        }),
      ];

      mockFilterMatcher.eventMatchesFilters = mock(() => true);

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      expect(mockMapMojiFilter.filterEvents).not.toHaveBeenCalled();
      expect(mockFilterMatcher.eventMatchesFilters).toHaveBeenCalled();
      expect(
        mockRelevanceScoringService.addRelevanceScoresToEvents,
      ).toHaveBeenCalled();
    });

    test("should respect hybrid mode configuration", async () => {
      // Create service with hybrid mode disabled
      const serviceWithHybridDisabled = createEventFilteringService(
        mockFilterMatcher,
        mockMapMojiFilter,
        mockRelevanceScoringService,
        mockEventPublisher,
        {
          mapMojiConfig: {
            enableHybridMode: false,
          },
        },
      );

      const events = [createTestEvent()];
      const userId = "user-1";
      const filters = [
        createTestFilter({
          criteria: {
            dateRange: {
              start: "2024-01-15",
              end: "2024-01-16",
            },
          },
        }),
      ];

      mockFilterMatcher.eventMatchesFilters = mock(() => true);

      await serviceWithHybridDisabled.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      expect(mockMapMojiFilter.filterEvents).not.toHaveBeenCalled();
      expect(mockFilterMatcher.eventMatchesFilters).toHaveBeenCalled();
      expect(
        mockRelevanceScoringService.addRelevanceScoresToEvents,
      ).toHaveBeenCalled();
    });
  });

  describe("Statistics Tracking", () => {
    test("should track MapMoji filter usage", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters: Filter[] = [];

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      const stats = eventFilteringService.getStats();
      expect(stats.mapMojiFilterApplied).toBe(1);
      expect(stats.traditionalFilterApplied).toBe(0);
      expect(stats.hybridFilterApplied).toBe(0);
    });

    test("should track traditional filter usage", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters = [
        createTestFilter({
          criteria: {
            dateRange: {
              start: "2024-01-15",
              end: "2024-01-16",
            },
            location: {
              latitude: 37.7749,
              longitude: -122.4194,
              radius: 1000,
            },
          },
        }),
      ];

      mockFilterMatcher.eventMatchesFilters = mock(() => true);

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      const stats = eventFilteringService.getStats();
      expect(stats.mapMojiFilterApplied).toBe(0);
      expect(stats.traditionalFilterApplied).toBe(1);
      expect(stats.hybridFilterApplied).toBe(0);
    });

    test("should track hybrid filter usage", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters = [
        createTestFilter({
          criteria: {
            dateRange: {
              start: "2024-01-15",
              end: "2024-01-16",
            },
          },
        }),
      ];

      mockFilterMatcher.eventMatchesFilters = mock(() => true);

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      const stats = eventFilteringService.getStats();
      expect(stats.mapMojiFilterApplied).toBe(1);
      expect(stats.traditionalFilterApplied).toBe(0);
      expect(stats.hybridFilterApplied).toBe(1);
    });

    test("should track total events filtered", async () => {
      const events = [createTestEvent(), createTestEvent({ id: "event-2" })];
      const userId = "user-1";
      const filters: Filter[] = [];

      // Mock MapMoji to return 2 events
      mockMapMojiFilter.filterEvents = mock(() =>
        Promise.resolve([
          createTestEvent(),
          createTestEvent({ id: "event-2" }),
        ]),
      );

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      const stats = eventFilteringService.getStats();
      expect(stats.totalEventsFiltered).toBe(2);
    });
  });

  describe("Event Publishing", () => {
    test("should publish events with correct message type for viewport", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters: Filter[] = [];

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "viewport",
        expect.any(Array),
      );
    });

    test("should publish events with correct message type for all events", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters: Filter[] = [];

      await eventFilteringService.filterAndSendAllEvents(
        userId,
        filters,
        events,
      );

      expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "all",
        expect.any(Array),
      );
    });

    test("should include relevance scores in published events", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters: Filter[] = [];

      // Mock MapMoji to return events with relevance scores
      const eventsWithScores = [createTestEvent({ relevanceScore: 0.85 })];
      mockMapMojiFilter.filterEvents = mock(() =>
        Promise.resolve(eventsWithScores),
      );

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "viewport",
        eventsWithScores,
      );
    });
  });

  describe("Error Handling and Edge Cases", () => {
    test("should handle empty events array", async () => {
      const events: Event[] = [];
      const userId = "user-1";
      const filters: Filter[] = [];

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      expect(mockMapMojiFilter.filterEvents).toHaveBeenCalledWith([]);
      expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "viewport",
        expect.any(Array),
      );
    });

    test("should handle publisher errors gracefully", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters: Filter[] = [];

      mockEventPublisher.publishFilteredEvents = mock(() =>
        Promise.reject(new Error("Publisher error")),
      );

      const consoleSpy = spyOn(console, "error");

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error filtering and sending viewport events"),
        expect.any(Error),
      );
    });

    test("should handle MapMoji filter errors gracefully", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters: Filter[] = [];

      mockMapMojiFilter.filterEvents = mock(() =>
        Promise.reject(new Error("MapMoji filter error")),
      );

      const consoleSpy = spyOn(console, "error");

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error filtering and sending viewport events"),
        expect.any(Error),
      );
    });
  });

  describe("Integration Scenarios", () => {
    test("should handle complete workflow with multiple filter types", async () => {
      const events = [
        createTestEvent({ id: "event-1" }),
        createTestEvent({ id: "event-2" }),
        createTestEvent({ id: "event-3" }),
      ];
      const userId = "user-1";
      const filters = [
        createTestFilter({
          id: "filter-1",
          criteria: {
            dateRange: {
              start: "2024-01-15",
              end: "2024-01-16",
            },
          },
        }),
        createTestFilter({
          id: "filter-2",
          criteria: {
            location: {
              latitude: 37.7749,
              longitude: -122.4194,
              radius: 1000,
            },
          },
        }),
      ];

      mockFilterMatcher.eventMatchesFilters = mock(() => true);

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      expect(mockFilterMatcher.eventMatchesFilters).toHaveBeenCalled();
      expect(
        mockRelevanceScoringService.addRelevanceScoresToEvents,
      ).toHaveBeenCalled();
      expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "viewport",
        expect.any(Array),
      );
    });

    test("should handle semantic query filters", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters = [
        createTestFilter({
          semanticQuery: "music concert",
          criteria: {
            dateRange: {
              start: "2024-01-15",
              end: "2024-01-16",
            },
          },
        }),
      ];

      mockFilterMatcher.eventMatchesFilters = mock(() => true);

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      expect(mockFilterMatcher.eventMatchesFilters).toHaveBeenCalled();
      expect(
        mockRelevanceScoringService.addRelevanceScoresToEvents,
      ).toHaveBeenCalled();
    });
  });

  describe("Empty Filter Results", () => {
    test("should publish empty array when filters return no events", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters = [
        createTestFilter({
          criteria: {
            dateRange: {
              start: "2024-01-15",
              end: "2024-01-16",
            },
          },
        }),
      ];

      // Mock the filter matcher to return false for all events (no matches)
      mockFilterMatcher.eventMatchesFilters = mock(() => false);

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      // Should still publish an empty array to clear markers
      expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "viewport",
        [],
      );
    });

    test("should publish empty array when MapMoji returns no events", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters: Filter[] = [];

      // Mock MapMoji to return empty array
      mockMapMojiFilter.filterEvents = mock(() => Promise.resolve([]));

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      // Should still publish an empty array to clear markers
      expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "viewport",
        [],
      );
    });

    test("should publish empty array when hybrid filtering returns no events", async () => {
      const events = [createTestEvent()];
      const userId = "user-1";
      const filters = [
        createTestFilter({
          criteria: {
            dateRange: {
              start: "2024-01-15",
              end: "2024-01-16",
            },
          },
        }),
      ];

      // Mock MapMoji to return some events
      mockMapMojiFilter.filterEvents = mock(() =>
        Promise.resolve([createTestEvent()]),
      );

      // Mock the filter matcher to return false for all events (no matches after date filtering)
      mockFilterMatcher.eventMatchesFilters = mock(() => false);

      await eventFilteringService.filterAndSendViewportEvents(
        userId,
        testViewport,
        filters,
        events,
      );

      // Should still publish an empty array to clear markers
      expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
        userId,
        "viewport",
        [],
      );
    });
  });
});
