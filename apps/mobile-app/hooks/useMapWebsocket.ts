// hooks/useMapWebsocket.ts - Using refs for stability
import { useEffect, useState, useRef, useCallback } from "react";
import {
  eventBroker,
  EventTypes,
  ViewportEvent,
  MarkersEvent,
  BaseEvent,
} from "@/services/EventBroker";
import { useMarkerStore } from "@/stores/markerStore";

// Mapbox viewport format
interface MapboxViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Server marker structure adjusted for Mapbox
interface Marker {
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

export const useMapWebSocket = (url: string): MapWebSocketResult => {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentViewport, setCurrentViewport] = useState<MapboxViewport | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  const markersRef = useRef<Marker[]>(markers);

  // Update the ref whenever markers state changes.
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  // Store selected marker id from the marker store.
  const selectedMarkerId = useMarkerStore((state) => state.selectedMarkerId);
  const selectMarker = useMarkerStore((state) => state.selectMarker);

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
  const markerUpdateBatchRef = useRef<Marker[]>([]);
  const markerUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastViewportUpdateRef = useRef<number>(0);
  const lastMarkersUpdateRef = useRef<number>(0);

  // Throttling constants
  const VIEWPORT_THROTTLE_MS = 0;
  const MARKER_UPDATE_BATCH_MS = 0;
  const MARKER_EMIT_THROTTLE_MS = 500;

  const emitMarkersUpdated = useCallback(
    (updatedMarkers: Marker[]) => {
      // Handle marker deselection if needed
      if (selectedMarkerIdRef.current && updatedMarkers.length === 0) {
        console.log("No markers in current viewport, deselecting current marker");
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
          console.log("Selected marker no longer in viewport, deselecting");
          selectMarker(null);
          eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
            timestamp: Date.now(),
            source: "useMapWebSocket",
          });
        }
      }

      // IMPORTANT: Always emit when going from markers to no markers
      // This ensures we update the UI when the user pans away from events
      const wasShowingMarkers = prevMarkerCount.current > 0;
      const isEmptyNow = updatedMarkers.length === 0;

      // Only emit marker updates in these cases:
      // 1. When going from some markers to no markers (moved away from events)
      // 2. When going from no markers to some markers (found new events)
      // 3. When there's a significant change in the number of markers
      const significantChange = Math.abs(updatedMarkers.length - prevMarkerCount.current) >= 2;
      const isFirstResult = prevMarkerCount.current === 0 && updatedMarkers.length > 0;
      const clearedAllMarkers = wasShowingMarkers && isEmptyNow;

      if (significantChange || isFirstResult || clearedAllMarkers) {
        console.log(`Emitting markers updated: ${updatedMarkers.length} markers`);
        eventBroker.emit<MarkersEvent>(EventTypes.MARKERS_UPDATED, {
          timestamp: Date.now(),
          source: "useMapWebSocket",
          markers: updatedMarkers,
          count: updatedMarkers.length,
        });
        prevMarkerCount.current = updatedMarkers.length;
      } else {
        console.log("Skipping markers updated emit: no significant change in count");
      }
    },
    [selectMarker]
  );

  const batchMarkerUpdates = useCallback(
    (updates: Marker[]) => {
      // For simplicity, just update markers immediately instead of batching
      // This reduces complexity while maintaining responsiveness
      setMarkers(updates);

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
          type: "viewport_update",
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
        console.log("Viewport update sent and event emitted");
      } else {
        console.log("Throttled viewport update, too soon since last one");
      }
    }
  }, []);

  // Add a ref to track if initial markers have been received.
  const hasReceivedInitialMarkersRef = useRef<boolean>(false);

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
        type: "viewport_update",
        viewport: viewport,
      };
      ws.current.send(JSON.stringify(message));
      lastViewportUpdateRef.current = Date.now();
      console.log("Viewport update sent to server");
    }
  }, []);

  // Create a stable websocket connection.
  const connectWebSocket = useCallback(() => {
    try {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) return;
      console.log("Connecting to WebSocket server:", url);
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log("WebSocket connection established");
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

          switch (data.type) {
            case "connection_established":
              console.log("Connection established, client ID:", data.clientId);
              setClientId(data.clientId);
              break;

            case "initial_markers": {
              console.log(`Received ${data.data.length} initial markers`);
              const initialMapboxMarkers = data.data.map((marker: any) =>
                convertRBushToMapbox(marker)
              );
              setMarkers(initialMapboxMarkers);

              // Always emit on initial marker load, regardless of count
              // This ensures proper state handling for both empty and populated areas
              emitMarkersUpdated(initialMapboxMarkers);
              break;
            }

            case "marker_updates_batch": {
              const mapboxUpdates = data.data.map((marker: any) => convertRBushToMapbox(marker));
              batchMarkerUpdates(mapboxUpdates);
              break;
            }

            case "marker_delete": {
              console.log("Marker deleted:", data.data.id);
              if (data.data.id === selectedMarkerIdRef.current) {
                console.log("Currently selected marker was deleted, deselecting");
                selectMarker(null);
                eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
                  timestamp: Date.now(),
                  source: "useMapWebSocket",
                });
              }
              setMarkers((prevMarkers) => {
                const updatedMarkers = prevMarkers.filter((marker) => marker.id !== data.data.id);
                emitMarkersUpdated(updatedMarkers);
                return updatedMarkers;
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
        console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
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
