import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { Redis } from "ioredis";
import { EventEmitter } from "events";
import type { AppContext } from "../types/context";

const router = new Hono<AppContext>();

class JobStreamManager {
  private subscriber: Redis | null = null;
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  ensureSubscriber(): void {
    if (this.subscriber) return;
    this.subscriber = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    this.subscriber.psubscribe("job:*:updates");
    this.subscriber.on("pmessage", (_pattern, channel, message) => {
      const parts = channel.split(":");
      if (parts.length >= 3) {
        const jobId = parts[1];
        this.emitter.emit(jobId, message);
      }
    });

    this.subscriber.on("error", (err) => {
      console.error("[JobStreaming] Shared subscriber error:", err);
    });
  }

  onJobUpdate(jobId: string, listener: (message: string) => void): void {
    this.emitter.on(jobId, listener);
  }

  offJobUpdate(jobId: string, listener: (message: string) => void): void {
    this.emitter.off(jobId, listener);
  }
}

const jobStreamManager = new JobStreamManager();

// Job status streaming endpoint
router.get("/:jobId/stream", async (c) => {
  const jobId = c.req.param("jobId");

  console.log(`[Stream] Request for job ${jobId}`);

  // Handle authentication - support both Authorization header and token query param
  let token: string | undefined;

  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else {
    token = c.req.query("token");
  }

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const authService = c.get("authService");

  let decoded: { id: string; email: string; role: string } | null;
  try {
    decoded = authService.validateToken(token);
    if (!decoded) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("user", {
      ...decoded,
      userId: decoded.id,
    });
  } catch (error) {
    console.error(`[Stream] Token validation error for job ${jobId}:`, error);
    return c.json({ error: "Unauthorized" }, 401);
  }

  const redisService = c.get("redisService");

  return streamSSE(c, async (stream) => {
    try {
      // Send initial job state
      const initialData = await redisService.get(`job:${jobId}`);

      if (initialData) {
        const jobData =
          typeof initialData === "string"
            ? JSON.parse(initialData)
            : initialData;

        // Check if the job belongs to the authenticated user
        if (jobData.data?.creatorId !== decoded.id) {
          await stream.writeSSE({
            data: JSON.stringify({ id: jobId, status: "unauthorized" }),
          });
          stream.close();
          return;
        }

        await stream.writeSSE({ data: JSON.stringify(jobData) });

        // If job is already terminal, send done and close
        if (jobData.status === "completed" || jobData.status === "failed") {
          await stream.writeSSE({ event: "done", data: "" });
          stream.close();
          return;
        }
      } else {
        await stream.writeSSE({
          data: JSON.stringify({ id: jobId, status: "not_found" }),
        });
        stream.close();
        return;
      }

      // Ensure shared subscriber is running
      jobStreamManager.ensureSubscriber();

      // Listen for updates via EventEmitter (no new Redis connection)
      const listener = async (message: string) => {
        try {
          const parsedMessage = JSON.parse(message);
          const jobUpdate = parsedMessage.data || parsedMessage;

          await stream.writeSSE({ data: JSON.stringify(jobUpdate) });

          if (
            jobUpdate.status === "completed" ||
            jobUpdate.status === "failed"
          ) {
            await stream.writeSSE({ event: "done", data: "" });
          }
        } catch (e) {
          console.error(`[Stream] Error parsing message for job ${jobId}:`, e);
          await stream.writeSSE({ data: message });
        }
      };
      jobStreamManager.onJobUpdate(jobId, listener);

      // Cleanup on disconnect
      stream.onAbort(() => {
        jobStreamManager.offJobUpdate(jobId, listener);
      });

      // Heartbeat
      const heartbeat = setInterval(async () => {
        try {
          await stream.writeSSE({ event: "heartbeat", data: "" });
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      stream.onAbort(() => {
        clearInterval(heartbeat);
      });

      // Keep stream alive until abort
      await new Promise(() => {});
    } catch (error) {
      console.error("Error in SSE stream:", error);
      await stream.writeSSE({
        data: JSON.stringify({ error: "Stream error" }),
      });
      stream.close();
    }
  });
});

export { router as jobStreamingRouter };
