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

    console.log("VIEWPORT", viewport);

    if (!viewport) {
      return false; // No viewport, don't send
    }

    // Check if event is in viewport

    console.log("COORDINATES", !event.location?.coordinates);

    if (!event.location?.coordinates) {
      return false; // No coordinates, can't determine
    }

    const [lng, lat] = event.location.coordinates;
    const { boundingBox } = viewport;

    console.log(
      "BOUNDS_CHECK",
      lng < boundingBox.minX ||
        lng > boundingBox.maxX ||
        lat < boundingBox.minY ||
        lat > boundingBox.maxY
    );

    if (
      lng < boundingBox.minX ||
      lng > boundingBox.maxX ||
      lat < boundingBox.minY ||
      lat > boundingBox.maxY
    ) {
      return false; // Not in viewport
    }

    // Get client's subscriptions
    const subscriptions = this.subscriptionManager.getClientSubscriptions(clientId);

    // IMPORTANT: If no subscriptions, return true to match all events in viewport

    console.log("SUBSCRIPTIONS_LENGTH", subscriptions.length);

    if (subscriptions.length === 0) {
      return true;
    }

    console.log(
      "MATCHES",
      subscriptions.some((subscription) => this.matchesFilter(event, subscription.filter))
    );

    // Check if it matches any of the client's filter subscriptions
    return subscriptions.some((subscription) => this.matchesFilter(event, subscription.filter));
  }

  /**
   * Get all clients that should receive an event
   */
  getMatchingClients(event: Event): string[] {
    // CHANGE: Consider ALL clients with viewports, regardless of subscription status
    const viewportClientIds = this.viewportManager.getAllClientIds();

    // Filter to only clients that should receive this event
    return viewportClientIds.filter((clientId) => this.shouldSendToClient(event, clientId));
  }
}
