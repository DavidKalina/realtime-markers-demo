import type { ServerWebSocket } from "bun";
import { MessageTypes } from "../config/constants";
import type { WebSocketData } from "../types/websocket";
import { RedisService } from "../services/redisService";
import { HealthService } from "../services/healthService";
import { MessageHandler } from "./messageHandler";
import { SessionManager } from "../../SessionManager";

export class ConnectionHandler {
  private static instance: ConnectionHandler;
  private clients: Map<string, ServerWebSocket<WebSocketData>>;
  private userToClients: Map<string, Set<string>>;
  private redisService: RedisService;
  private healthService: HealthService;
  private messageHandler: MessageHandler;
  private sessionManager: SessionManager;

  private constructor() {
    this.clients = new Map();
    this.userToClients = new Map();
    this.redisService = RedisService.getInstance();
    this.healthService = HealthService.getInstance();
    this.messageHandler = MessageHandler.getInstance();
    this.sessionManager = new SessionManager(this.redisService.getPubClient());
  }

  public static getInstance(): ConnectionHandler {
    if (!ConnectionHandler.instance) {
      ConnectionHandler.instance = new ConnectionHandler();
    }
    return ConnectionHandler.instance;
  }

  public handleOpen(ws: ServerWebSocket<WebSocketData>): void {
    // Generate client ID
    const clientId = crypto.randomUUID();

    // Initialize WebSocket data
    ws.data = {
      clientId,
      lastActivity: Date.now(),
    };

    // Store client in map
    this.clients.set(clientId, ws);

    // Register client with session manager
    this.sessionManager.registerClient(ws);

    // Send connection established message
    ws.send(
      JSON.stringify({
        type: MessageTypes.CONNECTION_ESTABLISHED,
        clientId,
        timestamp: new Date().toISOString(),
      }),
    );

    console.log(`Client ${clientId} connected`);
    this.updateHealthStats();
  }

  public async handleMessage(
    ws: ServerWebSocket<WebSocketData>,
    message: string,
  ): Promise<void> {
    // Update last activity timestamp
    ws.data.lastActivity = Date.now();

    // Handle the message
    await this.messageHandler.handleMessage(ws, message);
  }

  public async handleClose(ws: ServerWebSocket<WebSocketData>): Promise<void> {
    try {
      const { clientId, userId } = ws.data;

      console.log(`Client ${clientId} disconnected`);

      // Clean up session management
      this.sessionManager.unregisterClient(clientId);

      // Remove from client map
      this.clients.delete(clientId);

      // Remove from user-client mapping if associated with a user
      if (userId) {
        const userClients = this.userToClients.get(userId);

        if (userClients) {
          userClients.delete(clientId);

          // If no more clients for this user, clean up
          if (userClients.size === 0) {
            this.userToClients.delete(userId);
            this.redisService.releaseSubscriber(userId);

            // Remove viewport data
            const viewportKey = `viewport:${userId}`;
            await Promise.all([
              this.redisService
                .getPubClient()
                .zrem("viewport:geo", viewportKey),
              this.redisService.del(viewportKey),
            ]);

            if (process.env.NODE_ENV !== "production") {
              console.log(`Cleaned up viewport data for user ${userId}`);
            }
          }
        }
      }

      this.updateHealthStats();
    } catch (error) {
      console.error("Error handling client disconnect:", error);
    }
  }

  public addUserClient(userId: string, clientId: string): void {
    if (!this.userToClients.has(userId)) {
      this.userToClients.set(userId, new Set());
    }
    this.userToClients.get(userId)!.add(clientId);
    this.updateHealthStats();
  }

  public removeUserClient(userId: string, clientId: string): void {
    const userClients = this.userToClients.get(userId);
    if (userClients) {
      userClients.delete(clientId);
      if (userClients.size === 0) {
        this.userToClients.delete(userId);
      }
      this.updateHealthStats();
    }
  }

  public getClient(
    clientId: string,
  ): ServerWebSocket<WebSocketData> | undefined {
    return this.clients.get(clientId);
  }

  public getUserClients(userId: string): Set<string> | undefined {
    return this.userToClients.get(userId);
  }

  private updateHealthStats(): void {
    this.healthService.updateClientStats(
      this.clients.size,
      this.userToClients.size,
    );
  }
}
