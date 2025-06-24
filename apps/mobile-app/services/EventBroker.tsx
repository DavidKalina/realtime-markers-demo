// services/EventBroker.ts
import { EventEmitter } from "eventemitter3";

// Define event types for better type checking
export enum EventTypes {
  // WebSocket and Map events
  WEBSOCKET_CONNECTED = "websocket_connected",
  WEBSOCKET_DISCONNECTED = "websocket_disconnected",
  MARKERS_UPDATED = "markers_updated",
  EVENT_DISCOVERED = "event_discovered",
  FORCE_VIEWPORT_UPDATE = "force_viewport_update",
  // New consolidated map item events
  MAP_ITEM_SELECTED = "map:item:selected",
  MAP_ITEM_DESELECTED = "map:item:deselected",

  // Keep these for backward compatibility but they'll be deprecated
  MARKER_SELECTED = "marker_selected",
  CLUSTER_SELECTED = "cluster_selected",
  CLUSTER_EXPANDED = "cluster_expanded",
  MARKER_DESELECTED = "marker_deselected",

  MARKER_ADDED = "marker_added",
  MARKER_REMOVED = "marker_removed",
  VIEWPORT_CHANGED = "viewport_changed",
  VIEWPORT_CHANGING = "viewport:changing",

  USER_PANNING_VIEWPORT = "user:panning:viewport",

  // UI navigation events
  OPEN_DETAILS = "ui:open:details",
  OPEN_SHARE = "ui:open:share",
  OPEN_SEARCH = "ui:open:search",
  OPEN_SCAN = "ui:open:scan",
  CLOSE_VIEW = "ui:close:view",
  NAVIGATE_TO_CIVIC_ENGAGEMENT = "navigation:civic_engagement",

  // Navigation between events
  NEXT_EVENT = "navigation:next",
  PREVIOUS_EVENT = "navigation:previous",

  // Misc events
  MAP_READY = "map:ready",
  USER_LOCATION_UPDATED = "user:location:updated",
  ERROR_OCCURRED = "error_occurred",

  JOB_QUEUED = "job:queued",
  JOB_STARTED = "job:started",
  JOB_COMPLETED = "job:completed",
  JOB_CANCELED = "job:canceled",
  JOB_QUEUE_CLEARED = "job:queue:cleared",

  NOTIFICATION = "notification",

  GRAVITATIONAL_PULL_STARTED = "gravitational:pull:started",
  GRAVITATIONAL_PULL_TOGGLED = "gravitational:pull:toggled",
  GRAVITATIONAL_PULL_COMPLETED = "gravitational:pull:completed",

  // New camera events
  CAMERA_ANIMATE_TO_LOCATION = "camera:animate:to:location",
  CAMERA_ANIMATE_TO_BOUNDS = "camera:animate:to:bounds",

  // Leveling system events
  LEVEL_UPDATE = "level-update",
  XP_AWARDED = "xp-awarded",
}

// Base event interface that all event payloads should extend
export interface BaseEvent {
  timestamp: number;
  source: string;
}

// Unified MapItem type for both markers and clusters
export interface MapItem {
  id: string;
  type: "marker" | "cluster";
  coordinates: [number, number]; // [longitude, latitude]
}

// Marker specific MapItem
export interface MarkerItem extends MapItem {
  type: "marker";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  markerData: any;
}

// Cluster specific MapItem
export interface ClusterItem extends MapItem {
  type: "cluster";
  count: number;
  childMarkers?: string[]; // Array of marker IDs in the cluster
}

// Unified event for map item selection/deselection
export interface MapItemEvent extends BaseEvent {
  item: MarkerItem | ClusterItem;
}

// Marker related events (kept for backward compatibility)
export interface MarkerEvent extends BaseEvent {
  markerId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  markerData: any;
}

export interface MarkersEvent extends BaseEvent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  markers: any[];
  count: number;
}

export interface ClusterSelectedEvent extends BaseEvent {
  clusterId: string;
  clusterInfo: {
    count: number;
    coordinates: [number, number];
  };
}

