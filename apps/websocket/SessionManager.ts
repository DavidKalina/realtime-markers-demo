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
  jobs: JobSessionData[];
}

interface JobSessionData {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number; // 0-100
  progressStep: string;
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
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
  ADD_JOB: "add_job",
  CANCEL_JOB: "cancel_job",
  CLEAR_SESSION: "clear_session",

  // Server -> Client
  SESSION_CREATED: "session_created",
  SESSION_JOINED: "session_joined",
  SESSION_UPDATE: "session_update",
  JOB_ADDED: "job_added",
  JOB_UPDATED: "job_updated",
  JOB_COMPLETED: "job_completed",
  JOB_FAILED: "job_failed",
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
    console.log('Redis reconnectOnError triggered:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    return true;
  },
  enableOfflineQueue: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  lazyConnect: true,
  authRetry: true,
  enableReadyCheck: true
};

export class SessionManager {
  private redis: Redis;
  private clients: Map<string, ServerWebSocket<WebSocketClientData>> = new Map();
  private sessionsToClients: Map<string, Set<string>> = new Map();
  private redisSub: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
    console.log('[SessionManager] Initializing SessionManager');

    // Create a separate Redis client for pub/sub with proper configuration
    this.redisSub = new Redis(redisConfig);
    console.log('[SessionManager] Created Redis subscriber client');

