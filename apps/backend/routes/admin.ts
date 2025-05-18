// routes/admin.ts
import { Hono } from "hono";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { adminAuthMiddleware } from "../middleware/adminMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";
import { CacheService } from "../services/shared/CacheService";

export const adminRouter = new Hono<AppContext>();

// Apply IP, rate limiting, auth, and admin middleware to all routes
adminRouter.use("*", ip());
adminRouter.use(
  "*",
  rateLimit({
    maxRequests: 30, // 30 requests per minute for admin routes
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `admin:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);
adminRouter.use("*", authMiddleware);
adminRouter.use("*", adminAuthMiddleware);

adminRouter.get("/images/:id/image", async (c) => {
  try {
    const id = c.req.param("id");
    const eventService = c.get("eventService");
    const storageService = c.get("storageService"); // Make sure this is available in context

    const event = await eventService.getEventById(id);

    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    if (!event.originalImageUrl) {
      return c.json(
        { error: "No original image available for this event" },
        404,
      );
    }

    // Generate a signed URL that expires in 1 hour
    const signedUrl = await storageService.getSignedUrl(
      event.originalImageUrl,
      3600,
    );

    return c.json({
      eventId: event.id,
      originalImageUrl: signedUrl,
    });
  } catch (error) {
    console.error("Error fetching original image:", error);
    return c.json({ error: "Failed to fetch original image" }, 500);
  }
});

adminRouter.get("/cache/health", async (c) => {
  try {
    const stats = CacheService.getCacheStats();
    const redisClient = CacheService.getRedisClient();

    // Check Redis connection
    const redisStatus = redisClient
      ? (await redisClient.ping()) === "PONG"
      : false;

    return c.json({
      status: "healthy",
      stats,
      redis: {
        connected: redisStatus,
        memory: redisClient ? await redisClient.info("memory") : null,
      },
      memory: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
        rss: process.memoryUsage().rss,
      },
    });
  } catch (error) {
    console.error("Error checking cache health:", error);
    return c.json({ error: "Failed to check cache health" }, 500);
  }
});
