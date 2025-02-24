import { useState, useEffect, useCallback } from "react";

interface Marker {
  id: string;
  coordinates: [number, number];
  data: {
    emoji: string;
    color: string;
    created_at: string;
    updated_at: string;
  };
}

interface ViewPort {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function useMapWebSocket(wsUrl: string) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);

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
          setMarkers((prevMarkers) =>
            prevMarkers.filter((marker) => marker.id !== message.data.id)
          );
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
          setMarkers((prevMarkers) => {
            const newMarkers = [...prevMarkers];
            message.data.forEach((update: any) => {
              const index = newMarkers.findIndex((m) => m.id === update.id);
              const updatedMarker: any = {
                id: update.id,
                coordinates: [update.minX, update.minY],
                data: update.data,
              };

              if (index !== -1) {
                newMarkers[index] = updatedMarker;
              } else {
                newMarkers.push(updatedMarker);
              }
            });
            return newMarkers;
          });
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
  }, [wsUrl]);

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

  return {
    markers,
    clientId,
    updateViewport,
  };
}
