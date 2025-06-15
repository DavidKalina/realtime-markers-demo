import { describe, test, expect, beforeEach, mock } from "bun:test";
import {
  createUserNotificationService,
  UserNotificationService,
  UserNotificationServiceConfig,
} from "../src/services/UserNotificationService";
import { Event, BoundingBox, Filter, EventStatus } from "../src/types/types";

// Import the actual interfaces to create compatible mock types
import type { FilterMatcher } from "../src/handlers/FilterMatcher";
import type { ViewportProcessor } from "../src/handlers/ViewportProcessor";
import type { EventPublisher } from "../src/handlers/EventPublisher";
import type { RelevanceScoringService } from "../src/services/RelevanceScoringService";
import type { MapMojiFilterService } from "../src/services/MapMojiFilterService";

// Create mock types that preserve mock methods while being compatible with real interfaces
interface MockFilterMatcher
  extends Pick<FilterMatcher, "isEventAccessible" | "eventMatchesFilters"> {
  isEventAccessible: ReturnType<typeof mock>;
  eventMatchesFilters: ReturnType<typeof mock>;
}

interface MockViewportProcessor
  extends Pick<
    ViewportProcessor,
    "getIntersectingViewports" | "isEventInViewport"
  > {
  getIntersectingViewports: ReturnType<typeof mock>;
  isEventInViewport: ReturnType<typeof mock>;
}

interface MockEventPublisher
  extends Pick<
    EventPublisher,
    "publishFilteredEvents" | "publishUpdateEvent" | "publishDeleteEvent"
  > {
  publishFilteredEvents: ReturnType<typeof mock>;
  publishUpdateEvent: ReturnType<typeof mock>;
  publishDeleteEvent: ReturnType<typeof mock>;
}

interface MockRelevanceScoringService
  extends Pick<RelevanceScoringService, "addRelevanceScoresToEvents"> {
  addRelevanceScoresToEvents: ReturnType<typeof mock>;
}

interface MockMapMojiFilter extends Pick<MapMojiFilterService, "updateConfig"> {
  updateConfig: ReturnType<typeof mock>;
}

// Mock dependencies
const mockFilterMatcher: MockFilterMatcher = {
  isEventAccessible: mock(() => true),
  eventMatchesFilters: mock(() => true),
};

const mockViewportProcessor: MockViewportProcessor = {
  getIntersectingViewports: mock(() => Promise.resolve([])),
  isEventInViewport: mock(() => true),
};

const mockEventPublisher: MockEventPublisher = {
  publishFilteredEvents: mock(() => Promise.resolve()),
  publishUpdateEvent: mock(() => Promise.resolve()),
  publishDeleteEvent: mock(() => Promise.resolve()),
};

const mockRelevanceScoringService: MockRelevanceScoringService = {
  addRelevanceScoresToEvents: mock((events) =>
    events.map((event) => ({ ...event, relevanceScore: 0.5 })),
  ),
};

const mockMapMojiFilter: MockMapMojiFilter = {
  updateConfig: mock(() => {}),
};

const mockGetUserFilters = mock(() => []);
const mockGetUserViewport = mock(() => undefined);