    // Add error handling for subscriber
    this.redisSub.on('error', (error: Error & { code?: string }) => {
      console.error('[SessionManager] Redis subscriber error:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
    });

    this.redisSub.on('connect', () => {
      console.log('[SessionManager] Redis subscriber connected successfully');
    });

    this.redisSub.on('ready', () => {
      console.log('[SessionManager] Redis subscriber is ready to accept commands');
      // Subscribe to all job updates
      this.redisSub.psubscribe("job:*:updates", (err, count) => {
        if (err) {
          console.error('[SessionManager] Error subscribing to job updates:', err);
        } else {
          console.log(`[SessionManager] Subscribed to job updates pattern, count: ${count}`);
        }
      });
    });

    // Handle messages from Redis
    this.redisSub.on('pmessage', (pattern, channel, message) => {
      console.log(`[SessionManager] Received Redis message on pattern ${pattern}, channel ${channel}:`, message);
      this.handleRedisMessage(channel, message).catch(err => {
        console.error('[SessionManager] Error handling Redis message:', err);
      });
    });

    // Also subscribe to the specific job channel
    this.redisSub.subscribe("job:updates", (err, count) => {
      if (err) {
        console.error('[SessionManager] Error subscribing to job:updates:', err);
      } else {
        console.log(`[SessionManager] Subscribed to job:updates, count: ${count}`);
      }
    });

    // Handle messages from the specific channel
    this.redisSub.on('message', (channel, message) => {
      console.log(`[SessionManager] Received Redis message on channel ${channel}:`, message);
      this.handleRedisMessage(channel, message).catch(err => {
        console.error('[SessionManager] Error handling Redis message:', err);
      });
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
      jobs: [],
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
   * Add a job to a session
   */
  async addJobToSession(sessionId: string, jobId: string): Promise<boolean> {
    const sessionData = await this.redis.get(`session:${sessionId}`);
    if (!sessionData) {
      return false;
    }

    const session: SessionData = JSON.parse(sessionData);
    const now = new Date().toISOString();

    // Add job to session
    session.jobs.push({
      id: jobId,
      status: "pending",
      progress: 0,
      progressStep: "Initializing job...",
      createdAt: now,
      updatedAt: now,
    });

    session.updatedAt = now;

    // Update session in Redis
    await this.redis.set(`session:${sessionId}`, JSON.stringify(session));

    // Send update to all clients in the session
    this.sendSessionUpdate(sessionId);

    return true;
  }

  /**
   * Cancel a job in a session
   */
  async cancelJob(sessionId: string, jobId: string): Promise<boolean> {
    const sessionData = await this.redis.get(`session:${sessionId}`);
    if (!sessionData) {
      return false;
    }

    const session: SessionData = JSON.parse(sessionData);
    const jobIndex = session.jobs.findIndex((job) => job.id === jobId);

    if (jobIndex === -1) {
      return false;
    }

    // Remove job from session
    session.jobs.splice(jobIndex, 1);
    session.updatedAt = new Date().toISOString();

    // Update session in Redis
    await this.redis.set(`session:${sessionId}`, JSON.stringify(session));

    // Send update to all clients in the session
    this.sendSessionUpdate(sessionId);

    return true;
  }

  /**
   * Clear all jobs from a session
   */
  async clearSession(sessionId: string): Promise<boolean> {
    const sessionData = await this.redis.get(`session:${sessionId}`);
    if (!sessionData) {
      return false;
    }

    const session: SessionData = JSON.parse(sessionData);

    // Clear jobs
    session.jobs = [];
    session.updatedAt = new Date().toISOString();

    // Update session in Redis
    await this.redis.set(`session:${sessionId}`, JSON.stringify(session));

    // Send update to all clients in the session
    this.sendSessionUpdate(sessionId);

    return true;
  }

  /**
   * Send a session update to all clients in the session
   */
  private async sendSessionUpdate(sessionId: string): Promise<void> {
    const sessionData = await this.redis.get(`session:${sessionId}`);
    if (!sessionData) {
      console.log(`[SessionManager] No session data found for session ${sessionId}`);
      return;
    }

    const session: SessionData = JSON.parse(sessionData);
    const clients = this.sessionsToClients.get(sessionId);

    if (!clients) {
      console.log(`[SessionManager] No clients found for session ${sessionId}`);
      return;
    }

    const message = JSON.stringify({
      type: MessageTypes.SESSION_UPDATE,
      data: {
        sessionId: session.id,
        jobs: session.jobs,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`[SessionManager] Sending session update to ${clients.size} clients in session ${sessionId}:`, message);

    // Send to all connected clients in this session
    for (const clientId of clients) {
      const client = this.clients.get(clientId);
      if (client) {
        try {
          client.send(message);
          console.log(`[SessionManager] Successfully sent update to client ${clientId}`);
        } catch (error) {
          console.error(`[SessionManager] Failed to send session update to client ${clientId}:`, error);
        }
      } else {
        console.log(`[SessionManager] Client ${clientId} not found in clients map`);
      }
    }
  }

  /**
   * Handle Redis messages for job updates
   */
  private async handleRedisMessage(channel: string, message: string): Promise<void> {
    // Handle both job:*:updates and job:updates channels
    if (!channel.startsWith("job:") || (!channel.endsWith(":updates") && channel !== "job:updates")) {
      console.log(`[SessionManager] Ignoring non-job update message on channel: ${channel}`);
      return;
    }

    try {
      console.log(`[SessionManager] Processing job update from channel ${channel}:`, message);
      const jobUpdate = JSON.parse(message);
      const jobId = jobUpdate.id;

      if (!jobId) {
        console.error('[SessionManager] Job update missing jobId:', jobUpdate);
        return;
      }

      // Find all sessions containing this job
      const allSessions = await this.redis.keys("session:*");
      console.log(`[SessionManager] Found ${allSessions.length} sessions to check for job ${jobId}`);

      for (const sessionKey of allSessions) {
        const sessionData = await this.redis.get(sessionKey);
        if (!sessionData) {
          console.log(`[SessionManager] No session data found for key: ${sessionKey}`);
          continue;
        }

        const session: SessionData = JSON.parse(sessionData);
        const jobIndex = session.jobs.findIndex((job) => job.id === jobId);

        if (jobIndex !== -1) {
          console.log(`[SessionManager] Updating job ${jobId} in session ${sessionKey} with:`, jobUpdate);
          // Update job in session
          session.jobs[jobIndex] = {
            ...session.jobs[jobIndex],
            status: jobUpdate.status || session.jobs[jobIndex].status,
            progress: this.calculateProgressPercentage(jobUpdate),
            progressStep: jobUpdate.progressMessage || session.jobs[jobIndex].progressStep,
            result: jobUpdate.result || session.jobs[jobIndex].result,
            error: jobUpdate.error || session.jobs[jobIndex].error,
            updatedAt: new Date().toISOString(),
          };

          session.updatedAt = new Date().toISOString();

          // Update session in Redis
          await this.redis.set(sessionKey, JSON.stringify(session));
          console.log(`[SessionManager] Updated session ${sessionKey} in Redis`);

          // Send update to all clients in the session
          const sessionId = sessionKey.replace("session:", "");
          console.log(`[SessionManager] Sending update to clients in session ${sessionId}`);
          await this.sendSessionUpdate(sessionId);
        }
      }
    } catch (error) {
      console.error("[SessionManager] Error handling Redis message:", error);
    }
  }

  /**
   * Calculate progress percentage from job update
   */
  private calculateProgressPercentage(jobUpdate: any): number {
    // If job is completed, return 100%
    if (jobUpdate.status === "completed") {
      return 100;
    }

    // If job has a numeric progress value, use it directly
    if (typeof jobUpdate.progress === "number") {
      return Math.min(99, Math.round(jobUpdate.progress * 100));
    }

    // Default to 0 if no progress information
    return 0;
  }

  /**
   * Handle WebSocket messages
   */
  async handleMessage(ws: ServerWebSocket<WebSocketClientData>, message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      console.log(`[SessionManager] Received message type: ${data.type} from client ${ws.data.clientId}`);

      switch (data.type) {
        case MessageTypes.CREATE_SESSION:
          console.log(`[SessionManager] Creating new session for client ${ws.data.clientId}`);
          const sessionId = await this.createSession(ws.data.clientId);
          console.log(`[SessionManager] Created session ${sessionId} for client ${ws.data.clientId}`);
          ws.send(
            JSON.stringify({
              type: MessageTypes.SESSION_CREATED,
              data: { sessionId },
            })
          );
          break;

        case MessageTypes.JOIN_SESSION:
          console.log(`[SessionManager] Client ${ws.data.clientId} attempting to join session ${data.sessionId}`);
          const joined = await this.joinSession(ws.data.clientId, data.sessionId);
          if (joined) {
            console.log(`[SessionManager] Client ${ws.data.clientId} successfully joined session ${data.sessionId}`);
            ws.send(
              JSON.stringify({
                type: MessageTypes.SESSION_JOINED,
                data: { sessionId: data.sessionId },
              })
            );
          } else {
            console.log(`[SessionManager] Failed to join session ${data.sessionId} for client ${ws.data.clientId}`);
            ws.send(
              JSON.stringify({
                type: MessageTypes.ERROR,
                data: { message: "Session not found" },
              })
            );
          }
          break;

        case MessageTypes.ADD_JOB:
          if (!ws.data.sessionId) {
            console.log(`[SessionManager] Client ${ws.data.clientId} attempted to add job without active session`);
            ws.send(
              JSON.stringify({
                type: MessageTypes.ERROR,
                data: { message: "No active session" },
              })
            );
            break;
          }

          console.log(`[SessionManager] Adding job ${data.jobId} to session ${ws.data.sessionId}`);
          const added = await this.addJobToSession(ws.data.sessionId, data.jobId);
          if (!added) {
            console.log(`[SessionManager] Failed to add job ${data.jobId} to session ${ws.data.sessionId}`);
            ws.send(
              JSON.stringify({
                type: MessageTypes.ERROR,
                data: { message: "Failed to add job" },
              })
            );
          } else {
            console.log(`[SessionManager] Successfully added job ${data.jobId} to session ${ws.data.sessionId}`);
          }
          break;

        case MessageTypes.CANCEL_JOB:
          if (!ws.data.sessionId) {
            console.log(`[SessionManager] Client ${ws.data.clientId} attempted to cancel job without active session`);
            ws.send(
              JSON.stringify({
                type: MessageTypes.ERROR,
                data: { message: "No active session" },
              })
            );
            break;
          }

          console.log(`[SessionManager] Cancelling job ${data.jobId} in session ${ws.data.sessionId}`);
          await this.cancelJob(ws.data.sessionId, data.jobId);
          break;

        case MessageTypes.CLEAR_SESSION:
          if (!ws.data.sessionId) {
            console.log(`[SessionManager] Client ${ws.data.clientId} attempted to clear session without active session`);
            ws.send(
              JSON.stringify({
                type: MessageTypes.ERROR,
                data: { message: "No active session" },
              })
            );
            break;
          }

          console.log(`[SessionManager] Clearing session ${ws.data.sessionId}`);
          await this.clearSession(ws.data.sessionId);
          break;

        default:
          console.warn(`[SessionManager] Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error("[SessionManager] Error handling WebSocket message:", error);

      ws.send(
        JSON.stringify({
          type: MessageTypes.ERROR,
          data: { message: "Invalid message format" },
        })
      );
    }
  }
}
