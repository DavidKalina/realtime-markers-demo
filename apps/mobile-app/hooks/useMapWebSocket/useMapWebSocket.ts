// hooks/useMapWebSocket/useMapWebSocket.ts - Main orchestrator
import { useEffect, useState, useCallback } from "react";
import {
  eventBroker,
  EventTypes,
  MarkersEvent,
  BaseEvent,
} from "@/services/EventBroker";
import { useLocationStore } from "@/stores/useLocationStore";
import { useAuth } from "@/contexts/AuthContext";
import { Marker } from "@/types/types";
import type { MapWebSocketResult } from "./types";
import { useViewportSync } from "./useViewportSync";
import { useMessageHandler } from "./useMessageHandler";
import { useWebSocketConnection } from "./useWebSocketConnection";

export const useMapWebSocket = (url: string): MapWebSocketResult => {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  const { user, isAuthenticated } = useAuth();
  const setStoreMarkers = useLocationStore.getState().setMarkers;

  // Viewport sync
  const {
    currentViewport,
    currentViewportRef,
    markersRef,
    updateMarkersRef,
    sendViewportUpdateToServer,
  } = useViewportSync({ current: null } as React.RefObject<WebSocket | null>);

  // Keep markersRef in sync
  useEffect(() => {
    updateMarkersRef(markers);
  }, [markers, updateMarkersRef]);

  // Sync to store
  useEffect(() => {
    setStoreMarkers(markers);
  }, [markers, setStoreMarkers]);

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
        categories: event.categories?.map((c: any) => c.name || c),
        isVerified: event.isVerified,
        created_at: event.createdAt,
        updated_at: event.updatedAt,
        isPrivate: event.isPrivate,
        status: event.status,
        isRecurring: event.isRecurring ?? false,
        recurrenceFrequency: event.recurrenceFrequency,
        recurrenceDays: event.recurrenceDays,
        recurrenceStartDate: event.recurrenceStartDate,
        recurrenceEndDate: event.recurrenceEndDate,
        recurrenceInterval: event.recurrenceInterval,
        recurrenceTime: event.recurrenceTime,
        recurrenceExceptions: event.recurrenceExceptions,
        ...(event.metadata || {}),
      },
    };
  }, []);

  // Emit marker updates
  const emitMarkersUpdated = useCallback(
    (
      updatedMarkers: Marker[],
      actionType: "replace" | "add" | "update" | "delete",
    ) => {
      const selectedItem = useLocationStore.getState().selectedItem;
      const selectMapItem = useLocationStore.getState().selectMapItem;

      const selectedId =
        selectedItem?.type === "marker" ? selectedItem.id : null;
      if (selectedId) {
        const selectedMarkerExists = updatedMarkers.some(
          (marker) => marker.id === selectedId,
        );
        if (
          !selectedMarkerExists ||
          (actionType === "delete" &&
            updatedMarkers.find((m) => m.id === selectedId) === undefined)
        ) {
          selectMapItem(null);
          eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
            timestamp: Date.now(),
            source: "useMapWebSocket",
          });
        }
      }

      eventBroker.emit<MarkersEvent>(EventTypes.MARKERS_UPDATED, {
        timestamp: Date.now(),
        source: "useMapWebSocket",
        markers: updatedMarkers,
        count: updatedMarkers.length,
      });
    },
    [],
  );

  // Message handler
  const { handleWebSocketMessage } = useMessageHandler({
    setMarkers,
    setClientId,
    currentViewportRef,
    emitMarkersUpdated,
    convertEventToMarker,
  });

  // WebSocket connection
  const { wsRef, connectWebSocket, cleanup } = useWebSocketConnection({
    url,
    isAuthenticated,
    userId: user?.id,
    handleWebSocketMessage,
    sendViewportUpdateToServer,
    setIsConnected,
    setError,
    currentViewportRef,
  });

  // Re-assign wsRef for viewport sync (since it was created with a placeholder)
  // Viewport sync needs to send messages through the WebSocket
  const sendViewportUpdateToServerWithWs = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN &&
      currentViewportRef.current
    ) {
      const message = {
        type: "viewport-update",
        viewport: currentViewportRef.current,
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, [wsRef, currentViewportRef]);

  // Override updateViewport to use actual wsRef
  const updateViewportWithWs = useCallback(
    (viewport: import("@/types/types").MapboxViewport) => {
      currentViewportRef.current = viewport;

      eventBroker.emit(EventTypes.VIEWPORT_CHANGED, {
        timestamp: Date.now(),
        source: "useMapWebSocket",
        viewport: viewport,
        markers: markersRef.current,
        searching: true,
      });

      sendViewportUpdateToServerWithWs();
    },
    [sendViewportUpdateToServerWithWs, currentViewportRef, markersRef],
  );

  // Emit markers updated when markers state changes
  useEffect(() => {
    emitMarkersUpdated(markers, "replace");
  }, [markers, emitMarkersUpdated]);

  // Connect/disconnect based on auth state
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      connectWebSocket();
    } else if (
      !isAuthenticated &&
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      console.log("[useMapWebsocket] User logged out, closing WebSocket.");
      wsRef.current.close(1000, "User logged out");
    }

    return cleanup;
  }, [connectWebSocket, isAuthenticated, user?.id, cleanup, wsRef]);

  // Force viewport update listener
  useEffect(() => {
    const handleForceViewportUpdate = () => {
      if (currentViewportRef.current) {
        const viewport = { ...currentViewportRef.current };
        updateViewportWithWs(viewport);
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
  }, [updateViewportWithWs, currentViewportRef]);

  return {
    markers,
    isConnected,
    error,
    currentViewport,
    updateViewport: updateViewportWithWs,
    clientId,
  };
};
