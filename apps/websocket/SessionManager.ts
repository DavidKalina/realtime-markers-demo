// src/services/SessionManager.ts
import type { ServerWebSocket } from "bun";
import { Redis } from "ioredis";
import { v4 as uuidv4 } from "uuid";

// Types
interface SessionData {
  id: string;
  createdAt: string;
  updatedAt: string;
  clientId: string;
}

interface WebSocketClientData {
  clientId: string;
  sessionId?: string;
}

// Message types for WebSocket communication
const MessageTypes = {
  // Client -> Server
  CREATE_SESSION: "create_session",
  JOIN_SESSION: "join_session",

  // Server -> Client
  SESSION_CREATED: "session_created",
  SESSION_JOINED: "session_joined",
  SESSION_UPDATE: "session_update",
  ERROR: "error",
};

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "redis",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`Redis retry attempt ${times} with delay ${delay}ms`);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    console.log("Redis reconnectOnError triggered:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });
    return true;
  },
  enableOfflineQueue: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  lazyConnect: true,
  authRetry: true,
  enableReadyCheck: true,
};

export class SessionManager {
  private redis: Redis;
  private clients: Map<string, ServerWebSocket<WebSocketClientData>> =
    new Map();
  private sessionsToClients: Map<string, Set<string>> = new Map();
  private redisSub: Redis;

  constructor(redis: Redis) {
    this.redis = redis;

    // Create a separate Redis client for pub/sub with proper configuration
    this.redisSub = new Redis(redisConfig);

    // Add error handling for subscriber
    this.redisSub.on("error", (error: Error & { code?: string }) => {
      console.error("[SessionManager] Redis subscriber error:", {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
    });

    this.redisSub.on("connect", () => {
      console.log("[SessionManager] Redis subscriber connected successfully");
    });
  }

  /**
   * Register a WebSocket client
   */
  registerClient(ws: ServerWebSocket<WebSocketClientData>): void {
    this.clients.set(ws.data.clientId, ws);
  }

  /**
   * Unregister a WebSocket client
   */
  unregisterClient(clientId: string): void {
    this.clients.delete(clientId);

    // Remove client from any sessions
    for (const [sessionId, clients] of this.sessionsToClients.entries()) {
      if (clients.has(clientId)) {
        clients.delete(clientId);
        if (clients.size === 0) {
          this.sessionsToClients.delete(sessionId);
        }
      }
    }
  }

  /**
   * Create a new session for a client
   */
  async createSession(clientId: string): Promise<string> {
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    const session: SessionData = {
      id: sessionId,
      createdAt: now,
      updatedAt: now,
      clientId,
    };

    // Store session in Redis
    await this.redis.set(`session:${sessionId}`, JSON.stringify(session));

    // Associate client with session
    if (!this.sessionsToClients.has(sessionId)) {
      this.sessionsToClients.set(sessionId, new Set());
    }
    this.sessionsToClients.get(sessionId)!.add(clientId);

    // Update client data with session ID
    const client = this.clients.get(clientId);
    if (client) {
      client.data.sessionId = sessionId;
    }

    return sessionId;
  }

  /**
   * Join an existing session
   */
  async joinSession(clientId: string, sessionId: string): Promise<boolean> {
    const sessionData = await this.redis.get(`session:${sessionId}`);
    if (!sessionData) {
      return false;
    }

    // Associate client with session
    if (!this.sessionsToClients.has(sessionId)) {
      this.sessionsToClients.set(sessionId, new Set());
    }
    this.sessionsToClients.get(sessionId)!.add(clientId);

    // Update client data with session ID
    const client = this.clients.get(clientId);
    if (client) {
      client.data.sessionId = sessionId;
    }

    // Send session data to client
    this.sendSessionUpdate(sessionId);

    return true;
  }

  /**
   * Send a session update to all clients in the session
   */
  private async sendSessionUpdate(sessionId: string): Promise<void> {
    const sessionData = await this.redis.get(`session:${sessionId}`);
    if (!sessionData) {
      return;
    }

    const session: SessionData = JSON.parse(sessionData);
    const clients = this.sessionsToClients.get(sessionId);

    if (!clients) {
      return;
    }

    const message = JSON.stringify({
      type: MessageTypes.SESSION_UPDATE,
      data: {
        sessionId: session.id,
        timestamp: new Date().toISOString(),
      },
    });

    // Send to all connected clients in this session
    for (const clientId of clients) {
      const client = this.clients.get(clientId);
      if (client) {
        try {
          client.send(message);
        } catch (error) {
          console.error(
            `[SessionManager] Failed to send session update to client ${clientId}:`,
            error,
          );
        }
      }
    }
  }

  /**
   * Handle WebSocket messages
   */
  async handleMessage(
    ws: ServerWebSocket<WebSocketClientData>,
    message: string,
  ): Promise<void> {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case MessageTypes.CREATE_SESSION: {
          const sessionId = await this.createSession(ws.data.clientId);
          ws.send(
            JSON.stringify({
              type: MessageTypes.SESSION_CREATED,
              data: { sessionId },
            }),
          );
          break;
        }

        case MessageTypes.JOIN_SESSION: {
          const joined = await this.joinSession(
            ws.data.clientId,
            data.sessionId,
          );
          if (joined) {
            ws.send(
              JSON.stringify({
                type: MessageTypes.SESSION_JOINED,
                data: { sessionId: data.sessionId },
              }),
            );
          } else {
            ws.send(
              JSON.stringify({
                type: MessageTypes.ERROR,
                data: { message: "Session not found" },
              }),
            );
          }
          break;
        }

        default:
          console.warn(`[SessionManager] Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error(
        "[SessionManager] Error handling WebSocket message:",
        error,
      );

      ws.send(
        JSON.stringify({
          type: MessageTypes.ERROR,
          data: { message: "Invalid message format" },
        }),
      );
    }
  }
}
