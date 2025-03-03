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

interface MapWebSocketResult {
  markers: Marker[];
  isConnected: boolean;
  error: Error | null;
  currentViewport: MapboxViewport | null;
  updateViewport: (viewport: MapboxViewport) => void;
  clientId: string | null;
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
};

export const useMapWebSocket = (url: string): MapWebSocketResult => {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentViewport, setCurrentViewport] = useState<MapboxViewport | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  const setStoreMarkers = useLocationStore.getState().setMarkers;

  const markersRef = useRef<Marker[]>(markers);

  // Update the ref whenever markers state changes.
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

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

  // Use a function that reads currentViewportRef so it does not change on every render.
  const sendViewportUpdate = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN && currentViewportRef.current) {
      const now = Date.now();
      if (now - lastViewportUpdateRef.current > VIEWPORT_THROTTLE_MS) {
        const message = {
          type: MessageTypes.VIEWPORT_UPDATE,
          viewport: currentViewportRef.current,
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

    // Send the viewport update to the server
    if (ws.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: MessageTypes.VIEWPORT_UPDATE,
        viewport: viewport,
      };
      ws.current.send(JSON.stringify(message));
      lastViewportUpdateRef.current = Date.now();
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
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`[DEBUG] WebSocket received message type: ${data.type}`);

          switch (data.type) {
            case MessageTypes.CONNECTION_ESTABLISHED:
              setClientId(data.clientId);
              break;

            // Viewport synchronization (basic map marker display)
            case MessageTypes.INITIAL_MARKERS: {
              console.log(`[DEBUG] Received initial_markers with ${data.data.length} markers`);
              const initialMapboxMarkers = data.data.map((marker: any) =>
                convertRBushToMapbox(marker)
              );
              setMarkers(initialMapboxMarkers);

              // Standard marker update event (for event count display)
              emitMarkersUpdated(initialMapboxMarkers);
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
              console.log(`[DEBUG] Received marker_created for ${data.data.id}`);

              // Emit event for notification
              console.log(`[DEBUG] Emitting MARKER_ADDED event`);
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
              console.log(`[DEBUG] Received marker_updated for ${data.data.id}`);
              const updatedMarker = convertRBushToMapbox(data.data);

              // Replace in existing markers
              setMarkers((prev) =>
                prev.map((marker) => (marker.id === updatedMarker.id ? updatedMarker : marker))
              );

              // Could emit a MARKER_MODIFIED event if needed
              break;
            }

            // Real-time update for marker deletion
            case MessageTypes.MARKER_DELETED:
            case MessageTypes.MARKER_DELETE: {
              // Support both new and legacy types
              console.log(`[DEBUG] Received marker deletion for ${data.data.id}`);
              const deletedId = data.data.id;

              // Handle marker deselection if needed
              if (deletedId === selectedMarkerIdRef.current) {
                selectMarker(null);
                eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
                  timestamp: Date.now(),
                  source: "useMapWebSocket",
                });
              }

              // Don't update markers state - let batch updates handle it
              // Just emit the notification event
              console.log(`[DEBUG] Emitting MARKER_REMOVED event`);
              eventBroker.emit<MarkersEvent>(EventTypes.MARKER_REMOVED, {
                timestamp: Date.now(),
                source: "useMapWebSocket",
                markers: [],
                count: 1,
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
    emitMarkersUpdated,
    selectMarker,
    sendViewportUpdate,
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
  };
};
