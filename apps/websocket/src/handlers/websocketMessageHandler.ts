import type { ServerWebSocket } from "bun";
import { MessageTypes } from "../config/constants";
import { isValidUserId } from "../utils/validation";
import { handleViewportUpdate } from "./viewportHandler";
import type { WebSocketData } from "../types/websocket";
import type { SessionManager } from "../../SessionManager";
import type { FormattedViewport } from "./viewportHandler";

export interface ClientIdentificationData {
  userId: string;
}

export interface ViewportUpdateData {
  viewport: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
}

export interface WebSocketMessageHandler {
  handleClientIdentification: (
    ws: ServerWebSocket<WebSocketData>,
    data: ClientIdentificationData,
  ) => Promise<void>;
  handleViewportUpdate: (
    ws: ServerWebSocket<WebSocketData>,
    data: ViewportUpdateData,
  ) => Promise<void>;
  handleSessionMessage: (
    ws: ServerWebSocket<WebSocketData>,
    data: Record<string, unknown>,
  ) => Promise<void>;
}

export interface WebSocketMessageHandlerDependencies {
  sessionManager: SessionManager;
  updateViewport: (
    userId: string,
    viewport: FormattedViewport,
  ) => Promise<void>;
  getUserClients: (userId: string) => Set<string> | undefined;
  addUserClient: (userId: string, clientId: string) => void;
  getRedisSubscriberForUser: (userId: string) => unknown;
  fetchUserFiltersAndPublish: (userId: string) => Promise<void>;
  updateHealthStats: () => void;
}

export function createWebSocketMessageHandler(
  dependencies: WebSocketMessageHandlerDependencies,
): WebSocketMessageHandler {
  return {
    async handleClientIdentification(
      ws: ServerWebSocket<WebSocketData>,
      data: ClientIdentificationData,
    ) {
      if (!data.userId || !isValidUserId(data.userId)) {
        console.error(
          `Invalid userId in client identification from ${ws.data.clientId}`,
        );
        ws.send(
          JSON.stringify({
            type: MessageTypes.ERROR,
            message: "Invalid userId format",
            timestamp: new Date().toISOString(),
          }),
        );
        return;
      }

      const userId = data.userId;

      // Associate client with user
      ws.data.userId = userId;

      // Add to user-client mapping
      dependencies.addUserClient(userId, ws.data.clientId);

      // Ensure we have a Redis subscriber for this user
      dependencies.getRedisSubscriberForUser(userId);

      console.log(`Client ${ws.data.clientId} identified as user ${userId}`);

      // Fetch user's filters from backend and publish to filter-changes
      await dependencies.fetchUserFiltersAndPublish(userId);

      dependencies.updateHealthStats();
    },

    async handleViewportUpdate(
      ws: ServerWebSocket<WebSocketData>,
      data: ViewportUpdateData,
    ) {
      const userId = ws.data.userId;

      if (!userId) {
        console.warn(
          `Viewport update received from unidentified client ${ws.data.clientId}`,
        );
        return;
      }

      await handleViewportUpdate(
        ws,
        data.viewport,
        dependencies.updateViewport,
      );
    },

    async handleSessionMessage(
      ws: ServerWebSocket<WebSocketData>,
      data: Record<string, unknown>,
    ) {
      await dependencies.sessionManager.handleMessage(ws, JSON.stringify(data));
    },
  };
}

export function handleWebSocketMessage(
  ws: ServerWebSocket<WebSocketData>,
  message: string | Uint8Array,
  messageHandler: WebSocketMessageHandler,
): Promise<void> {
  // Update last activity timestamp
  ws.data.lastActivity = Date.now();

  try {
    const data = JSON.parse(message.toString()) as Record<string, unknown>;

    if (data.type === MessageTypes.CLIENT_IDENTIFICATION) {
      const clientData = data as unknown as ClientIdentificationData;
      return messageHandler.handleClientIdentification(ws, clientData);
    } else if (data.type === MessageTypes.VIEWPORT_UPDATE) {
      const viewportData = data as unknown as ViewportUpdateData;
      return messageHandler.handleViewportUpdate(ws, viewportData);
    } else if (
      data.type === MessageTypes.CREATE_SESSION ||
      data.type === MessageTypes.JOIN_SESSION ||
      data.type === MessageTypes.ADD_JOB ||
      data.type === MessageTypes.CANCEL_JOB ||
      data.type === MessageTypes.CLEAR_SESSION
    ) {
      return messageHandler.handleSessionMessage(ws, data);
    } else {
      console.warn(
        `Unknown message type ${data.type} from client ${ws.data.clientId}`,
      );
    }
  } catch (error) {
    console.error(`Error processing message from ${ws.data.clientId}:`, error);
  }

  return Promise.resolve();
}