// Event for when a cluster is expanded
export interface ClusterExpandedEvent extends BaseEvent {
  clusterId: string;
  childMarkers: string[]; // Array of marker IDs in the cluster
}

export interface ExtendedMarkersEvent extends MarkersEvent {
  searching: boolean;
}

// Viewport related events
export interface ViewportEvent extends BaseEvent {
  viewport: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  markers: any[];
}

export interface ExtendedViewportEvent extends ViewportEvent {
  searching: boolean;
}

// Navigation related events
export interface NavigationEvent extends BaseEvent {
  currentId?: string;
}

// User location events
export interface UserLocationEvent extends BaseEvent {
  coordinates: [number, number]; // [longitude, latitude]
  accuracy?: number;
}

// Camera animation events
export interface CameraAnimateToLocationEvent extends BaseEvent {
  coordinates: [number, number]; // [longitude, latitude]
  duration?: number; // milliseconds
  zoomLevel?: number;
  allowZoomChange?: boolean; // Whether to allow zoom level changes during animation
}

export interface CameraAnimateToBoundsEvent extends BaseEvent {
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  padding?: number; // padding in pixels
  duration?: number; // milliseconds
}

// Gravitational pull events
export interface GravitationalPullStartedEvent extends BaseEvent {
  target: [number, number]; // The coordinates we're pulling towards
}

export interface GravitationalPullToggledEvent extends BaseEvent {
  enabled: boolean; // Whether gravitational pull is enabled or disabled
}

export interface GravitationalPullCompletedEvent extends BaseEvent {
  target: [number, number];
  duration: number; // How long the pull took in milliseconds
}

// Job related events
export interface JobEvent extends BaseEvent {
  jobId: string;
  jobType: string;
}

export interface JobStartedEvent extends JobEvent {
  estimatedDuration?: number; // in milliseconds
}

export interface JobCompletedEvent extends JobEvent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
  duration: number; // How long the job took in milliseconds
}

export interface JobCanceledEvent extends JobEvent {
  reason?: string;
}

export interface JobQueueClearedEvent extends BaseEvent {
  jobIds: string[];
}

// Notification event
export interface NotificationEvent extends BaseEvent {
  title: string;
  message: string;
  notificationType: "info" | "success" | "warning" | "error";
  duration?: number; // How long to show the notification in milliseconds
}

// Error event
export interface ErrorEvent extends BaseEvent {
  error: Error | string;
  context?: string;
}

export interface DiscoveredEventData {
  id: string;
  title: string;
  emoji: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  location: any;
  description?: string;
  eventDate: string;
  endDate?: string;
  address?: string;
  locationNotes?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categories?: any[];
  confidenceScore: number;
  originalImageUrl?: string;
  creatorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveryEvent extends BaseEvent {
  event: DiscoveredEventData;
}

// Add level update event interface
export interface LevelUpdateEvent extends BaseEvent {
  data: {
    userId: string;
    level: number;
    title: string;
    xpProgress: number;
    action: string;
    timestamp: string;
  };
}

// Add XP awarded event interface
export interface XPAwardedEvent extends BaseEvent {
  data: {
    userId: string;
    amount: number;
    reason: string;
    timestamp: string;
  };
}

// Civic engagement navigation event
export interface NavigateToCivicEngagementEvent extends BaseEvent {
  imageUri: string;
  imageSource: "camera" | "gallery";
}

// Main EventBroker class
class EventBroker {
  private emitter: EventEmitter;
  private static instance: EventBroker;
  private debugMode: boolean;

  private constructor() {
    this.emitter = new EventEmitter();
    // Increase max listeners to prevent Node.js warning
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
      return originalEmit.call(this.emitter, type, ...args);
    };
    this._hasDebugListeners = true;
  }

  // Subscribe to an event
  public on<T extends BaseEvent>(
    eventType: EventTypes,
    listener: (eventData: T) => void,
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
    listener: (eventData: T) => void,
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
