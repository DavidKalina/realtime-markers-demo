// hooks/useMapWebSocket/useMapWebSocket.ts - Main orchestrator
import { useAuth } from "@/contexts/AuthContext";
import { eventBroker, EventTypes, ViewportEvent } from "@/services/EventBroker";
import { useLocationStore } from "@/stores/useLocationStore";
import { MapboxViewport } from "@/types/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageTypes } from "./constants";
import type { MapWebSocketResult } from "./types";
import { useMessageHandler } from "./useMessageHandler";
import { useWebSocketConnection } from "./useWebSocketConnection";

export const useMapWebSocket = (url: string): MapWebSocketResult => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  const { user, isAuthenticated } = useAuth();

  // Stable WebSocket ref shared between viewport sync and connection hooks
  const wsRef = useRef<WebSocket | null>(null);

  // --- Viewport sync (inlined from useViewportSync) ---
  const [currentViewport, setCurrentViewport] = useState<MapboxViewport | null>(
    null,
  );
  const currentViewportRef = useRef<MapboxViewport | null>(null);

  useEffect(() => {
    currentViewportRef.current = currentViewport;
  }, [currentViewport]);

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
  }, []);

  const updateViewport = useCallback(
    (viewport: MapboxViewport) => {
      setCurrentViewport(viewport);
      currentViewportRef.current = viewport;

      // Read markers from store instead of a local ref
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

  // Message handler
  const { handleWebSocketMessage } = useMessageHandler({
    setClientId,
    currentViewportRef,
  });

  // WebSocket connection (shares wsRef with viewport sync)
  const { connectWebSocket, cleanup } = useWebSocketConnection({
    wsRef,
    url,
    isAuthenticated,
    userId: user?.id,
    handleWebSocketMessage,
    sendViewportUpdateToServer,
    setIsConnected,
    setError,
    currentViewportRef,
  });

  // Connect/disconnect based on auth state
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      connectWebSocket();
    } else if (
      !isAuthenticated &&
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      if (__DEV__) {
        console.log("[useMapWebsocket] User logged out, closing WebSocket.");
      }
      wsRef.current.close(1000, "User logged out");
    }

    return cleanup;
  }, [connectWebSocket, isAuthenticated, user?.id, cleanup]);

  // Force viewport update listener
  useEffect(() => {
    const handleForceViewportUpdate = () => {
      // Tell the WebSocket server to re-fetch filters for this user.
      // This must happen BEFORE the viewport update so that the filter
      // processor receives the cleared/updated filters before it
      // re-processes the user's viewport, avoiding a race where stale
      // filters produce a REPLACE_ALL with the old filtered set.
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: MessageTypes.REFRESH_FILTERS }),
        );
      }

      if (currentViewportRef.current) {
        // Re-send the current viewport so the filter processor
        // re-evaluates with the updated filters.
        sendViewportUpdateToServer();
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
  }, [sendViewportUpdateToServer, currentViewportRef, wsRef]);

  return {
    isConnected,
    error,
    currentViewport,
    updateViewport,
    clientId,
  };
};
