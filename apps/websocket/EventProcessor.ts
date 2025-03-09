// src/services/EventProcessor.ts
import { BoundingBox, Event } from "./filterTypes";
import { FilterEvaluator } from "./FilterEvaluator";
import { SpatialIndex } from "./SpatialIndex";
import { SubscriptionManager } from "./SubscriptionManager";
import { ViewportManager } from "./ViewportManager";

export class EventProcessor {
  private subscriptionManager: SubscriptionManager;
  private viewportManager: ViewportManager;
  private filterEvaluator: FilterEvaluator;
  private spatialIndex: SpatialIndex;

  constructor(
    subscriptionManager: SubscriptionManager,
    viewportManager: ViewportManager,
    filterEvaluator: FilterEvaluator,
    spatialIndex: SpatialIndex
  ) {
    this.subscriptionManager = subscriptionManager;
    this.viewportManager = viewportManager;
    this.filterEvaluator = filterEvaluator;
    this.spatialIndex = spatialIndex;
  }

  /**
   * Process a new or updated event and determine which clients should receive it
   * Returns a Map of clientId -> events to send
   */
  processEvent(event: Event): Map<string, Event[]> {
    // Add/update event in spatial index
    this.spatialIndex.updateEvent(event);

    // Map of clientId -> events to send
    const clientEvents = new Map<string, Event[]>();

    // Get all clients with both subscription and viewport
    const clientIds = this.filterEvaluator.getMatchingClients(event);

    // Add event to each matching client's event list
    for (const clientId of clientIds) {
      if (!clientEvents.has(clientId)) {
        clientEvents.set(clientId, []);
      }
      clientEvents.get(clientId)!.push(event);
    }

    return clientEvents;
  }

  /**
   * Process a viewport update from a client
   * Returns all events that should be sent to the client based on the new viewport
   */
  processViewportUpdate(clientId: string, boundingBox: BoundingBox, zoom: number): Event[] {
    console.log(`Processing viewport update for client ${clientId}`);

    // Update viewport
    this.viewportManager.updateViewport(clientId, boundingBox, zoom);

    // Get all events in the viewport first
    const eventsInViewport = this.spatialIndex.queryBoundingBox(boundingBox);
    console.log(`Found ${eventsInViewport.length} events in viewport`);

    // Get client's subscriptions
    const subscriptions = this.subscriptionManager.getClientSubscriptions(clientId);
    console.log(`Client has ${subscriptions.length} active subscriptions`);

    // IMPORTANT CHANGE: If no subscriptions, return ALL events in viewport
    if (subscriptions.length === 0) {
      console.log("No active filters - returning all events in viewport");
      return eventsInViewport;
    }

    // Filter events by subscription criteria if subscriptions exist
    const matchingEvents = eventsInViewport.filter((event) =>
      // An event matches if it satisfies ANY of the client's subscription filters
      subscriptions.some((subscription) =>
        this.filterEvaluator.matchesFilter(event, subscription.filter)
      )
    );

    console.log(`After filtering: ${matchingEvents.length} events match subscription criteria`);
    return matchingEvents;
  }

  /**
   * Process a new subscription from a client
   * Returns all events matching the subscription in the client's current viewport
   */
  processNewSubscription(subscriptionId: string): Event[] {
    const subscription = this.subscriptionManager.getSubscription(subscriptionId);
    if (!subscription) {
      return [];
    }

    const viewport = this.viewportManager.getViewport(subscription.clientId);
    if (!viewport) {
      return []; // No viewport, no events to send yet
    }

    // Get all events in viewport
    const eventsInViewport = this.spatialIndex.queryBoundingBox(viewport.boundingBox);

    // Filter by subscription criteria
    return eventsInViewport.filter((event) =>
      this.filterEvaluator.matchesFilter(event, subscription.filter)
    );
  }

  /**
   * Handle client disconnect by cleaning up their data
   */
  handleClientDisconnect(clientId: string): void {
    this.subscriptionManager.handleClientDisconnect(clientId);
    this.viewportManager.handleClientDisconnect(clientId);
  }
}
