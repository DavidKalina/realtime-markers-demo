import type { ServerWebSocket } from "bun";
import { MessageTypes } from "../config/constants";
import type {
  WebSocketData,
  ClientMessage,
  MessageHandlers,
} from "../types/websocket";
import { RedisService } from "../services/redisService";
import { SessionManager } from "../../SessionManager";

interface Filter {
  isActive: boolean;
  [key: string]: unknown;
}

export class MessageHandler {
  private static instance: MessageHandler;
  private redisService: RedisService;
  private sessionManager: SessionManager;
  private handlers: MessageHandlers;

  private constructor() {
    this.redisService = RedisService.getInstance();
    this.sessionManager = new SessionManager(this.redisService.getPubClient());
    this.handlers = this.setupHandlers();
  }

  public static getInstance(): MessageHandler {
    if (!MessageHandler.instance) {
      MessageHandler.instance = new MessageHandler();
    }
    return MessageHandler.instance;
  }

  private setupHandlers(): MessageHandlers {
    return {
      [MessageTypes.CLIENT_IDENTIFICATION]:
        this.handleClientIdentification.bind(this),
      [MessageTypes.VIEWPORT_UPDATE]: this.handleViewportUpdate.bind(this),
      [MessageTypes.CREATE_SESSION]: this.handleSessionMessage.bind(this),
      [MessageTypes.JOIN_SESSION]: this.handleSessionMessage.bind(this),
      [MessageTypes.ADD_JOB]: this.handleSessionMessage.bind(this),
      [MessageTypes.CANCEL_JOB]: this.handleSessionMessage.bind(this),
      [MessageTypes.CLEAR_SESSION]: this.handleSessionMessage.bind(this),
    };
  }

  public async handleMessage(
    ws: ServerWebSocket<WebSocketData>,
    message: string,
  ): Promise<void> {
    try {
      const data = JSON.parse(message) as ClientMessage;
      const handler = this.handlers[data.type];

      if (handler) {
        await handler(ws, message);
      } else {
        console.warn(
          `Unknown message type ${data.type} from client ${ws.data.clientId}`,
        );
      }
    } catch (error) {
      console.error(
        `Error processing message from ${ws.data.clientId}:`,
        error,
      );
      ws.send(
        JSON.stringify({
          type: MessageTypes.ERROR,
          message: "Error processing message",
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  private async handleClientIdentification(
    ws: ServerWebSocket<WebSocketData>,
    message: string,
  ): Promise<void> {
    const data = JSON.parse(message) as ClientMessage;
    const userId = data.userId;

    if (!userId || !this.isValidUserId(userId)) {
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

    // Associate client with user
    ws.data.userId = userId;

    // Ensure we have a Redis subscriber for this user
    this.redisService.getSubscriberForUser(userId);

    console.log(`Client ${ws.data.clientId} identified as user ${userId}`);

    // Fetch user's filters from backend and publish to filter-changes
    await this.fetchUserFiltersAndPublish(userId);
  }

  private async handleViewportUpdate(
    ws: ServerWebSocket<WebSocketData>,
    message: string,
  ): Promise<void> {
    const data = JSON.parse(message) as ClientMessage;
    const userId = ws.data.userId;

    if (!userId) {
      console.warn(
        `Viewport update received from unidentified client ${ws.data.clientId}`,
      );
      return;
    }

    if (!data.viewport || typeof data.viewport !== "object") {
      console.error(`Invalid viewport data from client ${ws.data.clientId}`);
      return;
    }

    // Format viewport for Filter Processor
    const viewport = {
      minX: data.viewport.west,
      minY: data.viewport.south,
      maxX: data.viewport.east,
      maxY: data.viewport.north,
    };

    await this.redisService.updateViewport(userId, viewport);
    console.log(`Published viewport update for user ${userId}`);
  }

  private async handleSessionMessage(
    ws: ServerWebSocket<WebSocketData>,
    message: string,
  ): Promise<void> {
    await this.sessionManager.handleMessage(ws, message);
  }

  private async fetchUserFiltersAndPublish(userId: string): Promise<void> {
    try {
      console.log(`🔍 Fetching filters for user ${userId}`);

      const backendUrl = process.env.BACKEND_URL || "http://backend:3000";
      const response = await fetch(
        `${backendUrl}/api/internal/filters?userId=${userId}`,
        {
          headers: {
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!response.ok) {
        console.error(
          `Failed to fetch filters for user ${userId}: ${response.status} ${response.statusText}`,
        );
        await this.publishEmptyFilter(userId);
        return;
      }

      const filters = (await response.json()) as Filter[];
      const activeFilters = filters.filter((filter) => filter.isActive);

      await this.redisService.publish(
        "filter-changes",
        JSON.stringify({
          userId,
          filters: activeFilters,
          timestamp: new Date().toISOString(),
        }),
      );

      console.log(
        `📤 Published filter update for user ${userId} with ${activeFilters.length} active filters`,
      );
    } catch (error) {
      console.error(`Error fetching filters for user ${userId}:`, error);
      await this.publishEmptyFilter(userId);
    }
  }

  private async publishEmptyFilter(userId: string): Promise<void> {
    console.log(
      `📤 Publishing default empty filter for user ${userId} (will match all events)`,
    );

    await this.redisService.publish(
      "filter-changes",
      JSON.stringify({
        userId,
        filters: [], // Empty array means "match all events"
        timestamp: new Date().toISOString(),
      }),
    );
  }

  private isValidUserId(userId: string): boolean {
    // UUID v4 format validation
    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidV4Regex.test(userId);
  }
}
