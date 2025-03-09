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

      console.log({ eventCategories, filterCategories: filter.categories });

      console.log("HAS_MATCHING", hasMatchingCategory);

      if (!hasMatchingCategory) {
        failReason = "categories";
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
