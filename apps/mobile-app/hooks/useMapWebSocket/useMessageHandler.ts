import { useCallback } from "react";
import {
  eventBroker,
  EventTypes,
  ViewportEvent,
  MarkersEvent,
  BaseEvent,
} from "@/services/EventBroker";
import { Marker, MapboxViewport } from "@/types/types";
import { useLocationStore } from "@/stores/useLocationStore";
import { convertEventToMarker } from "@/utils/convertEventToMarker";
import { MessageTypes } from "./constants";

interface UseViewportMessageHandlerArgs {
  setClientId: React.Dispatch<React.SetStateAction<string | null>>;
  currentViewportRef: React.RefObject<MapboxViewport | null>;
}

export function useViewportMessageHandler({
  setClientId,
  currentViewportRef,
}: UseViewportMessageHandlerArgs) {
  const handleViewportMessage = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data: any) => {
      try {
        if (!data || typeof data !== "object" || !data.type) {
          return;
        }

        if (__DEV__) {
          console.log(
            "[useMapWebsocket] Processing viewport message:",
            data.type,
          );
        }

        const store = useLocationStore.getState();

        switch (data.type) {
          case MessageTypes.CONNECTION_ESTABLISHED:
            if (data.clientId) {
              setClientId(data.clientId);
            }
            break;

          case MessageTypes.REPLACE_ALL:
            if (__DEV__) {
              console.log("[useMapWebsocket] Received REPLACE_ALL:", data);
            }
            if (!Array.isArray(data.events)) {
              console.warn(
                "[useMapWebsocket] Invalid events array in REPLACE_ALL",
                data,
              );
              store.setMarkers([]);
              return;
            }
            try {
              const rawMarkers = data.events.map(convertEventToMarker);
              const seen = new Set<string>();
              const incomingMarkers = rawMarkers.filter((m: Marker) => {
                if (seen.has(m.id)) return false;
                seen.add(m.id);
                return true;
              });
              if (__DEV__) {
                console.log(
                  "[useMapWebsocket] REPLACE_ALL - Total markers:",
                  incomingMarkers.length,
                );
              }

              // Smart diff: preserve object references for unchanged markers
              const prevMarkers = store.markers;
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
                  result.push(existing);
                } else {
                  result.push(incoming);
                }
              }

              if (
                result.length === prevMarkers.length &&
                result.every((m, i) => m === prevMarkers[i])
              ) {
                if (currentViewportRef.current) {
                  eventBroker.emit<ViewportEvent & { searching: boolean }>(
                    EventTypes.VIEWPORT_CHANGED,
                    {
                      timestamp: Date.now(),
                      source: "useMapWebSocket",
                      viewport: currentViewportRef.current,
                      markers: prevMarkers,
                      searching: false,
                    },
                  );
                }
                return;
              }

              store.setMarkers(result);

              eventBroker.emit<MarkersEvent>(EventTypes.MARKERS_UPDATED, {
                timestamp: Date.now(),
                source: "useMapWebSocket",
                markers: result,
                count: result.length,
              });

              if (currentViewportRef.current) {
                eventBroker.emit<ViewportEvent & { searching: boolean }>(
                  EventTypes.VIEWPORT_CHANGED,
                  {
                    timestamp: Date.now(),
                    source: "useMapWebSocket",
                    viewport: currentViewportRef.current,
                    markers: result,
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
              store.setMarkers([]);
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
              if (!store.markers.some((m) => m.id === newMarker.id)) {
                store.updateMarkers([newMarker]);
                eventBroker.emit<MarkersEvent>(EventTypes.MARKER_ADDED, {
                  timestamp: Date.now(),
                  source: "useMapWebSocket",
                  markers: [newMarker],
                  count: 1,
                });
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
              const existingIndex = store.markers.findIndex(
                (m) => m.id === updatedMarker.id,
              );

              store.updateMarkers([updatedMarker]);

              if (existingIndex !== -1) {
                eventBroker.emit<MarkersEvent>(EventTypes.MARKERS_UPDATED, {
                  timestamp: Date.now(),
                  source: "useMapWebSocket",
                  markers: [updatedMarker],
                  count: 1,
                });
              } else {
                eventBroker.emit<MarkersEvent>(EventTypes.MARKER_ADDED, {
                  timestamp: Date.now(),
                  source: "useMapWebSocket",
                  markers: [updatedMarker],
                  count: 1,
                });
              }
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
              const markerExisted = store.markers.some(
                (m) => m.id === deletedId,
              );

              if (markerExisted) {
                const currentSelected = store.selectedItem;
                if (
                  currentSelected?.type === "marker" &&
                  deletedId === currentSelected.id
                ) {
                  eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
                    timestamp: Date.now(),
                    source: "useMapWebSocket",
                  });
                }

                store.deleteMarker(deletedId);

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
            } catch (e) {
              console.error(
                "[useMapWebsocket] Error processing DELETE_EVENT:",
                e,
              );
            }
            break;
          }

          case MessageTypes.SESSION_UPDATE: {
            if (__DEV__) {
              console.debug("[useMapWebsocket] Received SESSION_UPDATE:", data);
            }
            break;
          }

          default: {
            if (__DEV__) {
              console.debug(
                "[useMapWebsocket] Unhandled viewport message type:",
                data.type,
              );
            }
            break;
          }
        }
      } catch (err) {
        console.error(
          "[useMapWebsocket] Error processing viewport message:",
          err,
        );
      }
    },
    [setClientId, currentViewportRef],
  );

  return { handleViewportMessage };
}
