// hooks/useMapWebsocket.ts
import { useEffect, useState, useRef, useCallback } from "react";
import {
  eventBroker,
  EventTypes,
  ViewportEvent,
  MarkersEvent,
  BaseEvent,
} from "@/services/EventBroker";
import { useLocationStore } from "@/stores/useLocationStore";

// Mapbox viewport format
interface MapboxViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Server marker structure adjusted for Mapbox
export interface Marker {
  id: string;
  coordinates: [number, number]; // [longitude, latitude]
  data: {
    title: string;
    emoji: string;
    color: string;
    location?: string;
    distance?: string;
    time?: string;
    description?: string;
    categories?: string[];
    isVerified?: boolean;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
  };
}

// New filter interface that matches server's EventFilter
interface EventFilter {
  categories?: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
  status?: string[];
  keywords?: string[];
  creatorId?: string;
  tags?: string[];
}

// New subscription interface
interface Subscription {
  id: string;
  name?: string;
  filter: EventFilter;
  createdAt: string;
  updatedAt: string;
}

interface MapWebSocketResult {
  markers: Marker[];
  isConnected: boolean;
  error: Error | null;
  currentViewport: MapboxViewport | null;
  updateViewport: (viewport: MapboxViewport) => void;
  clientId: string | null;
  // New functions for filter subscriptions
  createSubscription: (filter: EventFilter, name?: string) => Promise<void>;
  updateSubscription: (id: string, filter: EventFilter, name?: string) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  listSubscriptions: () => Promise<void>;
  // Store the current subscriptions
  subscriptions: Subscription[];
}

// Define message types to keep code consistent
const MessageTypes = {
  // Connection messages
  CONNECTION_ESTABLISHED: "connection_established",

  // Viewport-related (what's visible to the user)
  VIEWPORT_UPDATE: "viewport_update",
  INITIAL_MARKERS: "initial_markers",

  // Real-time updates (actual data changes)
  MARKER_CREATED: "marker_created",
  MARKER_UPDATED: "marker_updated",
  MARKER_DELETED: "marker_deleted",

  // Legacy message types (for compatibility)
  MARKER_DELETE: "marker_delete",
  MARKER_UPDATES_BATCH: "marker_updates_batch",
  DEBUG_EVENT: "debug_event",

  // New subscription management messages
  CREATE_SUBSCRIPTION: "create_subscription",
  UPDATE_SUBSCRIPTION: "update_subscription",
  DELETE_SUBSCRIPTION: "delete_subscription",
  LIST_SUBSCRIPTIONS: "list_subscriptions",
  SUBSCRIPTION_CREATED: "subscription_created",
  SUBSCRIPTION_UPDATED: "subscription_updated",
  SUBSCRIPTION_DELETED: "subscription_deleted",
  SUBSCRIPTIONS_LIST: "subscriptions_list",

  // New viewport update acknowledgment
  VIEWPORT_UPDATED: "viewport_updated",

  // New filtered events message
  MAP_EVENTS: "map_events",

  // Error message
  ERROR: "error",
};

