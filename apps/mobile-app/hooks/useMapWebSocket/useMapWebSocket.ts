// hooks/useMapWebSocket/useMapWebSocket.ts - Main orchestrator
import { useEffect, useState, useCallback, useRef } from "react";
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
import { MessageTypes } from "./constants";

export const useMapWebSocket = (url: string): MapWebSocketResult => {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  const { user, isAuthenticated } = useAuth();
  const setStoreMarkers = useLocationStore.getState().setMarkers;

  // Stable WebSocket ref shared between viewport sync and connection hooks
  const wsRef = useRef<WebSocket | null>(null);

  // Viewport sync
  const {
    currentViewport,
    currentViewportRef,
    markersRef,
    updateMarkersRef,
    updateViewport,
    sendViewportUpdateToServer,
  } = useViewportSync(wsRef);

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
        goingCount: event.goingCount ?? 0,
        saveCount: event.saveCount ?? 0,
        isTrending: event.isTrending ?? false,
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
  }, [connectWebSocket, isAuthenticated, user?.id, cleanup]);

  // Force viewport update listener
  useEffect(() => {
    const handleForceViewportUpdate = () => {
      if (currentViewportRef.current) {
        const viewport = { ...currentViewportRef.current };
        updateViewport(viewport);
      } else {
        console.warn(
          "[useMapWebsocket] Force viewport update called, but no current viewport exists.",
        );
      }

      // Tell the WebSocket server to re-fetch filters for this user
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: MessageTypes.REFRESH_FILTERS }),
        );
      }
    };

    const unsubscribe = eventBroker.on(
      EventTypes.FORCE_VIEWPORT_UPDATE,
      handleForceViewportUpdate,
    );
    return unsubscribe;
  }, [updateViewport, currentViewportRef, wsRef]);

  return {
    markers,
    isConnected,
    error,
    currentViewport,
    updateViewport,
    clientId,
  };
};
