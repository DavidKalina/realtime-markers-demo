import { useMarkerStore } from "@/stores/markerStore";
import { useState, useEffect, useCallback } from "react";

interface ViewPort {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function useMapWebSocket(wsUrl: string) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  const { setMarkers, updateMarkers, deleteMarker } = useMarkerStore();

  // Initialize WebSocket connection
  useEffect(() => {
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log("WebSocket connection established");
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "connection_established":
          setClientId(message.clientId);
          break;

        case "marker_delete":
          deleteMarker(message.data.id);
          break;

        case "initial_markers":
          setMarkers(
            message.data.map((marker: any) => ({
              id: marker.id,
              coordinates: [marker.minX, marker.minY],
              data: marker.data,
            }))
          );
          break;

        case "marker_updates_batch":
          const updates = message.data.map((update: any) => ({
            id: update.id,
            coordinates: [update.minX, update.minY],
            data: update.data,
          }));
          updateMarkers(updates);
          break;
      }
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    websocket.onclose = () => {
      console.log("WebSocket connection closed");
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [wsUrl, setMarkers, updateMarkers, deleteMarker]);

  // Function to update viewport
  const updateViewport = useCallback(
    (viewport: ViewPort) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "viewport_update",
            viewport,
          })
        );
      }
    },
    [ws]
  );

  const markers = useMarkerStore((state) => state.markers);

  return {
    markers,
    clientId,
    updateViewport,
  };
}
