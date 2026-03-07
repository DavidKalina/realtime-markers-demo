// hooks/useMapWebSocket/useMapWebSocket.ts - Main orchestrator
import {
  eventBroker,
  EventTypes,
  ViewportEvent,
  BaseEvent,
} from "@/services/EventBroker";
import { webSocketService } from "@/services/WebSocketService";
import { useLocationStore } from "@/stores/useLocationStore";
import { MapboxViewport } from "@/types/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageTypes } from "./constants";
import type { MapWebSocketResult } from "./types";
import { useViewportMessageHandler } from "./useMessageHandler";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const useMapWebSocket = (url: string): MapWebSocketResult => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [clientId, setClientId] = useState<string | null>(null);

  // --- Viewport sync ---
  const [currentViewport, setCurrentViewport] = useState<MapboxViewport | null>(
    null,
  );
  const currentViewportRef = useRef<MapboxViewport | null>(null);

  useEffect(() => {
    currentViewportRef.current = currentViewport;
  }, [currentViewport]);

  const sendViewportUpdateToServer = useCallback(() => {
    if (webSocketService.isConnected() && currentViewportRef.current) {
      const message = {
        type: MessageTypes.VIEWPORT_UPDATE,
        viewport: currentViewportRef.current,
        zoom: useLocationStore.getState().zoomLevel,
      };
      webSocketService.send(JSON.stringify(message));
    }
  }, []);

  const updateViewport = useCallback(
    (viewport: MapboxViewport) => {
      setCurrentViewport(viewport);
      currentViewportRef.current = viewport;

      const markers = useLocationStore.getState().markers;

      eventBroker.emit<ViewportEvent & { searching: boolean }>(
        EventTypes.VIEWPORT_CHANGED,
        {
          timestamp: Date.now(),
          source: "useMapWebSocket",
          viewport: viewport,
          markers: markers,
          searching: true,
        },
      );

      sendViewportUpdateToServer();
    },
    [sendViewportUpdateToServer],
  );

  // Handle viewport messages from WebSocketService
  const { handleViewportMessage } = useViewportMessageHandler({
    setClientId,
    currentViewportRef,
  });

  // Subscribe to viewport messages forwarded by WebSocketService
  useEffect(() => {
    const unsubscribe = eventBroker.on<BaseEvent & { data: unknown }>(
      EventTypes.WS_VIEWPORT_MESSAGE,
      (event) => {
        handleViewportMessage(event.data);
      },
    );
    return unsubscribe;
  }, [handleViewportMessage]);

  // Track connection state from WebSocketService
  useEffect(() => {
    const unsubConnect = eventBroker.on(EventTypes.WEBSOCKET_CONNECTED, () => {
      setIsConnected(true);
      // Send viewport on reconnect
      if (currentViewportRef.current) {
        setTimeout(() => sendViewportUpdateToServer(), 100);
      }
    });
    const unsubDisconnect = eventBroker.on(
      EventTypes.WEBSOCKET_DISCONNECTED,
      () => {
        setIsConnected(false);
      },
    );

    // Set initial state
    setIsConnected(webSocketService.isConnected());

    return () => {
      unsubConnect();
      unsubDisconnect();
    };
  }, [sendViewportUpdateToServer]);

  // Force viewport update listener
  useEffect(() => {
    const handleForceViewportUpdate = () => {
      if (webSocketService.isConnected()) {
        webSocketService.send(
          JSON.stringify({ type: MessageTypes.REFRESH_FILTERS }),
        );
      }

      if (currentViewportRef.current) {
        sendViewportUpdateToServer();
      }
    };

    const unsubscribe = eventBroker.on(
      EventTypes.FORCE_VIEWPORT_UPDATE,
      handleForceViewportUpdate,
    );
    return unsubscribe;
  }, [sendViewportUpdateToServer]);

  return {
    isConnected,
    error: null,
    currentViewport,
    updateViewport,
    clientId,
  };
};
