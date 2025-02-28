import { useMarkerStore } from "@/stores/markerStore";
import { useState, useEffect, useCallback, useRef } from "react";

interface ViewPort {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function useMapWebSocket(wsUrl: string) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // Using ReturnType<typeof setTimeout> instead of NodeJS.Timeout for better compatibility
  const heartbeatInterval = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPongTime = useRef<number>(Date.now());

  const { setMarkers, updateMarkers, deleteMarker } = useMarkerStore();

  // Function to establish WebSocket connection
  const connectWebSocket = useCallback(() => {
    // Clear any existing reconnect timeouts
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    console.log("Establishing WebSocket connection to:", wsUrl);

    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log("WebSocket connection established");
      setIsConnected(true);
      lastPongTime.current = Date.now();
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

        case "pong":
          // Update the last time we received a pong
          lastPongTime.current = Date.now();
          break;
      }
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    };

    websocket.onclose = (event) => {
      console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
      setIsConnected(false);
      setWs(null);

      // Schedule reconnection after a delay
      reconnectTimeout.current = setTimeout(() => {
        console.log("Attempting to reconnect WebSocket...");
        connectWebSocket();
      }, 3000); // 3 second reconnect delay
    };

    setWs(websocket);
    return websocket;
  }, [wsUrl, setMarkers, updateMarkers, deleteMarker]);

  // Initialize WebSocket connection
  useEffect(() => {
    const websocket = connectWebSocket();

    // Cleanup function
    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }

      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }

      if (
        websocket.readyState === WebSocket.OPEN ||
        websocket.readyState === WebSocket.CONNECTING
      ) {
        websocket.close();
      }
    };
  }, [connectWebSocket]);

  // Setup heartbeat mechanism
  useEffect(() => {
    if (!ws) return;

    // Send ping every 30 seconds
    heartbeatInterval.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send a ping message
        ws.send(JSON.stringify({ type: "ping" }));

        // Check if we've received a pong within the last 45 seconds
        const now = Date.now();
        if (now - lastPongTime.current > 45000) {
          console.log("No pong received for 45 seconds, reconnecting...");

          // Close the current connection
          ws.close();

          // connectWebSocket will be called by the onclose handler
        }
      }
    }, 30000); // 30 second interval

    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, [ws, connectWebSocket]);

  // Function to update viewport
  const updateViewport = useCallback(
    (viewport: ViewPort) => {
      console.log("VIEWPORT_", viewport);
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
    isConnected,
  };
}
