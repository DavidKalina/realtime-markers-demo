// routes/admin.ts
import { Hono } from "hono";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { adminAuthMiddleware } from "../middleware/adminMiddleware";
import { StorageService } from "../services/shared/StorageService";

export const adminRouter = new Hono<AppContext>();

// Apply auth middleware to all routes
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
      return c.json({ error: "No original image available for this event" }, 404);
    }

    // Generate a signed URL that expires in 1 hour
    const signedUrl = await storageService.getSignedUrl(event.originalImageUrl, 3600);

    return c.json({
      eventId: event.id,
      originalImageUrl: signedUrl,
    });
  } catch (error) {
    console.error("Error fetching original image:", error);
    return c.json({ error: "Failed to fetch original image" }, 500);
  }
});
