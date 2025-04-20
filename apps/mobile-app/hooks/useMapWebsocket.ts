// hooks/useMapWebsocket.ts
import { useEffect, useState, useRef, useCallback } from "react";
import {
  eventBroker,
  EventTypes,
  ViewportEvent,
  MarkersEvent,
  BaseEvent,
  DiscoveryEvent,
  LevelUpdateEvent,
  XPAwardedEvent,
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
    eventDate?: string;
    endDate?: string;
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
  VIEWPORT_UPDATE: "viewport-update",

  // New event types from filter processor
  REPLACE_ALL: "replace-all",
  ADD_EVENT: "add-event",
  UPDATE_EVENT: "update-event",
  DELETE_EVENT: "delete-event",

  // For backward compatibility
  SESSION_UPDATE: "session_update",

  // New event type for discovered events
  EVENT_DISCOVERED: "event_discovered",

  // Leveling system events
  LEVEL_UPDATE: "level-update",
  XP_AWARDED: "xp-awarded",
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

  // Refs for various values
  const markersRef = useRef<Marker[]>(markers);
  const selectedMarkerIdRef = useRef<string | null>(null);
  const currentViewportRef = useRef<MapboxViewport | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMarkerCount = useRef<number>(0);
  const markerUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstConnectionRef = useRef<boolean>(true);

  // Update refs when state changes
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  useEffect(() => {
    currentViewportRef.current = currentViewport;
  }, [currentViewport]);

  // Get selectMarker function and selectedMarkerId from store
  const selectMarker = useLocationStore((state) => state.selectMarker);
  const selectedMarkerId = useLocationStore((state) => state.selectedMarkerId);

  // Update selectedMarkerIdRef when store value changes
  useEffect(() => {
    selectedMarkerIdRef.current = selectedMarkerId;
  }, [selectedMarkerId]);

  // Update store markers when local markers change
  useEffect(() => {
    setStoreMarkers(markers);
  }, [markers, setStoreMarkers]);

  // Function to emit marker updates - memoized
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

      // Only emit event if there's a significant change in marker count or state
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

  // Convert event object to marker format - memoized
  const convertEventToMarker = useCallback((event: any): Marker => {
    return {
      id: event.id,
      coordinates: event.location.coordinates,
      data: {
        title: event.title || "Unnamed Event",
        emoji: event.emoji || "📍",
        color: event.color || "red",
        description: event.description,
        eventDate: event.eventDate,
        endDate: event.endDate,
        categories: event.categories?.map((c: any) => c.name || c),
        isVerified: event.isVerified,
        created_at: event.createdAt,
        updated_at: event.updatedAt,
        status: event.status,
        ...event.metadata,
      },
    };
  }, []);

  // Simplified viewport update function - memoized
  const sendViewportUpdate = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && currentViewportRef.current) {
      const message = {
        type: MessageTypes.VIEWPORT_UPDATE,
        viewport: currentViewportRef.current,
      };
      wsRef.current.send(JSON.stringify(message));

      // Emit viewport changed event
      eventBroker.emit<ViewportEvent>(EventTypes.VIEWPORT_CHANGED, {
        timestamp: Date.now(),
        source: "useMapWebSocket",
        viewport: currentViewportRef.current,
        markers: markersRef.current,
      });
    }
  }, []);

  // Update viewport function - memoized
  const updateViewport = useCallback(
    (viewport: MapboxViewport) => {
      // Store the viewport in both state and ref
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
      sendViewportUpdate();
    },
    [sendViewportUpdate]
  );

  // Message handler function - memoized to prevent recreation on each render
  const handleWebSocketMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (!data || typeof data !== "object") {
          console.warn("[useMapWebsocket] Received invalid message data");
          return;
        }

        switch (data.type) {
          case MessageTypes.CONNECTION_ESTABLISHED:
            if (data.clientId) {
              setClientId(data.clientId);
            }
            break;

          // Handle complete replacement of all markers
          case MessageTypes.REPLACE_ALL:
          case MessageTypes.VIEWPORT_UPDATE: {
            if (!Array.isArray(data.events)) {
              console.warn("[useMapWebsocket] Invalid events array in REPLACE_ALL/VIEWPORT_UPDATE");
              return;
            }

            try {
              const newMarkers = data.events.map(convertEventToMarker);
              setMarkers(newMarkers);
              emitMarkersUpdated(newMarkers);

              // Signal that search is complete
              if (currentViewportRef.current) {
                eventBroker.emit<ViewportEvent & { searching: boolean }>(
                  EventTypes.VIEWPORT_CHANGED,
                  {
                    timestamp: Date.now(),
                    source: "useMapWebSocket",
                    viewport: currentViewportRef.current,
                    markers: newMarkers,
                    searching: false,
                  }
                );
              }
            } catch (error) {
              console.error(
                "[useMapWebsocket] Error processing REPLACE_ALL/VIEWPORT_UPDATE:",
                error
              );
            }
            break;
          }

          // Handle adding a new event
          case MessageTypes.ADD_EVENT: {
            if (!data.event) {
              console.warn("[useMapWebsocket] Missing event data in ADD_EVENT");
              return;
            }

            try {
              const newMarker = convertEventToMarker(data.event);
              setMarkers((prev) => [...prev, newMarker]);
              eventBroker.emit<MarkersEvent>(EventTypes.MARKER_ADDED, {
                timestamp: Date.now(),
                source: "useMapWebSocket",
                markers: [newMarker],
                count: 1,
              });
            } catch (error) {
              console.error("[useMapWebsocket] Error processing ADD_EVENT:", error);
            }
            break;
          }

          // Handle updating an existing event
          case MessageTypes.UPDATE_EVENT: {
            if (!data.event) {
              console.warn("[useMapWebsocket] Missing event data in UPDATE_EVENT");
              return;
            }

            try {
              const updatedMarker = convertEventToMarker(data.event);
              setMarkers((prev) =>
                prev.map((marker) => (marker.id === updatedMarker.id ? updatedMarker : marker))
              );
            } catch (error) {
              console.error("[useMapWebsocket] Error processing UPDATE_EVENT:", error);
            }
            break;
          }

          // Handle deleting an event
          case MessageTypes.DELETE_EVENT: {
            if (!data.id) {
              console.warn("[useMapWebsocket] Missing id in DELETE_EVENT");
              return;
            }

            try {
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
            } catch (error) {
              console.error("[useMapWebsocket] Error processing DELETE_EVENT:", error);
            }
            break;
          }

          // Handle discovered events
          case MessageTypes.EVENT_DISCOVERED: {
            if (!data.event) {
              console.warn("[useMapWebsocket] Missing event data in EVENT_DISCOVERED");
              return;
            }

            try {
              eventBroker.emit<DiscoveryEvent>(EventTypes.EVENT_DISCOVERED, {
                timestamp: Date.now(),
                source: "useMapWebSocket",
                event: data.event,
              });
            } catch (error) {
              console.error("[useMapWebsocket] Error processing EVENT_DISCOVERED:", error);
            }
            break;
          }

          // Handle level updates
          case MessageTypes.LEVEL_UPDATE: {
            try {
              eventBroker.emit<LevelUpdateEvent>(EventTypes.LEVEL_UPDATE, {
                timestamp: Date.now(),
                source: "useMapWebSocket",
                data: {
                  userId: data.data.userId,
                  level: data.data.level,
                  title: data.data.title,
                  xpProgress: 0, // This will be updated by the XP bar component
                  action: data.data.action,
                  timestamp: data.data.timestamp,
                },
              });
            } catch (error) {
              console.error("[useMapWebsocket] Error processing LEVEL_UPDATE:", error);
            }
            break;
          }

          // Handle XP awarded events
          case MessageTypes.XP_AWARDED: {
            try {
              eventBroker.emit<XPAwardedEvent>(EventTypes.XP_AWARDED, {
                timestamp: Date.now(),
                source: "useMapWebSocket",
                data: {
                  userId: data.data.userId,
                  amount: data.data.amount,
                  reason: data.data.action,
                  timestamp: data.data.timestamp,
                },
              });
            } catch (error) {
              console.error("[useMapWebsocket] Error processing XP_AWARDED:", error);
            }
            break;
          }

          // Fallback for other message types
          default: {
            console.debug("[useMapWebsocket] Unhandled message type:", data.type);
            break;
          }
        }
      } catch (err) {
        console.error("[useMapWebsocket] Error parsing WebSocket message:", err);
        const errorObj =
          err instanceof Error ? err : new Error("Unknown error parsing WebSocket message");
        setError(errorObj);
        eventBroker.emit<BaseEvent & { error: Error }>(EventTypes.ERROR_OCCURRED, {
          timestamp: Date.now(),
          source: "useMapWebSocket",
          error: errorObj,
        });
      }
    },
    [convertEventToMarker, emitMarkersUpdated, selectMarker]
  );

  // Create a stable websocket connection - memoized
  const connectWebSocket = useCallback(() => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

      // Clean up existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        try {
          setIsConnected(true);
          setError(null);
          eventBroker.emit<BaseEvent>(EventTypes.WEBSOCKET_CONNECTED, {
            timestamp: Date.now(),
            source: "useMapWebSocket",
          });

          // Send user identification if authenticated
          if (isAuthenticated && user?.id) {
            wsRef.current?.send(
              JSON.stringify({
                type: MessageTypes.CLIENT_IDENTIFICATION,
                userId: user.id,
              })
            );
          } else {
            console.warn("Unable to identify WebSocket connection: user not authenticated");
          }

          // Send viewport update if available (force immediate send)
          if (currentViewportRef.current) {
            sendViewportUpdate();
          }

          // First connection is complete
          isFirstConnectionRef.current = false;
        } catch (error) {
          console.error("[useMapWebsocket] Error in onopen handler:", error);
          setError(error instanceof Error ? error : new Error("Unknown error in onopen handler"));
        }
      };

      wsRef.current.onmessage = handleWebSocketMessage;

      wsRef.current.onclose = (event) => {
        try {
          setIsConnected(false);
          setClientId(null);
          eventBroker.emit<BaseEvent>(EventTypes.WEBSOCKET_DISCONNECTED, {
            timestamp: Date.now(),
            source: "useMapWebSocket",
          });

          // Clear any existing reconnect timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }

          // Set up reconnection with increasing backoff
          const reconnectDelay = isFirstConnectionRef.current ? 1000 : 5000;

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connectWebSocket();
          }, reconnectDelay);
        } catch (error) {
          console.error("[useMapWebsocket] Error in onclose handler:", error);
        }
      };

      wsRef.current.onerror = (event) => {
        try {
          console.error("WebSocket error:", event);
          const errorObj = new Error("WebSocket connection error");
          setError(errorObj);
          eventBroker.emit<BaseEvent & { error: Error }>(EventTypes.ERROR_OCCURRED, {
            timestamp: Date.now(),
            source: "useMapWebSocket",
            error: errorObj,
          });
        } catch (error) {
          console.error("[useMapWebsocket] Error in onerror handler:", error);
        }
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
  }, [url, isAuthenticated, user, sendViewportUpdate, handleWebSocketMessage]);

  // Connect on mount and clean up on unmount
  useEffect(() => {
    connectWebSocket();

    // Cleanup function to run on unmount
    return () => {
      // Close websocket if open
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Clear all timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (markerUpdateTimeoutRef.current) {
        clearTimeout(markerUpdateTimeoutRef.current);
        markerUpdateTimeoutRef.current = null;
      }

      if (viewportUpdateTimeoutRef.current) {
        clearTimeout(viewportUpdateTimeoutRef.current);
        viewportUpdateTimeoutRef.current = null;
      }
    };
  }, [connectWebSocket]);

  // Listen for force viewport update events
  useEffect(() => {
    const handleForceViewportUpdate = () => {
      if (currentViewportRef.current) {
        updateViewport(currentViewportRef.current);
      }
    };

    const unsubscribe = eventBroker.on(EventTypes.FORCE_VIEWPORT_UPDATE, handleForceViewportUpdate);

    return () => {
      unsubscribe();
    };
  }, [updateViewport]);

  return {
    markers,
    isConnected,
    error,
    currentViewport,
    updateViewport,
    clientId,
  };
};
