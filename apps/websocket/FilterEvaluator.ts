// src/services/FilterEvaluator.ts
import { Event, EventFilter } from "./filterTypes";
import { Subscription, SubscriptionManager } from "./SubscriptionManager";
import { ViewportManager } from "./ViewportManager";

export class FilterEvaluator {
  private subscriptionManager: SubscriptionManager;
  private viewportManager: ViewportManager;

  constructor(subscriptionManager: SubscriptionManager, viewportManager: ViewportManager) {
    this.subscriptionManager = subscriptionManager;
    this.viewportManager = viewportManager;
  }

  /**
   * Check if an event matches a filter
   */
  matchesFilter(event: Event, filter: EventFilter): boolean {
    // For debugging
    const eventId = event.id;
    let failReason = "";

    // Category filtering
    if (filter.categories && filter.categories.length > 0) {
      const eventCategories = event.categories || [];
      const hasMatchingCategory = filter.categories.some((category) =>
        eventCategories.includes(category)
      );

      if (!hasMatchingCategory) {
        failReason = "categories";
        return false;
      }
    }

    // Status filtering
    if (filter.status && filter.status.length > 0) {
      if (!event.status || !filter.status.includes(event.status)) {
        failReason = "status";
        return false;
      }
    }

    // Date range filtering
    if (filter.dateRange) {
      const eventDate = new Date(event.createdAt);

      if (filter.dateRange.start) {
        const startDate = new Date(filter.dateRange.start);
        if (eventDate < startDate) {
          failReason = "date-start";
          return false;
        }
      }

      if (filter.dateRange.end) {
        const endDate = new Date(filter.dateRange.end);
        if (eventDate > endDate) {
          failReason = "date-end";
          return false;
        }
      }
    }

    // Creator filtering
    if (filter.creatorId && event.creatorId !== filter.creatorId) {
      failReason = "creator";
      return false;
    }

    // Tag filtering
    if (filter.tags && filter.tags.length > 0) {
      const eventTags = event.tags || [];
      const hasMatchingTag = filter.tags.some((tag) => eventTags.includes(tag));

      if (!hasMatchingTag) {
        failReason = "tags";
        return false;
      }
    }

    // Keyword filtering in title and description
    if (filter.keywords && filter.keywords.length > 0) {
      const titleLower = (event.title || "").toLowerCase();
      const descriptionLower = (event.description || "").toLowerCase();

      const hasMatchingKeyword = filter.keywords.some((keyword) => {
        const keywordLower = keyword.toLowerCase();
        return titleLower.includes(keywordLower) || descriptionLower.includes(keywordLower);
      });

      if (!hasMatchingKeyword) {
        failReason = "keywords";
        return false;
      }
    }

    // All filters passed
    return true;
  }

  /**
   * Find all subscriptions that match an event
   */
  findMatchingSubscriptions(event: Event): Subscription[] {
    // Get all clients with subscriptions
    const clientIds = this.subscriptionManager.getAllClientIds();
    const matchingSubscriptions: Subscription[] = [];

    // Check each client's subscriptions for matches
    for (const clientId of clientIds) {
      const clientSubscriptions = this.subscriptionManager.getClientSubscriptions(clientId);

      // Check if the event matches any of the client's subscription filters
      for (const subscription of clientSubscriptions) {
        if (this.matchesFilter(event, subscription.filter)) {
          matchingSubscriptions.push(subscription);
        }
      }
    }

    return matchingSubscriptions;
  }

  /**
   * Check if an event should be sent to a client
   * (matches both filter AND viewport)
   */
  shouldSendToClient(event: Event, clientId: string): boolean {
    // Check viewport first (faster check)
    const viewport = this.viewportManager.getViewport(clientId);
    if (!viewport) {
      return false; // No viewport, don't send
    }

    // Check if event is in viewport
    if (!event.location?.coordinates) {
      return false; // No coordinates, can't determine
    }

    const [lng, lat] = event.location.coordinates;
    const { boundingBox } = viewport;

    if (
      lng < boundingBox.minX ||
      lng > boundingBox.maxX ||
      lat < boundingBox.minY ||
      lat > boundingBox.maxY
    ) {
      return false; // Not in viewport
    }

    // Check if it matches any of the client's filter subscriptions
    const subscriptions = this.subscriptionManager.getClientSubscriptions(clientId);
    return subscriptions.some((subscription) => this.matchesFilter(event, subscription.filter));
  }

  /**
   * Get all clients that should receive an event
   */
  getMatchingClients(event: Event): string[] {
    // Get all clients with subscriptions and viewports
    const subscriptionClientIds = new Set(this.subscriptionManager.getAllClientIds());
    const viewportClientIds = new Set(this.viewportManager.getAllClientIds());

    // Find intersection of clients with both subscriptions and viewports
    const clientIds = Array.from(subscriptionClientIds).filter((id) => viewportClientIds.has(id));

    // Filter to only clients that should receive this event
    return clientIds.filter((clientId) => this.shouldSendToClient(event, clientId));
  }
}