describe("UserNotificationService", () => {
  let userNotificationService: UserNotificationService;
  let config: UserNotificationServiceConfig;

  // Test data
  const testUserId = "user-123";
  const testUserId2 = "user-456";
  const testUserId3 = "user-789";

  const testEvent: Event = {
    id: "event-123",
    title: "Test Event",
    description: "A test event",
    eventDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow - within MapMoji range
    location: {
      type: "Point",
      coordinates: [-74.006, 40.7128],
    },
    scanCount: 0,
    saveCount: 0,
    status: EventStatus.VERIFIED,
    creatorId: "creator-123",
    isPrivate: false,
    isRecurring: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const testViewport: BoundingBox = {
    minX: -74.006,
    minY: 40.7128,
    maxX: -73.996,
    maxY: 40.7228,
  };

  const testFilters: Filter[] = [
    {
      id: "filter-1",
      userId: testUserId,
      name: "Date Range Filter",
      isActive: true,
      criteria: {
        dateRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0], // 7 days ago
          end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0], // 30 days from now
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    // Reset all mocks
    mockFilterMatcher.isEventAccessible.mockClear();
    mockFilterMatcher.eventMatchesFilters.mockClear();
    mockViewportProcessor.getIntersectingViewports.mockClear();
    mockViewportProcessor.isEventInViewport.mockClear();
    mockEventPublisher.publishFilteredEvents.mockClear();
    mockEventPublisher.publishUpdateEvent.mockClear();
    mockEventPublisher.publishDeleteEvent.mockClear();
    mockRelevanceScoringService.addRelevanceScoresToEvents.mockClear();
    mockMapMojiFilter.updateConfig.mockClear();
    mockGetUserFilters.mockClear();
    mockGetUserViewport.mockClear();

    // Default configuration
    config = {
      enableMapMojiPreFiltering: true,
      enableHybridMode: true,
    };

    // Create service instance
    userNotificationService = createUserNotificationService(
      mockFilterMatcher as unknown as FilterMatcher,
      mockViewportProcessor as unknown as ViewportProcessor,
      mockEventPublisher as unknown as EventPublisher,
      mockRelevanceScoringService as unknown as RelevanceScoringService,
      mockMapMojiFilter as unknown as MapMojiFilterService,
      mockGetUserFilters,
      mockGetUserViewport,
      config,
    );
  });

  describe("getAffectedUsers", () => {
    test("should return empty set when no intersecting viewports", async () => {
      mockViewportProcessor.getIntersectingViewports.mockResolvedValue([]);

      const affectedUsers =
        await userNotificationService.getAffectedUsers(testEvent);

      expect(affectedUsers).toEqual(new Set());
      expect(
        mockViewportProcessor.getIntersectingViewports,
      ).toHaveBeenCalledWith({
        minX: -74.006,
        minY: 40.7128,
        maxX: -74.006,
        maxY: 40.7128,
      });
    });

    test("should return users with access from intersecting viewports", async () => {
      const intersectingViewports = [
        { userId: testUserId },
        { userId: testUserId2 },
      ];
      mockViewportProcessor.getIntersectingViewports.mockResolvedValue(
        intersectingViewports,
      );
      mockFilterMatcher.isEventAccessible
        .mockReturnValueOnce(true) // user-123 has access
        .mockReturnValueOnce(false); // user-456 doesn't have access

      const affectedUsers =
        await userNotificationService.getAffectedUsers(testEvent);

      expect(affectedUsers).toEqual(new Set([testUserId]));
      expect(mockFilterMatcher.isEventAccessible).toHaveBeenCalledTimes(2);
    });

    test("should handle errors gracefully", async () => {
      mockViewportProcessor.getIntersectingViewports.mockRejectedValue(
        new Error("Test error"),
      );

      const affectedUsers =
        await userNotificationService.getAffectedUsers(testEvent);

      expect(affectedUsers).toEqual(new Set());
    });

    test("should update stats correctly", async () => {
      const intersectingViewports = [{ userId: testUserId }];
      mockViewportProcessor.getIntersectingViewports.mockResolvedValue(
        intersectingViewports,
      );
      mockFilterMatcher.isEventAccessible.mockReturnValue(true);

      await userNotificationService.getAffectedUsers(testEvent);

      const stats = userNotificationService.getStats();
      expect(stats.affectedUsersCalculated).toBe(1);
    });
  });

  describe("notifyAffectedUsers", () => {
    const affectedUsers = new Set([testUserId, testUserId2]);

    describe("CREATE/INSERT operations", () => {
      test("should send events to users with no filters using MapMoji pre-filtering", async () => {
        mockGetUserFilters.mockReturnValue([]);
        mockGetUserViewport.mockReturnValue(testViewport);
        mockViewportProcessor.isEventInViewport.mockReturnValue(true);

        await userNotificationService.notifyAffectedUsers(affectedUsers, {
          operation: "CREATE",
          record: testEvent,
        });

        expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
          testUserId,
          "add",
          expect.arrayContaining([
            expect.objectContaining({
              id: testEvent.id,
              relevanceScore: 0.5,
            }),
          ]),
        );
        expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledWith(
          testUserId2,
          "add",
          expect.arrayContaining([
            expect.objectContaining({
              id: testEvent.id,
              relevanceScore: 0.5,
            }),
          ]),
        );
      });

      test("should send events to all users when MapMoji pre-filtering is disabled", async () => {
        const service = createUserNotificationService(
          mockFilterMatcher as unknown as FilterMatcher,
          mockViewportProcessor as unknown as ViewportProcessor,
          mockEventPublisher as unknown as EventPublisher,
          mockRelevanceScoringService as unknown as RelevanceScoringService,
          mockMapMojiFilter as unknown as MapMojiFilterService,
          mockGetUserFilters,
          mockGetUserViewport,
          { enableMapMojiPreFiltering: false },
        );

        mockGetUserFilters.mockReturnValue([]);

        await service.notifyAffectedUsers(affectedUsers, {
          operation: "INSERT",
          record: testEvent,
        });

        expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalledTimes(
          2,
        );
      });

      test("should not send events when MapMoji pre-filtering fails", async () => {
        mockGetUserFilters.mockReturnValue([]);
        mockGetUserViewport.mockReturnValue(testViewport);
        mockViewportProcessor.isEventInViewport.mockReturnValue(false); // Event not in viewport

        await userNotificationService.notifyAffectedUsers(affectedUsers, {
          operation: "CREATE",
          record: testEvent,
        });

        expect(mockEventPublisher.publishFilteredEvents).not.toHaveBeenCalled();
      });
    });

    describe("UPDATE operations", () => {
      test("should send update events when event passes filters", async () => {
        mockGetUserFilters.mockReturnValue(testFilters);
        mockGetUserViewport.mockReturnValue(testViewport);
        mockFilterMatcher.eventMatchesFilters.mockReturnValue(true);
        mockViewportProcessor.isEventInViewport.mockReturnValue(true);

        await userNotificationService.notifyAffectedUsers(affectedUsers, {
          operation: "UPDATE",
          record: testEvent,
        });

        expect(mockEventPublisher.publishUpdateEvent).toHaveBeenCalledWith(
          testUserId,
          expect.objectContaining({
            id: testEvent.id,
            relevanceScore: 0.5,
          }),
        );
      });

      test("should send delete events when event no longer passes filters", async () => {
        mockGetUserFilters.mockReturnValue(testFilters);
        mockGetUserViewport.mockReturnValue(testViewport);
        mockFilterMatcher.eventMatchesFilters.mockReturnValue(false);

        await userNotificationService.notifyAffectedUsers(affectedUsers, {
          operation: "UPDATE",
          record: testEvent,
        });

        expect(mockEventPublisher.publishDeleteEvent).toHaveBeenCalledWith(
          testUserId,
          testEvent.id,
        );
      });
    });

    describe("DELETE operations", () => {
      test("should send delete events to all affected users", async () => {
        await userNotificationService.notifyAffectedUsers(affectedUsers, {
          operation: "DELETE",
          record: testEvent,
        });

        expect(mockEventPublisher.publishDeleteEvent).toHaveBeenCalledWith(
          testUserId,
          testEvent.id,
        );
        expect(mockEventPublisher.publishDeleteEvent).toHaveBeenCalledWith(
          testUserId2,
          testEvent.id,
        );
      });
    });

    describe("Hybrid filtering mode", () => {
      test("should use hybrid filtering for date range only filters", async () => {
        const dateRangeOnlyFilters: Filter[] = [
          {
            id: "filter-1",
            userId: testUserId,
            name: "Date Range Only",
            isActive: true,
            criteria: {
              dateRange: {
                start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0], // 7 days ago
                end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0], // 30 days from now
              },
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        mockGetUserFilters.mockReturnValue(dateRangeOnlyFilters);
        mockGetUserViewport.mockReturnValue(testViewport);
        mockViewportProcessor.isEventInViewport.mockReturnValue(true);
        mockFilterMatcher.eventMatchesFilters.mockReturnValue(true);

        await userNotificationService.notifyAffectedUsers(affectedUsers, {
          operation: "CREATE",
          record: testEvent,
        });

        expect(mockMapMojiFilter.updateConfig).toHaveBeenCalled();
        expect(mockFilterMatcher.eventMatchesFilters).toHaveBeenCalled();
      });

      test("should not use hybrid filtering when disabled", async () => {
        const service = createUserNotificationService(
          mockFilterMatcher as unknown as FilterMatcher,
          mockViewportProcessor as unknown as ViewportProcessor,
          mockEventPublisher as unknown as EventPublisher,
          mockRelevanceScoringService as unknown as RelevanceScoringService,
          mockMapMojiFilter as unknown as MapMojiFilterService,
          mockGetUserFilters,
          mockGetUserViewport,
          { enableHybridMode: false },
        );

        const dateRangeOnlyFilters: Filter[] = [
          {
            id: "filter-1",
            userId: testUserId,
            name: "Date Range Only",
            isActive: true,
            criteria: {
              dateRange: {
                start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0], // 7 days ago
                end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0], // 30 days from now
              },
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        mockGetUserFilters.mockReturnValue(dateRangeOnlyFilters);
        mockGetUserViewport.mockReturnValue(testViewport);
        mockFilterMatcher.eventMatchesFilters.mockReturnValue(true);
        mockViewportProcessor.isEventInViewport.mockReturnValue(true);

        await service.notifyAffectedUsers(affectedUsers, {
          operation: "CREATE",
          record: testEvent,
        });

        // Should use traditional filtering instead of hybrid
        expect(mockFilterMatcher.eventMatchesFilters).toHaveBeenCalled();
      });
    });

    describe("Traditional filtering mode", () => {
      test("should use traditional filtering for complex filters", async () => {
        const complexFilters: Filter[] = [
          {
            id: "filter-1",
            userId: testUserId,
            name: "Complex Filter",
            isActive: true,
            criteria: {
              dateRange: {
                start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0], // 7 days ago
                end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0], // 30 days from now
              },
              location: {
                latitude: 40.7128,
                longitude: -74.006,
                radius: 5000,
              },
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        mockGetUserFilters.mockReturnValue(complexFilters);
        mockGetUserViewport.mockReturnValue(testViewport);
        mockFilterMatcher.eventMatchesFilters.mockReturnValue(true);
        mockViewportProcessor.isEventInViewport.mockReturnValue(true);

        await userNotificationService.notifyAffectedUsers(affectedUsers, {
          operation: "CREATE",
          record: testEvent,
        });

        expect(mockFilterMatcher.eventMatchesFilters).toHaveBeenCalled();
        expect(mockViewportProcessor.isEventInViewport).toHaveBeenCalled();
      });
    });

    describe("MapMoji pre-filtering", () => {
      test("should check event status", async () => {
        const rejectedEvent = { ...testEvent, status: EventStatus.REJECTED };
        mockGetUserFilters.mockReturnValue([]);
        mockGetUserViewport.mockReturnValue(testViewport);

        await userNotificationService.notifyAffectedUsers(affectedUsers, {
          operation: "CREATE",
          record: rejectedEvent,
        });

        expect(mockEventPublisher.publishFilteredEvents).not.toHaveBeenCalled();
      });

      test("should check event date range", async () => {
        const pastEvent = {
          ...testEvent,
          eventDate: new Date("2020-01-01T10:00:00Z"), // Too far in past
        };
        mockGetUserFilters.mockReturnValue([]);
        mockGetUserViewport.mockReturnValue(testViewport);

        await userNotificationService.notifyAffectedUsers(affectedUsers, {
          operation: "CREATE",
          record: pastEvent,
        });

        expect(mockEventPublisher.publishFilteredEvents).not.toHaveBeenCalled();
      });

      test("should check viewport intersection", async () => {
        mockGetUserFilters.mockReturnValue([]);
        mockGetUserViewport.mockReturnValue(testViewport);
        mockViewportProcessor.isEventInViewport.mockReturnValue(false);

        await userNotificationService.notifyAffectedUsers(affectedUsers, {
          operation: "CREATE",
          record: testEvent,
        });

        expect(mockEventPublisher.publishFilteredEvents).not.toHaveBeenCalled();
      });
    });
  });

  describe("getStats", () => {
    test("should return initial stats", () => {
      const stats = userNotificationService.getStats();

      expect(stats).toEqual({
        notificationsSent: 0,
        affectedUsersCalculated: 0,
        mapMojiPreFilterApplied: 0,
        traditionalFilterApplied: 0,
        hybridFilterApplied: 0,
      });
    });

    test("should track notifications sent", async () => {
      mockGetUserFilters.mockReturnValue([]);
      mockGetUserViewport.mockReturnValue(testViewport);
      mockViewportProcessor.isEventInViewport.mockReturnValue(true);

      await userNotificationService.notifyAffectedUsers(new Set([testUserId]), {
        operation: "CREATE",
        record: testEvent,
      });

      const stats = userNotificationService.getStats();
      expect(stats.notificationsSent).toBe(1);
    });

    test("should track MapMoji pre-filter applications", async () => {
      mockGetUserFilters.mockReturnValue([]);
      mockGetUserViewport.mockReturnValue(testViewport);
      mockViewportProcessor.isEventInViewport.mockReturnValue(true);

      await userNotificationService.notifyAffectedUsers(new Set([testUserId]), {
        operation: "CREATE",
        record: testEvent,
      });

      const stats = userNotificationService.getStats();
      expect(stats.mapMojiPreFilterApplied).toBe(1);
    });

    test("should track traditional filter applications", async () => {
      const complexFilters: Filter[] = [
        {
          id: "filter-1",
          userId: testUserId,
          name: "Complex Filter",
          isActive: true,
          criteria: {
            dateRange: {
              start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0], // 7 days ago
              end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0], // 30 days from now
            },
            location: {
              latitude: 40.7128,
              longitude: -74.006,
              radius: 5000,
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockGetUserFilters.mockReturnValue(complexFilters);
      mockGetUserViewport.mockReturnValue(testViewport);
      mockFilterMatcher.eventMatchesFilters.mockReturnValue(true);
      mockViewportProcessor.isEventInViewport.mockReturnValue(true);

      await userNotificationService.notifyAffectedUsers(new Set([testUserId]), {
        operation: "CREATE",
        record: testEvent,
      });

      const stats = userNotificationService.getStats();
      expect(stats.traditionalFilterApplied).toBe(1);
    });

    test("should track hybrid filter applications", async () => {
      const dateRangeOnlyFilters: Filter[] = [
        {
          id: "filter-1",
          userId: testUserId,
          name: "Date Range Only",
          isActive: true,
          criteria: {
            dateRange: {
              start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0], // 7 days ago
              end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0], // 30 days from now
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockGetUserFilters.mockReturnValue(dateRangeOnlyFilters);
      mockGetUserViewport.mockReturnValue(testViewport);
      mockViewportProcessor.isEventInViewport.mockReturnValue(true);
      mockFilterMatcher.eventMatchesFilters.mockReturnValue(true);

      await userNotificationService.notifyAffectedUsers(new Set([testUserId]), {
        operation: "CREATE",
        record: testEvent,
      });

      const stats = userNotificationService.getStats();
      expect(stats.hybridFilterApplied).toBe(1);
    });
  });

  describe("Configuration", () => {
    test("should use default configuration when none provided", () => {
      const service = createUserNotificationService(
        mockFilterMatcher as unknown as FilterMatcher,
        mockViewportProcessor as unknown as ViewportProcessor,
        mockEventPublisher as unknown as EventPublisher,
        mockRelevanceScoringService as unknown as RelevanceScoringService,
        mockMapMojiFilter as unknown as MapMojiFilterService,
        mockGetUserFilters,
        mockGetUserViewport,
      );

      mockGetUserFilters.mockReturnValue([]);
      mockGetUserViewport.mockReturnValue(testViewport);
      mockViewportProcessor.isEventInViewport.mockReturnValue(true);

      // Should use MapMoji pre-filtering by default
      service.notifyAffectedUsers(new Set([testUserId]), {
        operation: "CREATE",
        record: testEvent,
      });

      expect(mockMapMojiFilter.updateConfig).toHaveBeenCalled();
    });

    test("should respect enableMapMojiPreFiltering configuration", async () => {
      const service = createUserNotificationService(
        mockFilterMatcher as unknown as FilterMatcher,
        mockViewportProcessor as unknown as ViewportProcessor,
        mockEventPublisher as unknown as EventPublisher,
        mockRelevanceScoringService as unknown as RelevanceScoringService,
        mockMapMojiFilter as unknown as MapMojiFilterService,
        mockGetUserFilters,
        mockGetUserViewport,
        { enableMapMojiPreFiltering: false },
      );

      mockGetUserFilters.mockReturnValue([]);

      await service.notifyAffectedUsers(new Set([testUserId]), {
        operation: "CREATE",
        record: testEvent,
      });

      // Should not call MapMoji filter when disabled
      expect(mockMapMojiFilter.updateConfig).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishFilteredEvents).toHaveBeenCalled();
    });

    test("should respect enableHybridMode configuration", async () => {
      const service = createUserNotificationService(
        mockFilterMatcher as unknown as FilterMatcher,
        mockViewportProcessor as unknown as ViewportProcessor,
        mockEventPublisher as unknown as EventPublisher,
        mockRelevanceScoringService as unknown as RelevanceScoringService,
        mockMapMojiFilter as unknown as MapMojiFilterService,
        mockGetUserFilters,
        mockGetUserViewport,
        { enableHybridMode: false },
      );

      const dateRangeOnlyFilters: Filter[] = [
        {
          id: "filter-1",
          userId: testUserId,
          name: "Date Range Only",
          isActive: true,
          criteria: {
            dateRange: {
              start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0], // 7 days ago
              end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0], // 30 days from now
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockGetUserFilters.mockReturnValue(dateRangeOnlyFilters);
      mockGetUserViewport.mockReturnValue(testViewport);
      mockFilterMatcher.eventMatchesFilters.mockReturnValue(true);
      mockViewportProcessor.isEventInViewport.mockReturnValue(true);

      await service.notifyAffectedUsers(new Set([testUserId]), {
        operation: "CREATE",
        record: testEvent,
      });

      // Should use traditional filtering instead of hybrid
      expect(mockFilterMatcher.eventMatchesFilters).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty affected users set", async () => {
      await userNotificationService.notifyAffectedUsers(new Set(), {
        operation: "CREATE",
        record: testEvent,
      });

      expect(mockEventPublisher.publishFilteredEvents).not.toHaveBeenCalled();
    });

    test("should handle undefined viewport", async () => {
      mockGetUserFilters.mockReturnValue([]);
      mockGetUserViewport.mockReturnValue(undefined);

      await userNotificationService.notifyAffectedUsers(new Set([testUserId]), {
        operation: "CREATE",
        record: testEvent,
      });

      expect(mockMapMojiFilter.updateConfig).toHaveBeenCalledWith({
        viewportBounds: {
          minX: -180,
          minY: -90,
          maxX: 180,
          maxY: 90,
        },
        currentTime: expect.any(Date),
      });
    });

    test("should handle multiple users with different filter types", async () => {
      // User 1: No filters (MapMoji pre-filtering)
      // User 2: Date range only (Hybrid filtering)
      // User 3: Complex filters (Traditional filtering)

      const affectedUsers = new Set([testUserId, testUserId2, testUserId3]);

      mockGetUserFilters
        .mockReturnValueOnce([]) // User 1: no filters
        .mockReturnValueOnce([
          {
            id: "filter-1",
            userId: testUserId2,
            name: "Date Range Only",
            isActive: true,
            criteria: {
              dateRange: {
                start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0], // 7 days ago
                end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0], // 30 days from now
              },
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]) // User 2: date range only
        .mockReturnValueOnce([
          {
            id: "filter-2",
            userId: testUserId3,
            name: "Complex Filter",
            isActive: true,
            criteria: {
              dateRange: {
                start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0], // 7 days ago
                end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0], // 30 days from now
              },
              location: {
                latitude: 40.7128,
                longitude: -74.006,
                radius: 5000,
              },
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]); // User 3: complex filters

      mockGetUserViewport.mockReturnValue(testViewport);
      mockViewportProcessor.isEventInViewport.mockReturnValue(true);
      mockFilterMatcher.eventMatchesFilters.mockReturnValue(true);

      await userNotificationService.notifyAffectedUsers(affectedUsers, {
        operation: "CREATE",
        record: testEvent,
      });

      // Should apply all three filtering modes
      const stats = userNotificationService.getStats();
      expect(stats.mapMojiPreFilterApplied).toBe(1);
      expect(stats.hybridFilterApplied).toBe(1);
      expect(stats.traditionalFilterApplied).toBe(1);
      expect(stats.notificationsSent).toBe(3);
    });

    test("should handle errors in relevance scoring", async () => {
      mockGetUserFilters.mockReturnValue([]);
      mockGetUserViewport.mockReturnValue(testViewport);
      mockViewportProcessor.isEventInViewport.mockReturnValue(true);
      mockRelevanceScoringService.addRelevanceScoresToEvents.mockImplementation(
        () => {
          throw new Error("Scoring error");
        },
      );

      // Should not throw and should not send notifications
      await expect(
        userNotificationService.notifyAffectedUsers(new Set([testUserId]), {
          operation: "CREATE",
          record: testEvent,
        }),
      ).rejects.toThrow("Scoring error");
    });
  });
});
