// hooks/useMapWebsocket.ts - Enhanced with marker deselection
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

// Match the server's marker data structure but with Mapbox-friendly coordinates
interface Marker {
  id: string;
  coordinates: [number, number]; // [longitude, latitude] for Mapbox
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

  // Access the marker store for selected marker handling
  const selectedMarkerId = useMarkerStore((state) => state.selectedMarkerId);
  const selectMarker = useMarkerStore((state) => state.selectMarker);

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMarkerCount = useRef<number>(0);

  // Refs for event batching and throttling
  const markerUpdateBatchRef = useRef<Marker[]>([]);
  const markerUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastViewportUpdateRef = useRef<number>(0);
  const lastMarkersUpdateRef = useRef<number>(0);

  // Constants for throttling and batching
  const VIEWPORT_THROTTLE_MS = 500;
  const MARKER_UPDATE_BATCH_MS = 1000;
  const MARKER_EMIT_THROTTLE_MS = 2000;

  // Helper to emit marker updates
  const emitMarkersUpdated = useCallback(
    (updatedMarkers: Marker[]) => {
      // Check if we need to deselect the current marker
      if (selectedMarkerId && updatedMarkers.length === 0) {
        console.log("No markers in current viewport, deselecting current marker");
        selectMarker(null);

        // Emit marker deselected event
        eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
          timestamp: Date.now(),
          source: "useMapWebSocket",
        });
      } else if (selectedMarkerId && updatedMarkers.length > 0) {
        // Check if the selected marker still exists in the current markers
        const selectedMarkerExists = updatedMarkers.some(
          (marker) => marker.id === selectedMarkerId
        );

        if (!selectedMarkerExists) {
          console.log("Selected marker no longer in viewport, deselecting");
          selectMarker(null);

          // Emit marker deselected event
          eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
            timestamp: Date.now(),
            source: "useMapWebSocket",
          });
        }
      }

      // Only emit if the count changed meaningfully
      if (
        Math.abs(updatedMarkers.length - prevMarkerCount.current) > 0 ||
        prevMarkerCount.current === 0
      ) {
        console.log(`Emitting markers updated: ${updatedMarkers.length} markers`);

        eventBroker.emit<MarkersEvent>(EventTypes.MARKERS_UPDATED, {
          timestamp: Date.now(),
          source: "useMapWebSocket",
          markers: updatedMarkers,
          count: updatedMarkers.length,
        });

        // Update previous count
        prevMarkerCount.current = updatedMarkers.length;
      } else {
        console.log(`Skipping markers updated emit: no significant change in count`);
      }
    },
    [selectedMarkerId, selectMarker]
  );

  // Helper to batch marker updates and emit them periodically
  const batchMarkerUpdates = useCallback(
    (updates: Marker[]) => {
      // Add these updates to our batch
      markerUpdateBatchRef.current = [...markerUpdateBatchRef.current, ...updates];

      // If we already have a timeout scheduled, don't schedule another one
      if (markerUpdateTimeoutRef.current) {
        return;
      }

      // Schedule emission of batched updates
      markerUpdateTimeoutRef.current = setTimeout(() => {
        // Clear the timeout ref
        markerUpdateTimeoutRef.current = null;

        // Get the current batch of updates
        const batchToEmit = markerUpdateBatchRef.current;

        // Clear the batch
        markerUpdateBatchRef.current = [];

        // Only emit if there were updates and enough time has passed
        const now = Date.now();
        if (
          batchToEmit.length > 0 &&
          now - lastMarkersUpdateRef.current > MARKER_EMIT_THROTTLE_MS
        ) {
          emitMarkersUpdated(batchToEmit);
          lastMarkersUpdateRef.current = now;
        }
      }, MARKER_UPDATE_BATCH_MS);
    },
    [emitMarkersUpdated]
  );

  // Helper to convert RBush marker format to Mapbox-friendly format
  const convertRBushToMapbox = useCallback((rbushMarker: any): Marker => {
    // For an RBush marker, minX is longitude, minY is latitude
    return {
      id: rbushMarker.id,
      coordinates: [rbushMarker.minX, rbushMarker.minY], // [longitude, latitude] for Mapbox
      data: {
        ...rbushMarker.data,
        // Ensure these fields exist
        title: rbushMarker.data?.title || "Unnamed Event",
        emoji: rbushMarker.data?.emoji || "📍",
        color: rbushMarker.data?.color || "red",
      },
    };
  }, []);

  // Send viewport update to server with throttling
  const sendViewportUpdate = useCallback((viewport: MapboxViewport) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      try {
        const now = Date.now();

        // Only send if we haven't sent recently
        if (now - lastViewportUpdateRef.current > VIEWPORT_THROTTLE_MS) {
          const message = {
            type: "viewport_update",
            viewport,
          };

          ws.current.send(JSON.stringify(message));
          lastViewportUpdateRef.current = now;

          // Emit viewport changed event
          eventBroker.emit<ViewportEvent>(EventTypes.VIEWPORT_CHANGED, {
            timestamp: now,
            source: "useMapWebSocket",
            viewport,
          });

          console.log("Viewport update sent and event emitted");
        } else {
          console.log("Throttled viewport update, too soon since last one");
        }
      } catch (err) {
        console.error("Error sending viewport update:", err);
      }
    }
  }, []);

  // Update viewport state and send to server if connected
  const updateViewport = useCallback(
    (viewport: MapboxViewport) => {
      setCurrentViewport(viewport);
      if (isConnected) {
        sendViewportUpdate(viewport);
      }
    },
    [isConnected, sendViewportUpdate]
  );

  // Create a WebSocket connection
  const connectWebSocket = useCallback(() => {
    try {
      if (ws.current?.readyState === WebSocket.OPEN) {
        return; // Already connected
      }

      console.log("Connecting to WebSocket server:", url);
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log("WebSocket connection established");
        setIsConnected(true);
        setError(null);

        // Emit connection event
        eventBroker.emit<BaseEvent>(EventTypes.WEBSOCKET_CONNECTED, {
          timestamp: Date.now(),
          source: "useMapWebSocket",
        });

        // If we have a viewport, immediately send it
        if (currentViewport) {
          sendViewportUpdate(currentViewport);
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle different message types from the server
          switch (data.type) {
            case "connection_established":
              console.log("Connection established, client ID:", data.clientId);
              setClientId(data.clientId);
              break;

            case "initial_markers":
              console.log(`Received ${data.data.length} initial markers`);
              // Convert RBush format to Mapbox format
              const initialMapboxMarkers = data.data.map((marker: any) =>
                convertRBushToMapbox(marker)
              );

              setMarkers(initialMapboxMarkers);

              // If there are no markers and we have a selected marker, deselect it
              if (initialMapboxMarkers.length === 0 && selectedMarkerId) {
                console.log("No markers in initial data, deselecting current marker");
                selectMarker(null);

                // Emit marker deselected event
                eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
                  timestamp: Date.now(),
                  source: "useMapWebSocket",
                });
              }

              // Always emit for initial markers, but only after a short delay
              // to prevent rapid emission if server sends multiple initial batches
              const now = Date.now();
              if (now - lastMarkersUpdateRef.current > MARKER_EMIT_THROTTLE_MS) {
                emitMarkersUpdated(initialMapboxMarkers);
                lastMarkersUpdateRef.current = now;
              }

              break;

            case "marker_updates_batch":
              // Add to batch and potentially schedule emission
              const mapboxUpdates = data.data.map((marker: any) => convertRBushToMapbox(marker));

              // If we get an empty update and have a selected marker, deselect it
              if (mapboxUpdates.length === 0 && selectedMarkerId) {
                console.log("No markers in update batch, deselecting current marker");
                selectMarker(null);

                // Emit marker deselected event
                eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
                  timestamp: Date.now(),
                  source: "useMapWebSocket",
                });
              }

              batchMarkerUpdates(mapboxUpdates);
              break;

            case "marker_delete":
              console.log("Marker deleted:", data.data.id);

              // If the deleted marker is the selected one, deselect it
              if (data.data.id === selectedMarkerId) {
                console.log("Currently selected marker was deleted, deselecting");
                selectMarker(null);

                // Emit marker deselected event
                eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
                  timestamp: Date.now(),
                  source: "useMapWebSocket",
                });
              }

              // Remove deleted marker
              setMarkers((prevMarkers) => {
                const updatedMarkers = prevMarkers.filter((marker) => marker.id !== data.data.id);

                // Add deletion to the update batch to emit later
                batchMarkerUpdates(updatedMarkers);

                return updatedMarkers;
              });
              break;

            default:
              // If server sends direct array of markers (fallback)
              if (Array.isArray(data)) {
                const mapboxMarkers = data.map((marker: any) => convertRBushToMapbox(marker));

                // If we get an empty array and have a selected marker, deselect it
                if (mapboxMarkers.length === 0 && selectedMarkerId) {
                  console.log("No markers in array data, deselecting current marker");
                  selectMarker(null);

                  // Emit marker deselected event
                  eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
                    timestamp: Date.now(),
                    source: "useMapWebSocket",
                  });
                }

                setMarkers(mapboxMarkers);
                batchMarkerUpdates(mapboxMarkers);
              }
              break;
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
          const error =
            err instanceof Error ? err : new Error("Unknown error parsing WebSocket message");
          setError(error);

          // Emit error event
          eventBroker.emit<BaseEvent & { error: Error }>(EventTypes.ERROR_OCCURRED, {
            timestamp: Date.now(),
            source: "useMapWebSocket",
            error,
          });
        }
      };

      ws.current.onclose = (event) => {
        console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
        setIsConnected(false);
        setClientId(null);

        // Emit disconnection event
        eventBroker.emit<BaseEvent>(EventTypes.WEBSOCKET_DISCONNECTED, {
          timestamp: Date.now(),
          source: "useMapWebSocket",
        });

        // Attempt to reconnect after a delay
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 5000); // Try to reconnect every 5 seconds
      };

      ws.current.onerror = (event) => {
        console.error("WebSocket error:", event);
        const error = new Error("WebSocket connection error");
        setError(error);

        // Emit error event
        eventBroker.emit<BaseEvent & { error: Error }>(EventTypes.ERROR_OCCURRED, {
          timestamp: Date.now(),
          source: "useMapWebSocket",
          error,
        });
      };
    } catch (err) {
      console.error("Error creating WebSocket connection:", err);
      const error =
        err instanceof Error ? err : new Error("Unknown error creating WebSocket connection");
      setError(error);

      // Emit error event
      eventBroker.emit<BaseEvent & { error: Error }>(EventTypes.ERROR_OCCURRED, {
        timestamp: Date.now(),
        source: "useMapWebSocket",
        error,
      });
    }
  }, [
    batchMarkerUpdates,
    convertRBushToMapbox,
    currentViewport,
    emitMarkersUpdated,
    selectMarker,
    selectedMarkerId,
    sendViewportUpdate,
    url,
  ]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (ws.current) {
        ws.current.close();
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (markerUpdateTimeoutRef.current) {
        clearTimeout(markerUpdateTimeoutRef.current);
      }
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
