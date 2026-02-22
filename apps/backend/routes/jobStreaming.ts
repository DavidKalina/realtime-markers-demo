import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { Redis } from "ioredis";
import { EventEmitter } from "events";
import type { AppContext } from "../types/context";
import { createRedisService } from "../services/shared/RedisService";

const router = new Hono<AppContext>();

// Module-level shared subscriber (created once on first request)
let sharedSubscriber: Redis | null = null;
const jobEmitter = new EventEmitter();
jobEmitter.setMaxListeners(200);

function ensureSharedSubscriber() {
  if (sharedSubscriber) return;
  sharedSubscriber = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || undefined,
  });

  sharedSubscriber.psubscribe("job:*:updates");
  sharedSubscriber.on("pmessage", (_pattern, channel, message) => {
    // "job:{id}:updates" → extract id
    const parts = channel.split(":");
    if (parts.length >= 3) {
      const jobId = parts[1];
      jobEmitter.emit(jobId, message);
    }
  });

  sharedSubscriber.on("error", (err) => {
    console.error("[JobStreaming] Shared subscriber error:", err);
  });
}

// Job status streaming endpoint
router.get("/:jobId/stream", async (c) => {
  const jobId = c.req.param("jobId");

  console.log(`[Stream] Request for job ${jobId}`);

  // Handle authentication - support both Authorization header and token query param
  let token: string | undefined;

  // Check Authorization header first
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else {
    // Check token query parameter
    token = c.req.query("token");
  }

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Validate token
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

  // Create a temporary RedisService for reading initial state
  const tempRedis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || undefined,
  });
  const redisService = createRedisService(tempRedis);

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
          tempRedis.quit();
          return;
        }

        await stream.writeSSE({ data: JSON.stringify(jobData) });

        // If job is already terminal, send done and close
        if (jobData.status === "completed" || jobData.status === "failed") {
          await stream.writeSSE({ event: "done", data: "" });
          stream.close();
          tempRedis.quit();
          return;
        }
      } else {
        await stream.writeSSE({
          data: JSON.stringify({ id: jobId, status: "not_found" }),
        });
        stream.close();
        tempRedis.quit();
        return;
      }

      // Done reading initial state
      tempRedis.quit();

      // Ensure shared subscriber is running
      ensureSharedSubscriber();

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
      jobEmitter.on(jobId, listener);

      // Cleanup on disconnect
      stream.onAbort(() => {
        jobEmitter.off(jobId, listener);
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
      tempRedis.quit();
      stream.close();
    }
  });
});

export { router as jobStreamingRouter };
