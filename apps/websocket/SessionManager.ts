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
  progressDetails?: {
    currentStep: string;
    totalSteps: number;
    stepProgress: number;
    stepDescription: string;
    estimatedTimeRemaining?: number;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  JOB_PROGRESS_UPDATE: "job_progress_update",
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

    this.redisSub.on("ready", () => {
      // Subscribe to all job updates
      this.redisSub.psubscribe("job:*:updates", (err) => {
        if (err) {
          console.error(
            "[SessionManager] Error subscribing to job updates:",
            err,
          );
        }
      });

      // Subscribe to general job updates channel
      this.redisSub.subscribe("job_updates", (err) => {
        if (err) {
          console.error(
            "[SessionManager] Error subscribing to job_updates:",
            err,
          );
        }
      });

      // Subscribe to WebSocket job updates channel
      this.redisSub.subscribe("websocket:job_updates", (err) => {
        if (err) {
          console.error(
            "[SessionManager] Error subscribing to websocket:job_updates:",
            err,
          );
        }
      });
    });

    // Handle messages from Redis
    this.redisSub.on("pmessage", (pattern, channel, message) => {
      this.handleRedisMessage(channel, message).catch((err) => {
        console.error("[SessionManager] Error handling Redis message:", err);
      });
    });

    // Handle messages from the specific channels
    this.redisSub.on("message", (channel, message) => {
      this.handleRedisMessage(channel, message).catch((err) => {
        console.error("[SessionManager] Error handling Redis message:", err);
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

    // Add session to job's session set
    await this.redis.sadd(`job:${jobId}:sessions`, sessionId);

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

    // Remove session from job's session set
    await this.redis.srem(`job:${jobId}:sessions`, sessionId);

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

    // Remove session from all job session sets
    for (const job of session.jobs) {
      await this.redis.srem(`job:${job.id}:sessions`, sessionId);
    }

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
        jobs: session.jobs,
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
   * Send a job progress update to all clients in sessions containing this job
   */
  private async sendJobProgressUpdate(
    jobId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jobUpdate: any,
  ): Promise<void> {
    // Get all sessions containing this job
    const sessionIds = await this.redis.smembers(`job:${jobId}:sessions`);

    const progressMessage = JSON.stringify({
      type: MessageTypes.JOB_PROGRESS_UPDATE,
      data: {
        jobId,
        status: jobUpdate.status,
        progress: jobUpdate.progress,
        progressStep: jobUpdate.progressStep,
        progressDetails: jobUpdate.progressDetails,
        error: jobUpdate.error,
        result: jobUpdate.result,
        timestamp: new Date().toISOString(),
      },
    });

    // Send to all clients in sessions containing this job
    for (const sessionId of sessionIds) {
      const clients = this.sessionsToClients.get(sessionId);
      if (clients) {
        for (const clientId of clients) {
          const client = this.clients.get(clientId);
          if (client) {
            try {
              client.send(progressMessage);
            } catch (error) {
              console.error(
                `[SessionManager] Failed to send job progress update to client ${clientId}:`,
                error,
              );
            }
          }
        }
      }
    }
  }

  /**
   * Handle Redis messages for job updates
   */
  private async handleRedisMessage(
    channel: string,
    message: string,
  ): Promise<void> {
    try {
      const parsedMessage = JSON.parse(message);

      // Handle different types of job update channels
      if (channel === "websocket:job_updates") {
        // Handle WebSocket-specific job updates
        if (
          parsedMessage.type === "JOB_PROGRESS_UPDATE" &&
          parsedMessage.data
        ) {
          await this.sendJobProgressUpdate(
            parsedMessage.data.jobId,
            parsedMessage.data,
          );
        }
        return;
      }

      // Handle job:*:updates and job_updates channels
      if (
        !channel.startsWith("job:") ||
        (!channel.endsWith(":updates") && channel !== "job_updates")
      ) {
        return;
      }

      // Handle both direct job updates and wrapped updates from JobQueue
      const jobUpdate =
        parsedMessage.type === "JOB_UPDATE"
          ? parsedMessage.data
          : parsedMessage;
      const jobId = jobUpdate.id;

      if (!jobId) {
        console.error("[SessionManager] Job update missing jobId:", jobUpdate);
        return;
      }

      // Get all sessions containing this job using the job-session mapping
      const sessionIds = await this.redis.smembers(`job:${jobId}:sessions`);

      for (const sessionId of sessionIds) {
        const sessionKey = `session:${sessionId}`;
        const sessionData = await this.redis.get(sessionKey);
        if (!sessionData) {
          continue;
        }

        const session: SessionData = JSON.parse(sessionData);
        const jobIndex = session.jobs.findIndex((job) => job.id === jobId);

        if (jobIndex !== -1) {
          // Update job in session with enhanced progress details
          session.jobs[jobIndex] = {
            ...session.jobs[jobIndex],
            status: jobUpdate.status || session.jobs[jobIndex].status,
            progress: this.calculateProgressPercentage(jobUpdate),
            progressStep:
              jobUpdate.progressStep ||
              jobUpdate.progressMessage ||
              session.jobs[jobIndex].progressStep,
            progressDetails:
              jobUpdate.progressDetails ||
              session.jobs[jobIndex].progressDetails,
            result: jobUpdate.result || session.jobs[jobIndex].result,
            error: jobUpdate.error || session.jobs[jobIndex].error,
            updatedAt: new Date().toISOString(),
          };

          session.updatedAt = new Date().toISOString();

          // Update session in Redis
          await this.redis.set(sessionKey, JSON.stringify(session));

          // Send update to all clients in the session
          await this.sendSessionUpdate(sessionId);

          // Also send individual job progress update
          await this.sendJobProgressUpdate(jobId, jobUpdate);
        }
      }
    } catch (error) {
      console.error("[SessionManager] Error handling Redis message:", error);
    }
  }

  /**
   * Calculate progress percentage from job update
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private calculateProgressPercentage(jobUpdate: any): number {
    // If job is completed, return 100%
    if (jobUpdate.status === "completed") {
      return 100;
    }

    // If job has a numeric progress value, use it directly
    if (typeof jobUpdate.progress === "number") {
      return Math.min(99, Math.round(jobUpdate.progress));
    }

    // If job has progress details, calculate from step progress
    if (jobUpdate.progressDetails) {
      const { currentStep, totalSteps, stepProgress } =
        jobUpdate.progressDetails;
      if (typeof currentStep === "number" && typeof totalSteps === "number") {
        const stepProgressPercent = (stepProgress || 0) / 100;
        const overallProgress =
          ((currentStep - 1 + stepProgressPercent) / totalSteps) * 100;
        return Math.min(99, Math.round(overallProgress));
      }
    }

    // Default to 0 if no progress information
    return 0;
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

        case MessageTypes.ADD_JOB: {
          if (!ws.data.sessionId) {
            ws.send(
              JSON.stringify({
                type: MessageTypes.ERROR,
                data: { message: "No active session" },
              }),
            );
            break;
          }

          const added = await this.addJobToSession(
            ws.data.sessionId,
            data.jobId,
          );
          if (!added) {
            ws.send(
              JSON.stringify({
                type: MessageTypes.ERROR,
                data: { message: "Failed to add job" },
              }),
            );
          }
          break;
        }

        case MessageTypes.CANCEL_JOB:
          if (!ws.data.sessionId) {
            ws.send(
              JSON.stringify({
                type: MessageTypes.ERROR,
                data: { message: "No active session" },
              }),
            );
            break;
          }

          await this.cancelJob(ws.data.sessionId, data.jobId);
          break;

        case MessageTypes.CLEAR_SESSION:
          if (!ws.data.sessionId) {
            ws.send(
              JSON.stringify({
                type: MessageTypes.ERROR,
                data: { message: "No active session" },
              }),
            );
            break;
          }

          await this.clearSession(ws.data.sessionId);
          break;

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
