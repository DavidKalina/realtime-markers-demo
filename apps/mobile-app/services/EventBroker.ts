// services/EventBroker.ts — Lightweight in-app pub/sub bus for decoupled
// communication between hooks, components, and services.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventType<T = any> = string & { __brand?: T };

/** Every event payload must carry at least these fields. */
export interface BaseEvent {
  timestamp: number;
  source: string;
  [key: string]: unknown;
}

// ── Concrete event payloads ──────────────────────────────────────────

export interface CameraAnimateToLocationEvent extends BaseEvent {
  coordinates: [number, number];
  duration?: number;
  zoomLevel?: number;
  allowZoomChange?: boolean;
  animationMode?: "flyTo" | "easeTo" | "linearTo" | "moveTo";
}

export interface CameraAnimateToBoundsEvent extends BaseEvent {
  bounds: { north: number; south: number; east: number; west: number };
  padding?: number;
  duration?: number;
}

export interface ViewportEvent extends BaseEvent {
  viewport: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  zoom: number;
}

export interface MarkersEvent extends BaseEvent {
  markers: unknown[];
}

export interface MapItemEvent extends BaseEvent {
  item:
    | {
        id: string;
        type: "marker";
        coordinates: [number, number];
        markerData: unknown;
      }
    | {
        id: string;
        type: "cluster";
        coordinates: [number, number];
        count: number;
        childMarkers: string[];
      };
}

export interface NavigateToScreenEvent extends BaseEvent {
  path: string;
}

export interface XPAwardedEvent extends BaseEvent {
  data: { totalXp?: number; [key: string]: unknown };
}

export interface LevelUpdateEvent extends BaseEvent {
  data: { action?: string; title?: string; totalXp?: number; [key: string]: unknown };
}

export interface SidequestJobCompletedEvent extends BaseEvent {
  jobId: string;
  jobType: string;
  itineraryId?: string;
}

// ── Event type constants ─────────────────────────────────────────────

export const EventTypes = {
  // Camera
  CAMERA_ANIMATE_TO_LOCATION: "camera:animate_to_location" as EventType<CameraAnimateToLocationEvent>,
  CAMERA_ANIMATE_TO_BOUNDS: "camera:animate_to_bounds" as EventType<CameraAnimateToBoundsEvent>,

  // Map
  USER_PANNING_VIEWPORT: "map:user_panning" as EventType<BaseEvent>,
  MAP_READY: "map:ready" as EventType<BaseEvent>,
  MAP_ITEM_DESELECTED: "map:item_deselected" as EventType<MapItemEvent>,
  VIEWPORT_CHANGED: "map:viewport_changed" as EventType<ViewportEvent>,

  // Markers
  MARKERS_UPDATED: "markers:updated" as EventType<MarkersEvent>,
  MARKER_ADDED: "markers:added" as EventType<MarkersEvent>,
  MARKER_REMOVED: "markers:removed" as EventType<MarkersEvent>,
  MARKER_DESELECTED: "markers:deselected" as EventType<BaseEvent>,

  // Location
  USER_LOCATION_UPDATED: "location:updated" as EventType<BaseEvent>,
  ERROR_OCCURRED: "error:occurred" as EventType<BaseEvent>,

  // Itinerary
  ITINERARY_CHECKIN: "itinerary:checkin" as EventType<BaseEvent>,
  DISTRICT_EXPLORED: "district:explored" as EventType<BaseEvent>,

  // Navigation / Notifications
  NOTIFICATION: "notification:show" as EventType<BaseEvent>,
  NAVIGATE_TO_SCREEN: "navigation:navigate" as EventType<NavigateToScreenEvent>,

  // WebSocket
  WS_VIEWPORT_MESSAGE: "ws:viewport_message" as EventType<BaseEvent>,
  WEBSOCKET_CONNECTED: "ws:connected" as EventType<BaseEvent>,
  WEBSOCKET_DISCONNECTED: "ws:disconnected" as EventType<BaseEvent>,
  FORCE_VIEWPORT_UPDATE: "ws:force_viewport_update" as EventType<BaseEvent>,

  // XP / Gamification
  XP_AWARDED: "xp:awarded" as EventType<XPAwardedEvent>,
  LEVEL_UPDATE: "xp:level_update" as EventType<LevelUpdateEvent>,

  // Job lifecycle
  SIDEQUEST_JOB_COMPLETED: "job:sidequest_completed" as EventType<SidequestJobCompletedEvent>,
} as const;

// ── EventBroker class ────────────────────────────────────────────────

type Listener = (data: BaseEvent) => void;

class EventBroker {
  private listeners = new Map<string, Set<Listener>>();

  /** Subscribe to an event type. Returns an unsubscribe function. */
  on<T extends BaseEvent = BaseEvent>(
    eventType: string,
    listener: (data: T) => void,
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    const set = this.listeners.get(eventType)!;
    const wrapped = listener as Listener;
    set.add(wrapped);
    return () => {
      set.delete(wrapped);
    };
  }

  /** Emit an event. */
  emit<T extends BaseEvent = BaseEvent>(eventType: string, data: T): void {
    const set = this.listeners.get(eventType);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(data);
      } catch (err) {
        console.error(`[EventBroker] Error in listener for ${eventType}:`, err);
      }
    }
  }
}

export const eventBroker = new EventBroker();
