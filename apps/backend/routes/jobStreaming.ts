import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { Redis } from "ioredis";
import type { AppContext } from "../types/context";
import { createRedisService } from "../services/shared/RedisService";

const router = new Hono<AppContext>();

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
    console.log(
      `[Stream] Token from Authorization header: ${token.substring(0, 20)}...`,
    );
  } else {
    // Check token query parameter
    token = c.req.query("token");
    console.log(
      `[Stream] Token from query param: ${token ? token.substring(0, 20) + "..." : "null"}`,
    );
  }

  if (!token) {
    console.log(`[Stream] No token provided for job ${jobId}`);
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Validate token
  const authService = c.get("authService");
  console.log(`[Stream] AuthService available: ${!!authService}`);

  let decoded: { id: string; email: string; role: string } | null;
  try {
    decoded = authService.validateToken(token);
    console.log(
      "[Stream] Token validation result:",
      decoded ? `valid for user ${decoded.id}` : "invalid",
    );

    if (!decoded) {
      console.log(`[Stream] Token validation failed for job ${jobId}`);
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Attach user to context
    c.set("user", {
      ...decoded,
      userId: decoded.id,
    });
  } catch (error) {
    console.error(`[Stream] Token validation error for job ${jobId}:`, error);
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Use Hono's streamSSE
  return streamSSE(c, async (stream) => {
    // Create a dedicated Redis subscriber client for streaming
    // Note: We keep direct Redis usage here since it's for streaming
    const redisSubscriber = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    const redisService = createRedisService(redisSubscriber);

    try {
      // Send initial job state
      const initialData = await redisService.get(`job:${jobId}`);

      if (initialData) {
        // Parse the data if it's a string
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
      } else {
        await stream.writeSSE({
          data: JSON.stringify({ id: jobId, status: "not_found" }),
        });
        stream.close();
        return;
      }

      // Subscribe to job update channel
      console.log(`[Stream] Subscribing to Redis channel job:${jobId}:updates`);
      await redisSubscriber.subscribe(`job:${jobId}:updates`);
      console.log(`[Stream] Successfully subscribed to job:${jobId}:updates`);

      // Set up message handler
      const messageHandler = async (_channel: string, message: string) => {
        console.log(`[Stream] Received message for job ${jobId}:`, message);

        try {
          const parsedMessage = JSON.parse(message);

          // Extract the actual job update data from the message structure
          const jobUpdate = parsedMessage.data || parsedMessage;

          console.log(`[Stream] Job update for ${jobId}:`, jobUpdate);

          // Send the job update to the client
          await stream.writeSSE({ data: JSON.stringify(jobUpdate) });
          console.log(`[Stream] Sent update to client for job ${jobId}`);

          // Check if job is completed or failed to close the stream
          if (
            jobUpdate.status === "completed" ||
            jobUpdate.status === "failed"
          ) {
            console.log(
              `[Stream] Job ${jobId} completed/failed, closing stream`,
            );
            setTimeout(() => {
              redisSubscriber.quit();
              stream.close();
            }, 100);
          }
        } catch (e) {
          console.error(`[Stream] Error parsing message for job ${jobId}:`, e);
          // Send the raw message if parsing fails
          await stream.writeSSE({ data: message });
        }
      };

      redisSubscriber.on("message", messageHandler);
      console.log(`[Stream] Message handler attached for job ${jobId}`);

      // Clean up when the stream is closed
      c.req.raw.signal.addEventListener("abort", () => {
        redisSubscriber.off("message", messageHandler);
        redisSubscriber.quit();
      });

      // Keep the connection alive with a heartbeat
      const heartbeatInterval = setInterval(async () => {
        await stream.writeSSE({
          event: "heartbeat",
          data: "", // Empty data for a heartbeat
        });
      }, 30000);

      // Clean up the heartbeat when the stream is closed
      c.req.raw.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
      });
    } catch (error) {
      console.error("Error in SSE stream:", error);
      await stream.writeSSE({
        data: JSON.stringify({ error: "Stream error" }),
      });
      redisSubscriber.quit();
      stream.close();
    }
  });
});

export { router as jobStreamingRouter };
