// services/EventBroker.ts
import { EventEmitter } from "events";

// Define event types for better type checking
export enum EventTypes {
  // WebSocket and Map events
  WEBSOCKET_CONNECTED = "websocket:connected",
  WEBSOCKET_DISCONNECTED = "websocket:disconnected",
  MARKERS_UPDATED = "markers:updated",
  MARKER_SELECTED = "marker:selected",
  MARKER_DESELECTED = "marker:deselected",
  VIEWPORT_CHANGED = "viewport:changed",
  VIEWPORT_CHANGING = "viewport:changing",

  // Assistant events
  ASSISTANT_MESSAGE = "assistant:message",
  ASSISTANT_ACTION = "assistant:action",

  // UI navigation events
  OPEN_DETAILS = "ui:open:details",
  OPEN_SHARE = "ui:open:share",
  OPEN_SEARCH = "ui:open:search",
  OPEN_SCAN = "ui:open:scan",
  CLOSE_VIEW = "ui:close:view",

  // Navigation between events
  NEXT_EVENT = "navigation:next",
  PREVIOUS_EVENT = "navigation:previous",

  // Misc events
  MAP_READY = "map:ready",
  USER_LOCATION_UPDATED = "user:location:updated",
  ERROR_OCCURRED = "error:occurred",

  JOB_QUEUED = "job_queued",
  JOB_STARTED = "job_started",
  JOB_COMPLETED = "job_completed",
  JOB_CANCELED = "job_canceled",
  JOB_QUEUE_CLEARED = "job_queue_cleared",

  NOTIFICATION = "notification",

  GRAVITATIONAL_PULL_STARTED = "gravitational:pull:started",
  GRAVITATIONAL_PULL_TOGGLED = "gravitational:pull:toggled",
  GRAVITATIONAL_PULL_COMPLETED = "gravitational:pull:completed",
}

// Base event interface that all event payloads should extend
export interface BaseEvent {
  timestamp: number;
  source?: string;
}

export interface MarkerEvent extends BaseEvent {
  markerId: string;
  markerData: any;
}

export interface MarkersEvent extends BaseEvent {
  markers: any[];
  count: number;
}

export interface ViewportEvent extends BaseEvent {
  viewport: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  markers: any[];
}

export interface ExtendedViewportEvent extends ViewportEvent {
  searching: boolean;
}

export interface ExtendedMarkersEvent extends MarkersEvent {
  searching: boolean;
}

export interface AssistantMessageEvent extends BaseEvent {
  message: string;
  priority: "low" | "medium" | "high";
}

export interface GravitationalPullStartedEvent extends BaseEvent {
  target: [number, number]; // The coordinates we're pulling towards
}

export interface GravitationalPullToggledEvent extends BaseEvent {
  enabled: boolean; // Whether gravitational pull is enabled or disabled
}

export interface ErrorEvent extends BaseEvent {
  error: Error | string;
  context?: string;
}

// Main EventBroker class
class EventBroker {
  private emitter: EventEmitter;
  private static instance: EventBroker;
  private debugMode: boolean;

  private constructor() {
    this.emitter = new EventEmitter();
    // Increase max listeners to prevent Node.js warning
    this.emitter.setMaxListeners(50);
    this.debugMode = __DEV__; // Use React Native's __DEV__ global

    // Set up debugging in dev mode
    if (this.debugMode) {
      this.setupDebugListeners();
    }
  }

  public static getInstance(): EventBroker {
    if (!EventBroker.instance) {
      EventBroker.instance = new EventBroker();
    }
    return EventBroker.instance;
  }

  // Enable or disable debug mode
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    if (enabled && !this._hasDebugListeners) {
      this.setupDebugListeners();
    }
  }

  private _hasDebugListeners = false;
  private setupDebugListeners(): void {
    if (this._hasDebugListeners) return;

    // Listen to all events for debugging
    const originalEmit = this.emitter.emit;
    this.emitter.emit = (type, ...args) => {
      console.log(`[EventBroker] Event emitted: ${String(type)}`, ...args);
      return originalEmit.call(this.emitter, type, ...args);
    };
    this._hasDebugListeners = true;
  }

  // Subscribe to an event
  public on<T extends BaseEvent>(
    eventType: EventTypes,
    listener: (eventData: T) => void
  ): () => void {
    this.emitter.on(eventType, listener);

    // Return a function to unsubscribe
    return () => {
      this.emitter.off(eventType, listener);
    };
  }

  // Subscribe to an event once
  public once<T extends BaseEvent>(
    eventType: EventTypes,
    listener: (eventData: T) => void
  ): () => void {
    this.emitter.once(eventType, listener);

    // Return a function to unsubscribe if it hasn't triggered yet
    return () => {
      this.emitter.off(eventType, listener);
    };
  }

  // Emit an event
  public emit<T extends BaseEvent>(eventType: EventTypes, eventData: T): void {
    // Ensure timestamp exists
    if (!eventData.timestamp) {
      eventData.timestamp = Date.now();
    }

    this.emitter.emit(eventType, eventData);
  }

  // Clear all event listeners
  public clear(): void {
    this.emitter.removeAllListeners();
    if (this.debugMode) {
      this.setupDebugListeners();
    }
  }
}

// Export a singleton instance
export const eventBroker = EventBroker.getInstance();
