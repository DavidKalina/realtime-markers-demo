// hooks/useMapWebsocket.ts - Updated with EventBroker
import { useEffect, useState, useRef } from "react";
import {
  eventBroker,
  EventTypes,
  ViewportEvent,
  MarkersEvent,
  BaseEvent,
} from "@/services/EventBroker";

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

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMarkerCount = useRef<number>(0);

  // Create a WebSocket connection
  const connectWebSocket = () => {
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

              // Emit markers updated event with count information
              eventBroker.emit<MarkersEvent>(EventTypes.MARKERS_UPDATED, {
                timestamp: Date.now(),
                source: "useMapWebSocket",
                markers: initialMapboxMarkers,
                count: initialMapboxMarkers.length,
              });

              // Track marker count for comparison
              prevMarkerCount.current = initialMapboxMarkers.length;
              break;

            case "marker_updates_batch":
              console.log(`Received ${data.data.length} marker updates`);
              // Convert and merge updates with existing markers
              const mapboxUpdates = data.data.map((marker: any) => convertRBushToMapbox(marker));

              setMarkers((prevMarkers) => {
                const markerMap = new Map(prevMarkers.map((m) => [m.id, m]));
                mapboxUpdates.forEach((marker: Marker) => {
                  markerMap.set(marker.id, marker);
                });
                const updatedMarkers = Array.from(markerMap.values());

                // Emit markers updated event only if the count changed
                if (updatedMarkers.length !== prevMarkerCount.current) {
                  eventBroker.emit<MarkersEvent>(EventTypes.MARKERS_UPDATED, {
                    timestamp: Date.now(),
                    source: "useMapWebSocket",
                    markers: updatedMarkers,
                    count: updatedMarkers.length,
                  });
                  // Update previous count
                  prevMarkerCount.current = updatedMarkers.length;
                }

                return updatedMarkers;
              });
              break;

            case "marker_delete":
              console.log("Marker deleted:", data.data.id);
              // Remove deleted marker
              setMarkers((prevMarkers) => {
                const updatedMarkers = prevMarkers.filter((marker) => marker.id !== data.data.id);

                // Emit markers updated event if count changed
                if (updatedMarkers.length !== prevMarkerCount.current) {
                  eventBroker.emit<MarkersEvent>(EventTypes.MARKERS_UPDATED, {
                    timestamp: Date.now(),
                    source: "useMapWebSocket",
                    markers: updatedMarkers,
                    count: updatedMarkers.length,
                  });
                  // Update previous count
                  prevMarkerCount.current = updatedMarkers.length;
                }

                return updatedMarkers;
              });
              break;

            default:
              // If server sends direct array of markers (fallback)
              if (Array.isArray(data)) {
                const mapboxMarkers = data.map((marker: any) => convertRBushToMapbox(marker));
                setMarkers(mapboxMarkers);

                // Emit markers updated event
                eventBroker.emit<MarkersEvent>(EventTypes.MARKERS_UPDATED, {
                  timestamp: Date.now(),
                  source: "useMapWebSocket",
                  markers: mapboxMarkers,
                  count: mapboxMarkers.length,
                });

                // Update previous count
                prevMarkerCount.current = mapboxMarkers.length;
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
  };

  // Helper to convert RBush marker format to Mapbox-friendly format
  const convertRBushToMapbox = (rbushMarker: any): Marker => {
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
  };

  // Send viewport update to server
  const sendViewportUpdate = (viewport: MapboxViewport) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      try {
        const message = {
          type: "viewport_update",
          viewport,
        };

        ws.current.send(JSON.stringify(message));

        // Emit viewport changed event
        eventBroker.emit<ViewportEvent>(EventTypes.VIEWPORT_CHANGED, {
          timestamp: Date.now(),
          source: "useMapWebSocket",
          viewport,
        });
      } catch (err) {
        console.error("Error sending viewport update:", err);
      }
    }
  };

  // Update viewport state and send to server if connected
  const updateViewport = (viewport: MapboxViewport) => {
    setCurrentViewport(viewport);
    if (isConnected) {
      sendViewportUpdate(viewport);
    }
  };

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
    };
  }, [url]);

  return {
    markers,
    isConnected,
    error,
    currentViewport,
    updateViewport,
    clientId,
  };
};
