import { useCallback, useRef } from "react";
import { eventBroker, EventTypes, BaseEvent } from "@/services/EventBroker";
import { MessageTypes } from "./constants";

interface UseWebSocketConnectionArgs {
  wsRef: React.MutableRefObject<WebSocket | null>;
  url: string;
  isAuthenticated: boolean;
  userId: string | undefined;
  handleWebSocketMessage: (event: MessageEvent) => void;
  sendViewportUpdateToServer: () => void;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<Error | null>>;
  currentViewportRef: React.RefObject<unknown>;
}

export function useWebSocketConnection({
  wsRef,
  url,
  isAuthenticated,
  userId,
  handleWebSocketMessage,
  sendViewportUpdateToServer,
  setIsConnected,
  setError,
  currentViewportRef,
}: UseWebSocketConnectionArgs) {
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isFirstConnectionRef = useRef<boolean>(true);

  const connectWebSocket = useCallback(() => {
    try {
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        if (__DEV__) {
          console.log(
            "[useMapWebsocket] WebSocket connection already open or connecting.",
          );
        }
        return;
      }

      if (wsRef.current) {
        if (__DEV__) {
          console.log(
            "[useMapWebsocket] Cleaning up previous WebSocket connection.",
          );
        }
        wsRef.current.close();
        wsRef.current = null;
      }

      if (__DEV__) {
        console.log(
          "[useMapWebsocket] Attempting to connect to WebSocket:",
          url,
        );
      }
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        try {
          if (__DEV__) {
            console.log("[useMapWebsocket] WebSocket connected.");
          }
          setIsConnected(true);
          setError(null);
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
          isFirstConnectionRef.current = false;

          eventBroker.emit<BaseEvent>(EventTypes.WEBSOCKET_CONNECTED, {
            timestamp: Date.now(),
            source: "useMapWebSocket",
          });

          if (isAuthenticated && userId) {
            if (__DEV__) {
              console.log(
                "[useMapWebsocket] Sending client identification for user:",
                userId,
              );
            }
            wsRef.current?.send(
              JSON.stringify({
                type: MessageTypes.CLIENT_IDENTIFICATION,
                userId: userId,
                clientType: "mobile",
              }),
            );
          } else {
            console.warn(
              "[useMapWebsocket] Unable to identify WebSocket: user not authenticated or no user ID.",
            );
          }

          if (currentViewportRef.current) {
            if (__DEV__) {
              console.log(
                "[useMapWebsocket] Sending initial viewport update on connect.",
              );
            }
            sendViewportUpdateToServer();
          } else if (__DEV__) {
            console.log("[useMapWebsocket] No current viewport on connect.");
          }
        } catch (error) {
          console.error("[useMapWebsocket] Error in onopen handler:", error);
          setError(
            error instanceof Error
              ? error
              : new Error("Unknown error in onopen handler"),
          );
        }
      };

      wsRef.current.onmessage = handleWebSocketMessage;

      wsRef.current.onclose = (event) => {
        try {
          if (__DEV__) {
            console.log(
              `[useMapWebsocket] WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`,
            );
          }
          setIsConnected(false);

          eventBroker.emit<BaseEvent>(EventTypes.WEBSOCKET_DISCONNECTED, {
            timestamp: Date.now(),
            source: "useMapWebSocket",
          });

          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }

          if (!event.wasClean || (event.code !== 1000 && event.code !== 1005)) {
            const reconnectDelay = isFirstConnectionRef.current
              ? 1000
              : Math.min(
                  30000,
                  (reconnectTimeoutRef.current ? 5000 : 1000) * 1.5,
                );
            if (__DEV__) {
              console.log(
                `[useMapWebsocket] Attempting to reconnect in ${reconnectDelay / 1000}s...`,
              );
            }
            isFirstConnectionRef.current = false;

            reconnectTimeoutRef.current = setTimeout(() => {
              if (__DEV__) {
                console.log("[useMapWebsocket] Reconnecting now...");
              }
              connectWebSocket();
            }, reconnectDelay);
          } else if (__DEV__) {
            console.log(
              "[useMapWebsocket] WebSocket closed cleanly. No further reconnect attempts.",
            );
          }
        } catch (error) {
          console.error("[useMapWebsocket] Error in onclose handler:", error);
        }
      };

      wsRef.current.onerror = (errorEvent) => {
        try {
          console.error("[useMapWebsocket] WebSocket error:", errorEvent);
          const errorObj = new Error(
            "WebSocket connection error. See console for details.",
          );
          setError(errorObj);
          eventBroker.emit<BaseEvent & { error: Error }>(
            EventTypes.ERROR_OCCURRED,
            {
              timestamp: Date.now(),
              source: "useMapWebSocket",
              error: errorObj,
            },
          );
        } catch (error) {
          console.error("[useMapWebsocket] Error in onerror handler:", error);
        }
      };
    } catch (err) {
      console.error(
        "[useMapWebsocket] Error creating WebSocket connection:",
        err,
      );
      const errorObj =
        err instanceof Error
          ? err
          : new Error("Unknown error creating WebSocket connection");
      setError(errorObj);
      eventBroker.emit<BaseEvent & { error: Error }>(
        EventTypes.ERROR_OCCURRED,
        {
          timestamp: Date.now(),
          source: "useMapWebSocket",
          error: errorObj,
        },
      );
    }
  }, [
    url,
    isAuthenticated,
    userId,
    handleWebSocketMessage,
    sendViewportUpdateToServer,
    setIsConnected,
    setError,
    currentViewportRef,
  ]);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      if (__DEV__) {
        console.log(
          "[useMapWebsocket] Cleaning up WebSocket on component unmount.",
        );
      }
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      wsRef.current.close(1000, "Component unmounting");
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  return { connectWebSocket, cleanup };
}
