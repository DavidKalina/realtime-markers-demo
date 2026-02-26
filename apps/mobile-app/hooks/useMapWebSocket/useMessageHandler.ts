import { useCallback } from "react";
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
import { Marker, MapboxViewport } from "@/types/types";
import { useLocationStore } from "@/stores/useLocationStore";
import { MessageTypes } from "./constants";

interface UseMessageHandlerArgs {
  setMarkers: React.Dispatch<React.SetStateAction<Marker[]>>;
  setClientId: React.Dispatch<React.SetStateAction<string | null>>;
  currentViewportRef: React.RefObject<MapboxViewport | null>;
  emitMarkersUpdated: (
    updatedMarkers: Marker[],
    actionType: "replace" | "add" | "update" | "delete",
  ) => void;
  convertEventToMarker: (event: unknown) => Marker;
}

export function useMessageHandler({
  setMarkers,
  setClientId,
  currentViewportRef,
  emitMarkersUpdated,
  convertEventToMarker,
}: UseMessageHandlerArgs) {
  const selectedItemFromStoreRef = {
    get current() {
      return useLocationStore.getState().selectedItem;
    },
  };
  const selectMapItemFromStoreRef = {
    get current() {
      return useLocationStore.getState().selectMapItem;
    },
  };

  const handleWebSocketMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log(
          "[useMapWebsocket] Received WebSocket message:",
          data.type,
          data,
        );

        if (!data || typeof data !== "object" || !data.type) {
          console.warn(
            "[useMapWebsocket] Received invalid or typeless message data:",
            data,
          );
          return;
        }

        console.log("[useMapWebsocket] Processing message type:", data.type);

        switch (data.type) {
          case MessageTypes.CONNECTION_ESTABLISHED:
            if (data.clientId) {
              setClientId(data.clientId);
            }
            break;

          case MessageTypes.REPLACE_ALL:
            console.log("[useMapWebsocket] Received REPLACE_ALL:", data);
            if (!Array.isArray(data.events)) {
              console.warn(
                "[useMapWebsocket] Invalid events array in REPLACE_ALL",
                data,
              );
              setMarkers([]);
              emitMarkersUpdated([], "replace");
              return;
            }
            try {
              const rawMarkers = data.events.map(convertEventToMarker);
              // Deduplicate by marker ID — server may send duplicates in viewport updates
              const seen = new Set<string>();
              const incomingMarkers = rawMarkers.filter((m: Marker) => {
                if (seen.has(m.id)) return false;
                seen.add(m.id);
                return true;
              });
              console.log(
                "[useMapWebsocket] REPLACE_ALL - Total markers:",
                incomingMarkers.length,
              );

              // Smart diff: preserve object references for unchanged markers
              // so React doesn't unmount/remount them (avoiding re-animation jank)
              setMarkers((prevMarkers) => {
                const prevMap = new Map(prevMarkers.map((m) => [m.id, m]));
                const result: Marker[] = [];
                for (const incoming of incomingMarkers) {
                  const existing = prevMap.get(incoming.id);
                  if (
                    existing &&
                    existing.coordinates[0] === incoming.coordinates[0] &&
                    existing.coordinates[1] === incoming.coordinates[1] &&
                    existing.data.emoji === incoming.data.emoji &&
                    existing.data.title === incoming.data.title
                  ) {
                    // Marker unchanged — keep original reference
                    result.push(existing);
                  } else {
                    result.push(incoming);
                  }
                }

                // If nothing changed, return previous array to skip re-render
                if (
                  result.length === prevMarkers.length &&
                  result.every((m, i) => m === prevMarkers[i])
                ) {
                  return prevMarkers;
                }

                return result;
              });

              emitMarkersUpdated(incomingMarkers, "replace");

              if (currentViewportRef.current) {
                eventBroker.emit<ViewportEvent & { searching: boolean }>(
                  EventTypes.VIEWPORT_CHANGED,
                  {
                    timestamp: Date.now(),
                    source: "useMapWebSocket",
                    viewport: currentViewportRef.current,
                    markers: incomingMarkers,
                    searching: false,
                  },
                );
              }
            } catch (e) {
              console.error(
                "[useMapWebsocket] Error processing REPLACE_ALL:",
                e,
                data,
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
              setMarkers((prevMarkers) => {
                if (!prevMarkers.some((m) => m.id === newMarker.id)) {
                  eventBroker.emit<MarkersEvent>(EventTypes.MARKER_ADDED, {
                    timestamp: Date.now(),
                    source: "useMapWebSocket",
                    markers: [newMarker],
                    count: 1,
                  });
                  return [...prevMarkers, newMarker];
                }
                return prevMarkers;
              });
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

              setMarkers((prevMarkers) => {
                const existingMarkerIndex = prevMarkers.findIndex(
                  (marker) => marker.id === updatedMarker.id,
                );

                if (existingMarkerIndex !== -1) {
                  const newMarkers = [...prevMarkers];
                  newMarkers[existingMarkerIndex] = updatedMarker;
                  eventBroker.emit<MarkersEvent>(EventTypes.MARKERS_UPDATED, {
                    timestamp: Date.now(),
                    source: "useMapWebSocket",
                    markers: [updatedMarker],
                    count: 1,
                  });
                  return newMarkers;
                } else {
                  eventBroker.emit<MarkersEvent>(EventTypes.MARKER_ADDED, {
                    timestamp: Date.now(),
                    source: "useMapWebSocket",
                    markers: [updatedMarker],
                    count: 1,
                  });
                  return [...prevMarkers, updatedMarker];
                }
              });
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
              setMarkers((prevMarkers) => {
                const newMarkers = prevMarkers.filter(
                  (marker) => marker.id !== deletedId,
                );
                if (newMarkers.length < prevMarkers.length) {
                  const currentSelected = selectedItemFromStoreRef.current;
                  if (
                    currentSelected?.type === "marker" &&
                    deletedId === currentSelected.id
                  ) {
                    selectMapItemFromStoreRef.current(null);
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
                    ],
                    count: 1,
                  });
                }
                return newMarkers;
              });
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
                event: data.event,
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
            if (!data.title || !data.message) {
              console.warn("[useMapWebsocket] Missing notification content");
              return;
            }
            try {
              eventBroker.emit<NotificationEvent>(EventTypes.NOTIFICATION, {
                timestamp: data.timestamp || Date.now(),
                source: data.source || "useMapWebSocket",
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
                timestamp:
                  typeof data.data.timestamp === "number"
                    ? data.data.timestamp
                    : Date.now(),
                source: "useMapWebSocket",
                data: data.data,
              });
            } catch (e) {
              console.error(
                `[useMapWebsocket] Error processing ${data.type}:`,
                e,
              );
            }
            break;
          }

          case MessageTypes.SESSION_UPDATE: {
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
    [
      convertEventToMarker,
      setMarkers,
      setClientId,
      emitMarkersUpdated,
      currentViewportRef,
    ],
  );

  return { handleWebSocketMessage };
}
