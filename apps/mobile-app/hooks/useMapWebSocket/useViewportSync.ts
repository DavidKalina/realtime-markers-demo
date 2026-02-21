import { useCallback, useRef, useEffect, useState } from "react";
import { eventBroker, EventTypes, ViewportEvent } from "@/services/EventBroker";
import { Marker, MapboxViewport } from "@/types/types";
import { MessageTypes } from "./constants";

export function useViewportSync(wsRef: React.RefObject<WebSocket | null>) {
  const [currentViewport, setCurrentViewport] = useState<MapboxViewport | null>(
    null,
  );
  const currentViewportRef = useRef<MapboxViewport | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    currentViewportRef.current = currentViewport;
  }, [currentViewport]);

  const updateMarkersRef = useCallback((markers: Marker[]) => {
    markersRef.current = markers;
  }, []);

  const sendViewportUpdateToServer = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN &&
      currentViewportRef.current
    ) {
      const message = {
        type: MessageTypes.VIEWPORT_UPDATE,
        viewport: currentViewportRef.current,
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, [wsRef]);

  const updateViewport = useCallback(
    (viewport: MapboxViewport) => {
      setCurrentViewport(viewport);
      currentViewportRef.current = viewport;

      eventBroker.emit<ViewportEvent & { searching: boolean }>(
        EventTypes.VIEWPORT_CHANGED,
        {
          timestamp: Date.now(),
          source: "useMapWebSocket",
          viewport: viewport,
          markers: markersRef.current,
          searching: true,
        },
      );

      sendViewportUpdateToServer();
    },
    [sendViewportUpdateToServer],
  );

  return {
    currentViewport,
    currentViewportRef,
    markersRef,
    updateMarkersRef,
    updateViewport,
    sendViewportUpdateToServer,
  };
}
