import { AppState, AppStateStatus } from "react-native";
import {
  eventBroker,
  EventTypes,
  BaseEvent,
  DiscoveryEvent,
  LevelUpdateEvent,
  XPAwardedEvent,
  NotificationEvent,
} from "@/services/EventBroker";
import { MessageTypes } from "@/hooks/useMapWebSocket/constants";

const LOG_TAG = "[WebSocketService]";

class WebSocketService {
  private static instance: WebSocketService;

  private ws: WebSocket | null = null;
  private url: string | null = null;
  private userId: string | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private intentionalClose = false;
  private appStateSubscription: ReturnType<
    typeof AppState.addEventListener
  > | null = null;

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  connect(url: string, userId: string): void {
    // Already connected to same endpoint
    if (
      this.ws &&
      this.url === url &&
      this.userId === userId &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.url = url;
    this.userId = userId;
    this.intentionalClose = false;
    this.reconnectAttempts = 0;

    this.setupAppStateListener();
    this.connectInternal();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimeout();
    this.removeAppStateListener();

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      this.ws.close(1000, "User logged out");
      this.ws = null;
    }

    this.url = null;
    this.userId = null;

    eventBroker.emit<BaseEvent>(EventTypes.WEBSOCKET_DISCONNECTED, {
      timestamp: Date.now(),
      source: LOG_TAG,
    });
  }

  send(message: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getWebSocket(): WebSocket | null {
    return this.ws;
  }

  private connectInternal(): void {
    if (!this.url || !this.userId) return;

    // Clean up existing connection
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      this.ws.close();
      this.ws = null;
    }

    if (__DEV__) {
      console.log(`${LOG_TAG} Connecting to ${this.url}`);
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      if (__DEV__) {
        console.log(`${LOG_TAG} Connected`);
      }
      this.reconnectAttempts = 0;
      this.clearReconnectTimeout();

      eventBroker.emit<BaseEvent>(EventTypes.WEBSOCKET_CONNECTED, {
        timestamp: Date.now(),
        source: LOG_TAG,
      });

      // Send client identification
      this.ws?.send(
        JSON.stringify({
          type: MessageTypes.CLIENT_IDENTIFICATION,
          userId: this.userId,
          clientType: "mobile",
        }),
      );
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event);
    };

    this.ws.onclose = (event) => {
      if (__DEV__) {
        console.log(
          `${LOG_TAG} Disconnected. Code: ${event.code}, Clean: ${event.wasClean}`,
        );
      }

      eventBroker.emit<BaseEvent>(EventTypes.WEBSOCKET_DISCONNECTED, {
        timestamp: Date.now(),
        source: LOG_TAG,
      });

      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (errorEvent) => {
      console.error(`${LOG_TAG} Error:`, errorEvent);
      eventBroker.emit<BaseEvent & { error: Error }>(
        EventTypes.ERROR_OCCURRED,
        {
          timestamp: Date.now(),
          source: LOG_TAG,
          error: new Error("WebSocket connection error"),
        },
      );
    };
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      if (!data || typeof data !== "object" || !data.type) {
        return;
      }

      if (__DEV__) {
        console.log(`${LOG_TAG} Message:`, data.type);
      }

      switch (data.type) {
        case MessageTypes.EVENT_DISCOVERED:
          if (data.event) {
            eventBroker.emit<DiscoveryEvent>(EventTypes.EVENT_DISCOVERED, {
              timestamp: Date.now(),
              source: LOG_TAG,
              event: data.event,
            });
          }
          break;

        case MessageTypes.NOTIFICATION:
          if (data.title && data.message) {
            eventBroker.emit<NotificationEvent>(EventTypes.NOTIFICATION, {
              timestamp: data.timestamp || Date.now(),
              source: data.source || LOG_TAG,
              title: data.title,
              message: data.message,
              notificationType: data.notificationType || "info",
              duration: data.duration || 5000,
            });
          }
          break;

        case MessageTypes.LEVEL_UPDATE:
        case MessageTypes.XP_AWARDED: {
          if (data.data?.userId) {
            const eventType =
              data.type === MessageTypes.LEVEL_UPDATE
                ? EventTypes.LEVEL_UPDATE
                : EventTypes.XP_AWARDED;
            eventBroker.emit<LevelUpdateEvent | XPAwardedEvent>(eventType, {
              timestamp: data.data.timestamp || Date.now(),
              source: LOG_TAG,
              data: {
                ...data.data,
                xpProgress:
                  data.type === MessageTypes.LEVEL_UPDATE ? 0 : undefined,
              },
            });
          }
          break;
        }

        // All viewport/marker messages + connection_established → forward to useMapWebSocket
        case MessageTypes.CONNECTION_ESTABLISHED:
        case MessageTypes.REPLACE_ALL:
        case MessageTypes.ADD_EVENT:
        case MessageTypes.UPDATE_EVENT:
        case MessageTypes.DELETE_EVENT:
        case MessageTypes.SESSION_UPDATE:
        default:
          // Forward as-is for useMapWebSocket to handle
          eventBroker.emit<BaseEvent & { data: unknown }>(
            EventTypes.WS_VIEWPORT_MESSAGE,
            {
              timestamp: Date.now(),
              source: LOG_TAG,
              data,
            },
          );
          break;
      }
    } catch (err) {
      console.error(`${LOG_TAG} Error parsing message:`, err);
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimeout();

    const delay = Math.min(30000, 1000 * Math.pow(1.5, this.reconnectAttempts));
    this.reconnectAttempts++;

    if (__DEV__) {
      console.log(`${LOG_TAG} Reconnecting in ${(delay / 1000).toFixed(1)}s`);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.connectInternal();
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private setupAppStateListener(): void {
    if (this.appStateSubscription) return;

    this.appStateSubscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active" && !this.intentionalClose) {
          // Reconnect if not already connected
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            if (__DEV__) {
              console.log(`${LOG_TAG} App foregrounded, reconnecting`);
            }
            this.reconnectAttempts = 0;
            this.connectInternal();
          }
        }
      },
    );
  }

  private removeAppStateListener(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

export const webSocketService = WebSocketService.getInstance();
