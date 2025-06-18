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
  NotificationEvent,
} from "@/services/EventBroker";
import { useLocationStore } from "@/stores/useLocationStoreWeb";
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
    isPrivate?: boolean;
    status?: string; // Added status here as it's in convertEventToMarker
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  VIEWPORT_UPDATE: "viewport-update", // Note: Server sends REPLACE_ALL for viewport-triggered full updates

  // New event types from filter processor
  REPLACE_ALL: "replace-all",
  ADD_EVENT: "add-event",
  UPDATE_EVENT: "update-event",
  DELETE_EVENT: "delete-event",

  // For backward compatibility (consider if still needed or can be phased out)
  SESSION_UPDATE: "session_update",

  // New event type for discovered events
  EVENT_DISCOVERED: "event_discovered",

  // Notifications (ensure this matches server, server uses "notification", client uses "new_notification")
  // Let's align this. I'll assume server sends "notification" based on websocket/index.ts
  NOTIFICATION: "notification", // ALIGNED with typical server pattern

  // Leveling system events
  LEVEL_UPDATE: "level-update",
  XP_AWARDED: "xp-awarded",
};

export const useMapWebSocket = (url: string): MapWebSocketResult => {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentViewport, setCurrentViewport] = useState<MapboxViewport | null>(
    null,
  );
  const [clientId, setClientId] = useState<string | null>(null);

  const { user, isAuthenticated } = useAuth();
  const setStoreMarkers = useLocationStore.getState().setMarkers; // Direct store access

  const markersRef = useRef<Marker[]>(markers);
  const currentViewportRef = useRef<MapboxViewport | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isFirstConnectionRef = useRef<boolean>(true); // Used for initial reconnect delay

  // Refs to avoid stale closures in callbacks
  const selectMarkerFromStoreRef = useRef(
    useLocationStore.getState().selectMarker,
  );
  const selectedMarkerIdFromStoreRef = useRef(
    useLocationStore.getState().selectedMarkerId,
  );

  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  useEffect(() => {
    currentViewportRef.current = currentViewport;
  }, [currentViewport]);

  // Subscribe to store changes for selection to keep refs updated
  useEffect(() => {
    const unsubscribe = useLocationStore.subscribe((state) => {
      selectMarkerFromStoreRef.current = state.selectMarker;
      selectedMarkerIdFromStoreRef.current = state.selectedMarkerId;
    });
    // Initialize refs on mount
    selectMarkerFromStoreRef.current = useLocationStore.getState().selectMarker;
    selectedMarkerIdFromStoreRef.current =
      useLocationStore.getState().selectedMarkerId;
    return unsubscribe;
  }, []);

  useEffect(() => {
    setStoreMarkers(markers); // This calls the store's setMarkers
  }, [markers, setStoreMarkers]);

  // Function to emit marker updates - memoized
  const emitMarkersUpdated = useCallback(
    (
      updatedMarkers: Marker[],
      actionType: "replace" | "add" | "update" | "delete",
    ) => {
      const selectedId = selectedMarkerIdFromStoreRef.current;
      const selectMarkerFunc = selectMarkerFromStoreRef.current;

      // Handle deselection if the selected marker is removed or no longer exists
      if (selectedId) {
        const selectedMarkerExists = updatedMarkers.some(
          (marker) => marker.id === selectedId,
        );
        if (
          !selectedMarkerExists ||
          (actionType === "delete" &&
            updatedMarkers.find((m) => m.id === selectedId) === undefined)
        ) {
          selectMarkerFunc(null);
          eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
            timestamp: Date.now(),
            source: "useMapWebSocket",
          });
        }
      }

      // Emit a general MARKERS_UPDATED event.
      // Consumers can then decide how to react based on the full list.
      // The specific add/update/delete events below give more granular info.
      eventBroker.emit<MarkersEvent>(EventTypes.MARKERS_UPDATED, {
        timestamp: Date.now(),
        source: "useMapWebSocket",
        markers: updatedMarkers,
        count: updatedMarkers.length,
      });
    },
    [], // Dependencies are managed via refs now
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categories: event.categories?.map((c: any) => c.name || c), // Ensure categories are handled
        isVerified: event.isVerified,
        created_at: event.createdAt,
        updated_at: event.updatedAt,
        isPrivate: event.isPrivate,
        status: event.status,
        // Add recurring event fields
        isRecurring: event.isRecurring ?? false,
        recurrenceFrequency: event.recurrenceFrequency,
        recurrenceDays: event.recurrenceDays,
        recurrenceStartDate: event.recurrenceStartDate,
        recurrenceEndDate: event.recurrenceEndDate,
        recurrenceInterval: event.recurrenceInterval,
        recurrenceTime: event.recurrenceTime,
        recurrenceExceptions: event.recurrenceExceptions,
        ...(event.metadata || {}), // Ensure metadata is spread safely
      },
    };
  }, []);

  const sendViewportUpdateToServer = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN &&
      currentViewportRef.current
    ) {
      const message = {
        type: MessageTypes.VIEWPORT_UPDATE, // This message type is correct for informing the server
        viewport: currentViewportRef.current,
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const updateViewport = useCallback(
    (viewport: MapboxViewport) => {
      setCurrentViewport(viewport); // Update local state
      currentViewportRef.current = viewport; // Update ref immediately

      eventBroker.emit<ViewportEvent & { searching: boolean }>(
        EventTypes.VIEWPORT_CHANGED,
        {
          timestamp: Date.now(),
          source: "useMapWebSocket",
          viewport: viewport,
          markers: markersRef.current, // Send current markers for context
          searching: true,
        },
      );

      sendViewportUpdateToServer(); // Send to server
    },
    [sendViewportUpdateToServer], // Dependency
  );

  const handleWebSocketMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (!data || typeof data !== "object" || !data.type) {
          console.warn(
            "[useMapWebsocket] Received invalid or typeless message data:",
            data,
          );
          return;
        }

        switch (data.type) {
          case MessageTypes.CONNECTION_ESTABLISHED:
            if (data.clientId) {
              setClientId(data.clientId);
            }
            break;

          case MessageTypes.REPLACE_ALL: // Server sends this for full viewport/filter updates
            // Note: The server also sends VIEWPORT_UPDATE which the FilterProcessor uses.
            // The client receives REPLACE_ALL as the result of a viewport change.
            if (!Array.isArray(data.events)) {
              console.warn(
                "[useMapWebsocket] Invalid events array in REPLACE_ALL",
              );
              setMarkers([]); // Clear markers on invalid data
              emitMarkersUpdated([], "replace");
              return;
            }
            try {
              const newMarkers = data.events.map(convertEventToMarker);
              setMarkers(newMarkers);
              emitMarkersUpdated(newMarkers, "replace");

              if (currentViewportRef.current) {
                eventBroker.emit<ViewportEvent & { searching: boolean }>(
                  EventTypes.VIEWPORT_CHANGED,
                  {
                    timestamp: Date.now(),
                    source: "useMapWebSocket",
                    viewport: currentViewportRef.current,
                    markers: newMarkers,
                    searching: false, // Search is complete
                  },
                );
              }
            } catch (e) {
              console.error(
                "[useMapWebsocket] Error processing REPLACE_ALL:",
                e,
              );
              setMarkers([]);
              emitMarkersUpdated([], "replace");
            }
            break;

          case MessageTypes.ADD_EVENT: {
            if (!data.event || !data.event.id) {
              console.warn(
                "[useMapWebsocket] Missing or invalid event data in ADD_EVENT",
              );
              return;
            }
            try {
              const newMarker = convertEventToMarker(data.event);
              let added = false;
              setMarkers((prevMarkers) => {
                // Prevent duplicates if message is somehow re-processed
                if (!prevMarkers.some((m) => m.id === newMarker.id)) {
                  added = true;
                  return [...prevMarkers, newMarker];
                }
                return prevMarkers;
              });
              if (added) {
                eventBroker.emit<MarkersEvent>(EventTypes.MARKER_ADDED, {
                  timestamp: Date.now(),
                  source: "useMapWebSocket",
                  markers: [newMarker],
                  count: 1,
                });
                // emitMarkersUpdated is called implicitly by setMarkers -> useEffect
              }
            } catch (e) {
              console.error("[useMapWebsocket] Error processing ADD_EVENT:", e);
            }
            break;
          }

          case MessageTypes.UPDATE_EVENT: {
            if (!data.event || !data.event.id) {
              console.warn(
                "[useMapWebsocket] Missing or invalid event data in UPDATE_EVENT",
              );
              return;
            }
            try {
              const updatedMarker = convertEventToMarker(data.event);
              let markerFoundAndUpdated = false;
              let markerAdded = false;

              setMarkers((prevMarkers) => {
                const existingMarkerIndex = prevMarkers.findIndex(
                  (marker) => marker.id === updatedMarker.id,
                );

                if (existingMarkerIndex !== -1) {
                  const newMarkers = [...prevMarkers];
                  newMarkers[existingMarkerIndex] = updatedMarker;
                  markerFoundAndUpdated = true;
                  return newMarkers;
                } else {
                  // Event was not previously visible, now it is (due to update)
                  markerAdded = true;
                  return [...prevMarkers, updatedMarker];
                }
              });

              if (markerFoundAndUpdated) {
                eventBroker.emit<MarkersEvent>(EventTypes.MARKERS_UPDATED, {
                  // Emitting specific MARKERS_UPDATED for this single marker
                  timestamp: Date.now(),
                  source: "useMapWebSocket",
                  markers: [updatedMarker],
                  count: 1,
                });
              } else if (markerAdded) {
                eventBroker.emit<MarkersEvent>(EventTypes.MARKER_ADDED, {
                  timestamp: Date.now(),
                  source: "useMapWebSocket",
                  markers: [updatedMarker],
                  count: 1,
                });
              }
              // emitMarkersUpdated for the whole list is called by setMarkers -> useEffect
            } catch (e) {
              console.error(
                "[useMapWebsocket] Error processing UPDATE_EVENT:",
                e,
              );
            }
            break;
          }

          case MessageTypes.DELETE_EVENT: {
            if (!data.id) {
              console.warn("[useMapWebsocket] Missing id in DELETE_EVENT");
              return;
            }
            try {
              const deletedId = data.id;
              let deleted = false;
              setMarkers((prevMarkers) => {
                const newMarkers = prevMarkers.filter(
                  (marker) => marker.id !== deletedId,
                );
                if (newMarkers.length < prevMarkers.length) {
                  deleted = true;
                }
                return newMarkers;
              });

              if (deleted) {
                // Check if the deleted marker was selected
                if (deletedId === selectedMarkerIdFromStoreRef.current) {
                  selectMarkerFromStoreRef.current(null); // Deselect
                  eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
                    timestamp: Date.now(),
                    source: "useMapWebSocket",
                  });
                }
                eventBroker.emit<MarkersEvent>(EventTypes.MARKER_REMOVED, {
                  timestamp: Date.now(),
                  source: "useMapWebSocket",
                  markers: [
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    { id: deletedId, coordinates: [0, 0], data: {} as any },
                  ], // Send ID for identification
                  count: 1,
                });
                // emitMarkersUpdated for the whole list is called by setMarkers -> useEffect
              }
            } catch (e) {
              console.error(
                "[useMapWebsocket] Error processing DELETE_EVENT:",
                e,
              );
            }
            break;
          }

          case MessageTypes.EVENT_DISCOVERED: {
            if (!data.event) {
              console.warn(
                "[useMapWebsocket] Missing event data in EVENT_DISCOVERED",
              );
              return;
            }
            try {
              eventBroker.emit<DiscoveryEvent>(EventTypes.EVENT_DISCOVERED, {
                timestamp: Date.now(),
                source: "useMapWebSocket",
                event: data.event, // Assuming data.event is in the correct server format
              });
            } catch (e) {
              console.error(
                "[useMapWebsocket] Error processing EVENT_DISCOVERED:",
                e,
              );
            }
            break;
          }

          case MessageTypes.NOTIFICATION: {
            // ALIGNED
            if (!data.title || !data.message) {
              // Assuming server sends title and message directly
              console.warn("[useMapWebsocket] Missing notification content");
              return;
            }
            try {
              eventBroker.emit<NotificationEvent>(EventTypes.NOTIFICATION, {
                timestamp: data.timestamp || Date.now(), // Use server timestamp if available
                source: data.source || "useMapWebSocket", // Use server source if available
                title: data.title,
                message: data.message,
                notificationType: data.notificationType || "info",
                duration: data.duration || 5000,
              });
            } catch (e) {
              console.error(
                "[useMapWebsocket] Error processing NOTIFICATION:",
                e,
              );
            }
            break;
          }

          case MessageTypes.LEVEL_UPDATE:
          case MessageTypes.XP_AWARDED: {
            if (!data.data || !data.data.userId) {
              console.warn(`[useMapWebsocket] Missing data in ${data.type}`);
              return;
            }
            const eventType =
              data.type === MessageTypes.LEVEL_UPDATE
                ? EventTypes.LEVEL_UPDATE
                : EventTypes.XP_AWARDED;
            try {
              eventBroker.emit<LevelUpdateEvent | XPAwardedEvent>(eventType, {
                timestamp: data.data.timestamp || Date.now(),
                source: "useMapWebSocket",
                data: {
                  // Spread to ensure all fields are captured
                  ...data.data,
                  xpProgress:
                    data.type === MessageTypes.LEVEL_UPDATE ? 0 : undefined, // xpProgress only for LEVEL_UPDATE
                },
              });
            } catch (e) {
              console.error(
                `[useMapWebsocket] Error processing ${data.type}:`,
                e,
              );
            }
            break;
          }

          // Consider if SESSION_UPDATE is still actively used or can be deprecated
          case MessageTypes.SESSION_UPDATE: {
            // Handle session update if necessary
            console.debug("[useMapWebsocket] Received SESSION_UPDATE:", data);
            break;
          }

          default: {
            console.debug(
              "[useMapWebsocket] Unhandled message type:",
              data.type,
              data,
            );
            break;
          }
        }
      } catch (err) {
        console.error(
          "[useMapWebsocket] Error parsing WebSocket message:",
          err,
          event.data,
        );
        const errorObj =
          err instanceof Error
            ? err
            : new Error("Unknown error parsing WebSocket message");
        setError(errorObj);
        eventBroker.emit<BaseEvent & { error: Error }>(
          EventTypes.ERROR_OCCURRED,
          {
            timestamp: Date.now(),
            source: "useMapWebSocket",
            error: errorObj,
          },
        );
      }
    },
    [convertEventToMarker], // emitMarkersUpdated is not needed here if setMarkers -> useEffect handles it
    // selectMarker/selectedMarkerId are handled via refs
  );

  // This useEffect will call emitMarkersUpdated whenever markers state changes from ADD, UPDATE, DELETE, REPLACE_ALL
  useEffect(() => {
    // Determine action type based on previous vs current markers if needed,
    // or just assume 'replace' if more detailed tracking is too complex.
    // For simplicity, we can call it with a generic 'replace' type here,
    // as the more specific eventBroker events (MARKER_ADDED, etc.) have already fired.
    emitMarkersUpdated(markers, "replace");
  }, [markers, emitMarkersUpdated]);

  const connectWebSocket = useCallback(() => {
    // ... (rest of connectWebSocket is largely fine, ensure wsRef.current.onmessage = handleWebSocketMessage;)
    try {
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        console.log(
          "[useMapWebsocket] WebSocket connection already open or connecting.",
        );
        return;
      }

      if (wsRef.current) {
        console.log(
          "[useMapWebsocket] Cleaning up previous WebSocket connection.",
        );
        wsRef.current.close();
        wsRef.current = null;
      }

      console.log("[useMapWebsocket] Attempting to connect to WebSocket:", url);
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        try {
          console.log("[useMapWebsocket] WebSocket connected.");
          setIsConnected(true);
          setError(null);
          if (reconnectTimeoutRef.current) {
            // Clear reconnect timer on successful connection
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
          isFirstConnectionRef.current = false; // Successful connection, not the first attempt anymore for reconnect logic

          eventBroker.emit<BaseEvent>(EventTypes.WEBSOCKET_CONNECTED, {
            timestamp: Date.now(),
            source: "useMapWebSocket",
          });

          if (isAuthenticated && user?.id) {
            console.log(
              "[useMapWebsocket] Sending client identification for user:",
              user.id,
            );
            wsRef.current?.send(
              JSON.stringify({
                type: MessageTypes.CLIENT_IDENTIFICATION,
                userId: user.id,
              }),
            );
          } else {
            console.warn(
              "[useMapWebsocket] Unable to identify WebSocket: user not authenticated or no user ID.",
            );
          }

          // If there's a viewport, send it. The server expects this to get initial data.
          if (currentViewportRef.current) {
            console.log(
              "[useMapWebsocket] Sending initial viewport update on connect.",
            );
            sendViewportUpdateToServer();
          } else {
            // If no viewport, we might need to tell the server to send all events for this user's filters
            // This depends on server logic. For now, we assume viewport is primary.
            // Consider a "request_initial_data" message if viewport isn't always available.
            console.log(
              "[useMapWebsocket] No current viewport on connect. Initial data depends on server logic for unidentified viewport.",
            );
          }
        } catch (error) {
          console.error("[useMapWebsocket] Error in onopen handler:", error);
          setError(
            error instanceof Error
              ? error
              : new Error("Unknown error in onopen handler"),
          );
        }
      };

      wsRef.current.onmessage = handleWebSocketMessage;

      wsRef.current.onclose = (event) => {
        try {
          console.log(
            `[useMapWebsocket] WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`,
          );
          setIsConnected(false);
          // Don't nullify clientId here, it might be useful for re-identification if needed
          // setClientId(null);

          eventBroker.emit<BaseEvent>(EventTypes.WEBSOCKET_DISCONNECTED, {
            timestamp: Date.now(),
            source: "useMapWebSocket",
          });

          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }

          // Only attempt to reconnect if it wasn't a clean close or specific codes that shouldn't retry
          if (
            !event.wasClean ||
            (event.code !== 1000 &&
              event.code !== 1005) /* No Status Received */
          ) {
            const reconnectDelay = isFirstConnectionRef.current
              ? 1000
              : Math.min(
                  30000,
                  (reconnectTimeoutRef.current ? 5000 : 1000) * 1.5,
                ); // Simple backoff
            console.log(
              `[useMapWebsocket] Attempting to reconnect in ${reconnectDelay / 1000}s...`,
            );
            isFirstConnectionRef.current = false; // Next attempt won't be the "first"

            reconnectTimeoutRef.current = setTimeout(() => {
              console.log("[useMapWebsocket] Reconnecting now...");
              connectWebSocket(); // Try to reconnect
            }, reconnectDelay);
          } else {
            console.log(
              "[useMapWebsocket] WebSocket closed cleanly or should not reconnect. No further reconnect attempts.",
            );
          }
        } catch (error) {
          console.error("[useMapWebsocket] Error in onclose handler:", error);
        }
      };

      wsRef.current.onerror = (errorEvent) => {
        // Changed 'event' to 'errorEvent' for clarity
        try {
          console.error("[useMapWebsocket] WebSocket error:", errorEvent);
          // An error event will usually be followed by a close event.
          // Let the onclose handler manage reconnection.
          // setIsConnected(false); // onclose will handle this
          const errorObj = new Error(
            "WebSocket connection error. See console for details.",
          );
          setError(errorObj);
          eventBroker.emit<BaseEvent & { error: Error }>(
            EventTypes.ERROR_OCCURRED,
            {
              timestamp: Date.now(),
              source: "useMapWebSocket",
              error: errorObj,
            },
          );
        } catch (error) {
          console.error("[useMapWebsocket] Error in onerror handler:", error);
        }
      };
    } catch (err) {
      console.error(
        "[useMapWebsocket] Error creating WebSocket connection:",
        err,
      );
      const errorObj =
        err instanceof Error
          ? err
          : new Error("Unknown error creating WebSocket connection");
      setError(errorObj);
      eventBroker.emit<BaseEvent & { error: Error }>(
        EventTypes.ERROR_OCCURRED,
        {
          timestamp: Date.now(),
          source: "useMapWebSocket",
          error: errorObj,
        },
      );
    }
  }, [
    url,
    isAuthenticated,
    user,
    handleWebSocketMessage,
    sendViewportUpdateToServer,
  ]); // Added dependencies

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      // Connect or re-identify if auth state changes
      connectWebSocket();
    } else if (
      !isAuthenticated &&
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      // If user logs out, consider closing the WebSocket or sending a de-identification message
      console.log("[useMapWebsocket] User logged out, closing WebSocket.");
      wsRef.current.close(1000, "User logged out"); // Clean close
    }

    return () => {
      if (wsRef.current) {
        console.log(
          "[useMapWebsocket] Cleaning up WebSocket on component unmount.",
        );
        wsRef.current.onclose = null; // Prevent onclose handler from firing during unmount cleanup
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.onopen = null;
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connectWebSocket, isAuthenticated, user?.id]); // Re-run effect if auth state changes

  useEffect(() => {
    const handleForceViewportUpdate = () => {
      if (currentViewportRef.current) {
        const viewport = { ...currentViewportRef.current }; // Create new object instance
        updateViewport(viewport);
      } else {
        console.warn(
          "[useMapWebsocket] Force viewport update called, but no current viewport exists.",
        );
      }
    };

    const unsubscribe = eventBroker.on(
      EventTypes.FORCE_VIEWPORT_UPDATE,
      handleForceViewportUpdate,
    );
    return unsubscribe;
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