export const useMapWebSocket = (url: string): MapWebSocketResult => {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentViewport, setCurrentViewport] = useState<MapboxViewport | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  const setStoreMarkers = useLocationStore.getState().setMarkers;

  const markersRef = useRef<Marker[]>(markers);

  // Update the ref whenever markers state changes.
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  console.log(markers.map((m) => m.data.categories));

  useEffect(() => {
    // Update the global store whenever the local markers state changes
    setStoreMarkers(markers);
  }, [markers, setStoreMarkers]);

  // Store selected marker id from the marker store.
  const selectedMarkerId = useLocationStore((state) => state.selectedMarkerId);
  const selectMarker = useLocationStore((state) => state.selectMarker);

  // Create refs for values that change frequently so they don't force reconnection.
  const selectedMarkerIdRef = useRef<string | null>(selectedMarkerId);
  const currentViewportRef = useRef<MapboxViewport | null>(currentViewport);

  useEffect(() => {
    selectedMarkerIdRef.current = selectedMarkerId;
  }, [selectedMarkerId]);

  useEffect(() => {
    currentViewportRef.current = currentViewport;
  }, [currentViewport]);

  // WebSocket and reconnect refs
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for throttling and batching marker updates.
  const prevMarkerCount = useRef<number>(0);
  const markerUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastViewportUpdateRef = useRef<number>(0);

  // Throttling constants
  const VIEWPORT_THROTTLE_MS = 0;

  const emitMarkersUpdated = useCallback(
    (updatedMarkers: Marker[]) => {
      // Handle marker deselection if needed
      if (selectedMarkerIdRef.current && updatedMarkers.length === 0) {
        selectMarker(null);
        eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
          timestamp: Date.now(),
          source: "useMapWebSocket",
        });
      } else if (selectedMarkerIdRef.current && updatedMarkers.length > 0) {
        const selectedMarkerExists = updatedMarkers.some(
          (marker) => marker.id === selectedMarkerIdRef.current
        );
        if (!selectedMarkerExists) {
          selectMarker(null);
          eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
            timestamp: Date.now(),
            source: "useMapWebSocket",
          });
        }
      }

      const wasShowingMarkers = prevMarkerCount.current > 0;
      const isEmptyNow = updatedMarkers.length === 0;

      const significantChange = Math.abs(updatedMarkers.length - prevMarkerCount.current) >= 2;
      const isFirstResult = prevMarkerCount.current === 0 && updatedMarkers.length > 0;
      const clearedAllMarkers = wasShowingMarkers && isEmptyNow;

      if (significantChange || isFirstResult || clearedAllMarkers) {
        eventBroker.emit<MarkersEvent>(EventTypes.MARKERS_UPDATED, {
          timestamp: Date.now(),
          source: "useMapWebSocket",
          markers: updatedMarkers,
          count: updatedMarkers.length,
        });
        prevMarkerCount.current = updatedMarkers.length;
      }
    },
    [selectMarker]
  );

  const batchMarkerUpdates = useCallback(
    (updates: Marker[]) => {
      setMarkers((prev) => [...prev, ...updates]);

      // Only emit events for significant updates
      if (updates.length > 0 || prevMarkerCount.current > 0) {
        emitMarkersUpdated(updates);
      }
    },
    [emitMarkersUpdated]
  );

  const convertRBushToMapbox = useCallback((rbushMarker: any): Marker => {
    return {
      id: rbushMarker.id,
      coordinates: [rbushMarker.minX, rbushMarker.minY],
      data: {
        ...rbushMarker.data,
        title: rbushMarker.data?.title || "Unnamed Event",
        emoji: rbushMarker.data?.emoji || "📍",
        color: rbushMarker.data?.color || "red",
      },
    };
  }, []);

  // Convert new event format to Mapbox marker format
  const convertEventToMapbox = useCallback((event: any): Marker => {
    if (!event.location?.coordinates) {
      console.warn(`Event missing coordinates:`, event);
      // Provide fallback coordinates to prevent errors
      return {
        id: event.id,
        coordinates: [0, 0],
        data: {
          title: event.title || "Unnamed Event",
          emoji: event.emoji || "📍",
          color: event.color || "red",
          categories: event.categories || [],
          created_at: event.createdAt,
          updated_at: event.updatedAt,
          description: event.description,
        },
      };
    }

    return {
      id: event.id,
      coordinates: event.location.coordinates,
      data: {
        title: event.title || "Unnamed Event",
        emoji: event.emoji || "📍",
        color: event.color || "red",
        categories: event.categories || [],
        created_at: event.createdAt,
        updated_at: event.updatedAt,
        description: event.description,
      },
    };
  }, []);

  // Use a function that reads currentViewportRef so it does not change on every render.
  const sendViewportUpdate = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN && currentViewportRef.current) {
      const now = Date.now();
      if (now - lastViewportUpdateRef.current > VIEWPORT_THROTTLE_MS) {
        const message = {
          type: MessageTypes.VIEWPORT_UPDATE,
          viewport: currentViewportRef.current,
          // Convert to bounding box format for the new system
          boundingBox: {
            minX: currentViewportRef.current.west,
            minY: currentViewportRef.current.south,
            maxX: currentViewportRef.current.east,
            maxY: currentViewportRef.current.north,
          },
          zoom: 14, // Default zoom or get from map if available
        };
        ws.current.send(JSON.stringify(message));
        lastViewportUpdateRef.current = now;
        eventBroker.emit<ViewportEvent>(EventTypes.VIEWPORT_CHANGED, {
          timestamp: now,
          source: "useMapWebSocket",
          viewport: currentViewportRef.current,
          markers: markersRef.current,
        });
      }
    }
  }, []);

  // Add a ref to track if initial markers have been received.

  const updateViewport = useCallback((viewport: MapboxViewport) => {
    setCurrentViewport(viewport);
    currentViewportRef.current = viewport;

    // First emit that the viewport is changing and we're starting to search
    eventBroker.emit<ViewportEvent & { searching: boolean }>(EventTypes.VIEWPORT_CHANGED, {
      timestamp: Date.now(),
      source: "useMapWebSocket",
      viewport: viewport,
      markers: markersRef.current,
      searching: true, // Explicitly indicate search is starting
    });

    // Send the viewport update to the server with the new format
    if (ws.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: MessageTypes.VIEWPORT_UPDATE,
        viewport: viewport, // For backward compatibility
        boundingBox: {
          minX: viewport.west,
          minY: viewport.south,
          maxX: viewport.east,
          maxY: viewport.north,
        },
        zoom: 14, // Default zoom level
      };
      ws.current.send(JSON.stringify(message));
      lastViewportUpdateRef.current = Date.now();
    }
  }, []);

  // New subscription management functions
  const createSubscription = useCallback(
    async (filter: EventFilter, name?: string): Promise<void> => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        const message = {
          type: MessageTypes.CREATE_SUBSCRIPTION,
          filter,
          name,
        };
        ws.current.send(JSON.stringify(message));
      } else {
        throw new Error("WebSocket not connected");
      }
    },
    []
  );

  const updateSubscription = useCallback(
    async (id: string, filter: EventFilter, name?: string): Promise<void> => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        const message = {
          type: MessageTypes.UPDATE_SUBSCRIPTION,
          subscriptionId: id,
          filter,
          name,
        };
        ws.current.send(JSON.stringify(message));
      } else {
        throw new Error("WebSocket not connected");
      }
    },
    []
  );

  const deleteSubscription = useCallback(async (id: string): Promise<void> => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: MessageTypes.DELETE_SUBSCRIPTION,
        subscriptionId: id,
      };
      ws.current.send(JSON.stringify(message));
    } else {
      throw new Error("WebSocket not connected");
    }
  }, []);

  const listSubscriptions = useCallback(async (): Promise<void> => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: MessageTypes.LIST_SUBSCRIPTIONS,
      };
      ws.current.send(JSON.stringify(message));
    } else {
      throw new Error("WebSocket not connected");
    }
  }, []);

  // Create a stable websocket connection.
  const connectWebSocket = useCallback(() => {
    try {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) return;
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        eventBroker.emit<BaseEvent>(EventTypes.WEBSOCKET_CONNECTED, {
          timestamp: Date.now(),
          source: "useMapWebSocket",
        });
        if (currentViewportRef.current) {
          sendViewportUpdate();
        }

        // Get list of existing subscriptions
        listSubscriptions();
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          console.log("[WebSocket] Received message type:", data.type);

          // For MAP_EVENTS, log more details
          if (data.type === MessageTypes.MAP_EVENTS) {
            console.log(`[WebSocket] Received ${data.events?.length || 0} events`);
          } else if (data.type === MessageTypes.SUBSCRIPTION_CREATED) {
            console.log("[WebSocket] Subscription created:", data.subscription?.id);
          } else if (data.type === MessageTypes.SUBSCRIPTION_DELETED) {
            console.log("[WebSocket] Subscription deleted:", data.subscriptionId);
          }

          switch (data.type) {
            case MessageTypes.CONNECTION_ESTABLISHED:
              setClientId(data.clientId);
              break;

            // Viewport synchronization (basic map marker display)
            case MessageTypes.INITIAL_MARKERS: {
              const initialMapboxMarkers = data.data.map((marker: any) =>
                convertRBushToMapbox(marker)
              );
              setMarkers(initialMapboxMarkers);

              // Standard marker update event (for event count display)
              emitMarkersUpdated(initialMapboxMarkers);
              break;
            }

            // New filtered events message
            case MessageTypes.MAP_EVENTS: {
              // Process events in the new format
              const mapboxMarkers = data.events.map((event: any) => convertEventToMapbox(event));

              // Replace markers with new filtered events
              setMarkers(mapboxMarkers);

              // Emit update for UI components
              emitMarkersUpdated(mapboxMarkers);
              break;
            }

            // Handle subscription responses
            case MessageTypes.SUBSCRIPTION_CREATED: {
              setSubscriptions((prev) => [...prev, data.subscription]);
              break;
            }

            case MessageTypes.SUBSCRIPTION_UPDATED: {
              setSubscriptions((prev) =>
                prev.map((sub) => (sub.id === data.subscription.id ? data.subscription : sub))
              );
              break;
            }

            case MessageTypes.SUBSCRIPTION_DELETED: {
              setSubscriptions((prev) => prev.filter((sub) => sub.id !== data.subscriptionId));
              break;
            }

            case MessageTypes.SUBSCRIPTIONS_LIST: {
              setSubscriptions(data.subscriptions);
              break;
            }

            // Legacy batch updates (keep for compatibility)
            case MessageTypes.MARKER_UPDATES_BATCH: {
              const mapboxUpdates = data.data.map((marker: any) => convertRBushToMapbox(marker));
              batchMarkerUpdates(mapboxUpdates);
              break;
            }

            // Real-time update for marker creation
            case MessageTypes.MARKER_CREATED: {
              // Emit event for notification
              eventBroker.emit<MarkersEvent>(EventTypes.MARKER_ADDED, {
                timestamp: Date.now(),
                source: "useMapWebSocket",
                markers: [],
                count: 1,
              });
              break;
            }

            // Real-time update for marker modification
            case MessageTypes.MARKER_UPDATED: {
              const updatedMarker = convertRBushToMapbox(data.data);

              // Replace in existing markers
              setMarkers((prev) =>
                prev.map((marker) => (marker.id === updatedMarker.id ? updatedMarker : marker))
              );

              // Could emit a MARKER_MODIFIED event if needed
              break;
            }

            case MessageTypes.MARKER_DELETED:
            case MessageTypes.MARKER_DELETE: {
              // Support both new and legacy types
              const deletedId = data.data.id;

              // Handle marker deselection if needed
              if (deletedId === selectedMarkerIdRef.current) {
                selectMarker(null);
                eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
                  timestamp: Date.now(),
                  source: "useMapWebSocket",
                });
              }

              // Important: We need to update the markers state directly for deletions
              // Unlike additions (which can wait for batch updates), deletions need to be immediate
              setMarkers((prevMarkers) => prevMarkers.filter((marker) => marker.id !== deletedId));

              // Emit the notification event
              eventBroker.emit<MarkersEvent>(EventTypes.MARKER_REMOVED, {
                timestamp: Date.now(),
                source: "useMapWebSocket",
                markers: [],
                count: 1,
              });
              break;
            }

            case MessageTypes.ERROR: {
              console.error("WebSocket error from server:", data.message, data.details);
              setError(new Error(data.message));
              eventBroker.emit<BaseEvent & { error: Error }>(EventTypes.ERROR_OCCURRED, {
                timestamp: Date.now(),
                source: "useMapWebSocket",
                error: new Error(data.message),
              });
              break;
            }

            default: {
              // Fallback if server sends an array of markers
              if (Array.isArray(data)) {
                const mapboxMarkers = data.map((marker: any) => convertRBushToMapbox(marker));
                setMarkers(mapboxMarkers);
                emitMarkersUpdated(mapboxMarkers);
              }
              break;
            }
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
          const errorObj =
            err instanceof Error ? err : new Error("Unknown error parsing WebSocket message");
          setError(errorObj);
          eventBroker.emit<BaseEvent & { error: Error }>(EventTypes.ERROR_OCCURRED, {
            timestamp: Date.now(),
            source: "useMapWebSocket",
            error: errorObj,
          });
        }
      };
      ws.current.onclose = (event) => {
        setIsConnected(false);
        setClientId(null);
        eventBroker.emit<BaseEvent>(EventTypes.WEBSOCKET_DISCONNECTED, {
          timestamp: Date.now(),
          source: "useMapWebSocket",
        });
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 5000); // Reconnect every 5 seconds
      };

      ws.current.onerror = (event) => {
        console.error("WebSocket error:", event);
        const errorObj = new Error("WebSocket connection error");
        setError(errorObj);
        eventBroker.emit<BaseEvent & { error: Error }>(EventTypes.ERROR_OCCURRED, {
          timestamp: Date.now(),
          source: "useMapWebSocket",
          error: errorObj,
        });
      };
    } catch (err) {
      console.error("Error creating WebSocket connection:", err);
      const errorObj =
        err instanceof Error ? err : new Error("Unknown error creating WebSocket connection");
      setError(errorObj);
      eventBroker.emit<BaseEvent & { error: Error }>(EventTypes.ERROR_OCCURRED, {
        timestamp: Date.now(),
        source: "useMapWebSocket",
        error: errorObj,
      });
    }
  }, [
    url,
    batchMarkerUpdates,
    convertRBushToMapbox,
    convertEventToMapbox,
    emitMarkersUpdated,
    selectMarker,
    sendViewportUpdate,
    listSubscriptions,
  ]);

  // Connect on mount and clean up on unmount.
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws.current) ws.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (markerUpdateTimeoutRef.current) clearTimeout(markerUpdateTimeoutRef.current);
    };
  }, [connectWebSocket]);

  return {
    markers,
    isConnected,
    error,
    currentViewport,
    updateViewport,
    clientId,
    // Return the subscription functions
    createSubscription,
    updateSubscription,
    deleteSubscription,
    listSubscriptions,
    subscriptions,
  };
};
