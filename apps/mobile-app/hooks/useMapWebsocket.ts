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
import { useAuth } from "@/contexts/AuthContext";

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

// Updated message types to align with the new architecture
const MessageTypes = {
  // Connection messages
  CONNECTION_ESTABLISHED: "connection_established",
  CLIENT_IDENTIFICATION: "client_identification",

  // Viewport-related
  VIEWPORT_UPDATE: "viewport_update",

  // New event types from filter processor
  REPLACE_ALL: "replace-all",
  ADD_EVENT: "add-event",
  UPDATE_EVENT: "update-event",
  DELETE_EVENT: "delete-event",

  // For backward compatibility
  SESSION_UPDATE: "session_update",
};

export const useMapWebSocket = (url: string): MapWebSocketResult => {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentViewport, setCurrentViewport] = useState<MapboxViewport | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  // Get the authenticated user from AuthContext
  const { user, isAuthenticated } = useAuth();

  const setStoreMarkers = useLocationStore.getState().setMarkers;

  const markersRef = useRef<Marker[]>(markers);

  // Update the ref whenever markers state changes
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  useEffect(() => {
    // Update the global store whenever the local markers state changes
    setStoreMarkers(markers);
  }, [markers, setStoreMarkers]);

  // Store selected marker id from the marker store
  const selectedMarkerId = useLocationStore((state) => state.selectedMarkerId);
  const selectMarker = useLocationStore((state) => state.selectMarker);

  // Create refs for values that change frequently
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

  // Refs for throttling and batching marker updates
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

  // Convert event object to marker format
  const convertEventToMarker = useCallback((event: any): Marker => {
    return {
      id: event.id,
      coordinates: event.location.coordinates,
      data: {
        title: event.title || "Unnamed Event",
        emoji: event.emoji || "📍",
        color: event.color || "red",
        description: event.description,
        categories: event.categories?.map((c: any) => c.id || c),
        isVerified: event.isVerified,
        created_at: event.createdAt,
        updated_at: event.updatedAt,
        status: event.status,
        ...event.metadata,
      },
    };
  }, []);

  // Use a function that reads currentViewportRef so it does not change on every render
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

  // Create a stable websocket connection
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

        // Send user identification if authenticated
        if (isAuthenticated && user?.id) {
          ws.current?.send(
            JSON.stringify({
              type: MessageTypes.CLIENT_IDENTIFICATION,
              userId: user.id,
            })
          );

          console.log(`Identified WebSocket connection with user ID: ${user.id}`);
        } else {
          console.warn("Unable to identify WebSocket connection: user not authenticated");
        }

        if (currentViewportRef.current) {
          sendViewportUpdate();
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          console.log("DATA", data);

          switch (data.type) {
            case MessageTypes.CONNECTION_ESTABLISHED:
              setClientId(data.clientId);
              break;

            // Handle complete replacement of all markers
            case MessageTypes.REPLACE_ALL: {
              const newMarkers = data.events.map((event: any) => convertEventToMarker(event));
              setMarkers(newMarkers);
              emitMarkersUpdated(newMarkers);
              break;
            }

            // Handle adding a new event
            case MessageTypes.ADD_EVENT: {
              const newMarker = convertEventToMarker(data.event);
              setMarkers((prev) => [...prev, newMarker]);
              eventBroker.emit<MarkersEvent>(EventTypes.MARKER_ADDED, {
                timestamp: Date.now(),
                source: "useMapWebSocket",
                markers: [newMarker],
                count: 1,
              });
              break;
            }

            // Handle updating an existing event
            case MessageTypes.UPDATE_EVENT: {
              const updatedMarker = convertEventToMarker(data.event);
              setMarkers((prev) =>
                prev.map((marker) => (marker.id === updatedMarker.id ? updatedMarker : marker))
              );
              break;
            }

            // Handle deleting an event
            case MessageTypes.DELETE_EVENT: {
              const deletedId = data.id;
              // Handle marker deselection if needed
              if (deletedId === selectedMarkerIdRef.current) {
                selectMarker(null);
                eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
                  timestamp: Date.now(),
                  source: "useMapWebSocket",
                });
              }

              setMarkers((prev) => prev.filter((marker) => marker.id !== deletedId));
              eventBroker.emit<MarkersEvent>(EventTypes.MARKER_REMOVED, {
                timestamp: Date.now(),
                source: "useMapWebSocket",
                markers: [],
                count: 1,
              });
              break;
            }

            // Fallback for other message types
            default: {
              console.log(`Received unhandled message type: ${data.type}`);
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
    isAuthenticated,
    user,
    convertEventToMarker,
    emitMarkersUpdated,
    selectMarker,
    sendViewportUpdate,
  ]);

  // Connect on mount and clean up on unmount
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
