import { Event, BoundingBox, Filter } from "../types/types";
import { FilterMatcher } from "../handlers/FilterMatcher";
import { ViewportProcessor } from "../handlers/ViewportProcessor";
import { EventPublisher } from "../handlers/EventPublisher";
import { RelevanceScoringService } from "./RelevanceScoringService";
import { MapMojiFilterService } from "./MapMojiFilterService";

export interface UserNotificationService {
  notifyAffectedUsers(
    affectedUsers: Set<string>,
    event: { operation: string; record: Event },
  ): Promise<void>;

  getAffectedUsers(event: Event): Promise<Set<string>>;

  getStats(): Record<string, unknown>;
}

export interface UserNotificationServiceConfig {
  enableMapMojiPreFiltering?: boolean;
  enableHybridMode?: boolean;
}

export function createUserNotificationService(
  filterMatcher: FilterMatcher,
  viewportProcessor: ViewportProcessor,
  eventPublisher: EventPublisher,
  relevanceScoringService: RelevanceScoringService,
  mapMojiFilter: MapMojiFilterService,
  getUserFilters: (userId: string) => Filter[],
  getUserViewport: (userId: string) => BoundingBox | undefined,
  config: UserNotificationServiceConfig = {},
): UserNotificationService {
  const { enableMapMojiPreFiltering = true, enableHybridMode = true } = config;

  // Stats for monitoring
  const stats = {
    notificationsSent: 0,
    affectedUsersCalculated: 0,
    mapMojiPreFilterApplied: 0,
    traditionalFilterApplied: 0,
    hybridFilterApplied: 0,
  };

  /**
   * Get users affected by an event update
   */
  async function getAffectedUsers(event: Event): Promise<Set<string>> {
    const affectedUsers = new Set<string>();

    try {
      // Calculate event's spatial bounds
      const [lng, lat] = event.location.coordinates;
      const eventBounds = {
        minX: lng,
        minY: lat,
        maxX: lng,
        maxY: lat,
      };

      // Get all viewports that intersect with this event
      const intersectingViewports =
        await viewportProcessor.getIntersectingViewports(eventBounds);

      console.log("[UserNotification] Intersecting viewports:", {
        eventId: event.id,
        intersectingViewports: intersectingViewports.map((v) => v.userId),
      });

      // Add users from intersecting viewports, but only if they have access to the event
      for (const { userId } of intersectingViewports) {
        // Check if user has access to the event before adding them
        const hasAccess = filterMatcher.isEventAccessible(event, userId);
        console.log("[UserNotification] User access check:", {
          eventId: event.id,
          userId,
          hasAccess,
          isPrivate: event.isPrivate,
          creatorId: event.creatorId,
          sharedWith: event.sharedWith?.map((s) => s.sharedWithId),
        });

        if (hasAccess) {
          affectedUsers.add(userId);
        }
      }

      // Add users who might see the event regardless of viewport
      // This would typically come from a user state service
      // For now, we'll assume all users with filters should be checked
      // In a real implementation, you'd get this from the user state service

      stats.affectedUsersCalculated += affectedUsers.size;
    } catch (error) {
      console.error("[UserNotification] Error getting affected users:", error);
    }

    return affectedUsers;
  }

  /**
   * Notify affected users about an event update
   */
  async function notifyAffectedUsers(
    affectedUsers: Set<string>,
    event: { operation: string; record: Event },
  ): Promise<void> {
    const { operation, record } = event;

    console.log("[UserNotification] Notifying affected users:", {
      eventId: record.id,
      operation,
      affectedUserCount: affectedUsers.size,
      isPrivate: record.isPrivate,
      creatorId: record.creatorId,
    });

    for (const userId of affectedUsers) {
      const filters = getUserFilters(userId);
      const viewport = getUserViewport(userId);

      let shouldSendEvent = false;

      if (filters.length === 0) {
        // No custom filters - check if event would pass MapMoji pre-filtering
        if (enableMapMojiPreFiltering) {
          console.log(
            `[UserNotification] Checking MapMoji pre-filtering for user ${userId} (no custom filters)`,
          );

          shouldSendEvent = await checkMapMojiPreFiltering(record, viewport);
          stats.mapMojiPreFilterApplied++;
        } else {
          shouldSendEvent = true; // Send to all users without filters
        }
      } else {
        // Check if we have date range filters only (hybrid mode)
        const hasDateRangeOnly = filters.every(
          (filter) =>
            filter.criteria.dateRange &&
            !filter.criteria.location &&
            !filter.semanticQuery,
        );

        if (hasDateRangeOnly && enableHybridMode) {
          // Hybrid mode: Check MapMoji pre-filtering first, then date range filters
          console.log(
            `[UserNotification] Checking hybrid filtering for user ${userId} (MapMoji + date range)`,
          );

          shouldSendEvent = await checkHybridFiltering(
            record,
            viewport,
            filters,
            userId,
          );
          stats.hybridFilterApplied++;
        } else {
          // Traditional filtering mode - use traditional filtering
          console.log(
            `[UserNotification] Using traditional filters for user ${userId} (${filters.length} filters)`,
          );

          shouldSendEvent = await checkTraditionalFiltering(
            record,
            viewport,
            filters,
            userId,
          );
          stats.traditionalFilterApplied++;
        }
      }

      if (shouldSendEvent) {
        // Add relevance score to the event before sending
        const eventWithRelevanceScore =
          relevanceScoringService.addRelevanceScoresToEvents(
            [record],
            viewport,
            new Date(),
            "simple",
          )[0];

        switch (operation) {
          case "CREATE":
          case "INSERT":
            console.log("[UserNotification] Publishing new event to user:", {
              eventId: record.id,
              userId,
              operation,
              isPrivate: record.isPrivate,
              creatorId: record.creatorId,
              relevanceScore: eventWithRelevanceScore.relevanceScore,
            });
            await eventPublisher.publishFilteredEvents(userId, "add", [
              eventWithRelevanceScore,
            ]);
            break;
          case "UPDATE":
            await eventPublisher.publishUpdateEvent(
              userId,
              eventWithRelevanceScore,
            );
            break;
          case "DELETE":
            await eventPublisher.publishDeleteEvent(userId, record.id);
            break;
        }
        stats.notificationsSent++;
      } else if (operation === "UPDATE" || operation === "DELETE") {
        // If event is no longer visible to user, send delete
        await eventPublisher.publishDeleteEvent(userId, record.id);
        stats.notificationsSent++;
      }
    }
  }

  /**
   * Check if event passes MapMoji pre-filtering
   */
  async function checkMapMojiPreFiltering(
    record: Event,
    viewport?: BoundingBox,
  ): Promise<boolean> {
    // Update MapMoji configuration to check pre-filtering
    mapMojiFilter.updateConfig({
      viewportBounds: viewport || {
        minX: -180,
        minY: -90,
        maxX: 180,
        maxY: 90,
      },
      currentTime: new Date(),
    });

    // Check if event passes basic MapMoji criteria (status, viewport, time)
    const now = new Date();
    const eventDate = new Date(record.eventDate);

    // Basic pre-filter checks
    const validStatus =
      record.status !== "REJECTED" && record.status !== "EXPIRED";
    const inViewport = viewport
      ? viewportProcessor.isEventInViewport(record, viewport)
      : true;
    const notTooFarPast =
      eventDate >= new Date(now.getTime() - 24 * 60 * 60 * 1000); // Within 24h past
    const notTooFarFuture =
      eventDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Within 30 days future

    const shouldSendEvent =
      validStatus && inViewport && notTooFarPast && notTooFarFuture;

    console.log("[UserNotification] MapMoji pre-filter result:", {
      eventId: record.id,
      validStatus,
      inViewport,
      notTooFarPast,
      notTooFarFuture,
      shouldSendEvent,
    });

    return shouldSendEvent;
  }

  /**
   * Check if event passes hybrid filtering (MapMoji + date range)
   */
  async function checkHybridFiltering(
    record: Event,
    viewport: BoundingBox | undefined,
    filters: Filter[],
    userId: string,
  ): Promise<boolean> {
    // Update MapMoji configuration to check pre-filtering
    mapMojiFilter.updateConfig({
      viewportBounds: viewport || {
        minX: -180,
        minY: -90,
        maxX: 180,
        maxY: 90,
      },
      currentTime: new Date(),
    });

    // Check if event passes basic MapMoji criteria (status, viewport, time)
    const now = new Date();
    const eventDate = new Date(record.eventDate);

    // Basic pre-filter checks
    const validStatus =
      record.status !== "REJECTED" && record.status !== "EXPIRED";
    const inViewport = viewport
      ? viewportProcessor.isEventInViewport(record, viewport)
      : true;
    const notTooFarPast =
      eventDate >= new Date(now.getTime() - 24 * 60 * 60 * 1000); // Within 24h past
    const notTooFarFuture =
      eventDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Within 30 days future

    const passesMapMoji =
      validStatus && inViewport && notTooFarPast && notTooFarFuture;

    // If passes MapMoji, check date range filters
    const matchesDateRange = passesMapMoji
      ? filterMatcher.eventMatchesFilters(record, filters, userId)
      : false;

    console.log("[UserNotification] Hybrid filter result:", {
      eventId: record.id,
      validStatus,
      inViewport,
      notTooFarPast,
      notTooFarFuture,
      passesMapMoji,
      matchesDateRange,
      shouldSendEvent: matchesDateRange,
    });

    return matchesDateRange;
  }

  /**
   * Check if event passes traditional filtering
   */
  async function checkTraditionalFiltering(
    record: Event,
    viewport: BoundingBox | undefined,
    filters: Filter[],
    userId: string,
  ): Promise<boolean> {
    // Check if event matches user's filters
    const matchesFilters = filterMatcher.eventMatchesFilters(
      record,
      filters,
      userId,
    );

    // Check if event is in user's viewport
    const inViewport = viewport
      ? viewportProcessor.isEventInViewport(record, viewport)
      : true;

    const shouldSendEvent = matchesFilters && inViewport;

    console.log("[UserNotification] Traditional filter result:", {
      eventId: record.id,
      userId,
      matchesFilters,
      inViewport,
      hasViewport: !!viewport,
      filterCount: filters.length,
      shouldSendEvent,
    });

    return shouldSendEvent;
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
    notifyAffectedUsers,
    getAffectedUsers,
    getStats,
  };
}
