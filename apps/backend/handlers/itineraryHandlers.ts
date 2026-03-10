import type { Context } from "hono";
import type { AppContext } from "../types/context";

export const createItineraryHandler = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user?.userId && !user?.id) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userId = user.userId || user.id;

  const body = await c.req.json<{
    city: string;
    plannedDate: string;
    budgetMin?: number;
    budgetMax?: number;
    durationHours: number;
    activityTypes?: string[];
    stopCount?: number;
    ritualId?: string;
  }>();

  if (!body.city || typeof body.city !== "string") {
    return c.json({ error: "city is required" }, 400);
  }
  if (!body.plannedDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.plannedDate)) {
    return c.json({ error: "plannedDate must be YYYY-MM-DD" }, 400);
  }
  if (
    typeof body.durationHours !== "number" ||
    body.durationHours < 0.5 ||
    body.durationHours > 24
  ) {
    return c.json({ error: "durationHours must be between 0.5 and 24" }, 400);
  }

  const jobQueue = c.get("jobQueue");

  try {
    const jobId = await jobQueue.enqueue("generate_itinerary", {
      userId,
      creatorId: userId,
      city: body.city,
      plannedDate: body.plannedDate,
      budgetMin: body.budgetMin ?? 0,
      budgetMax: body.budgetMax ?? 0,
      durationHours: body.durationHours,
      activityTypes: body.activityTypes ?? [],
      stopCount: body.stopCount ?? 0,
    });

    // Record ritual usage if this itinerary was created from one
    if (body.ritualId) {
      const ritualService = c.get("itineraryRitualService");
      ritualService.recordUsage(body.ritualId, userId).catch((err) => {
        console.warn("[Itinerary] Failed to record ritual usage:", err);
      });
    }

    return c.json(
      {
        jobId,
        streamUrl: `/api/jobs/${jobId}/stream`,
      },
      202,
    );
  } catch (error) {
    console.error("[Itinerary] Failed to enqueue job:", error);
    return c.json({ error: "Failed to start itinerary generation" }, 500);
  }
};

export const listItinerariesHandler = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user?.userId && !user?.id) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userId = user.userId || user.id;

  const limit = parseInt(c.req.query("limit") || "20");
  const cursor = c.req.query("cursor") || undefined;
  const itineraryService = c.get("itineraryService");

  const result = await itineraryService.listByUser(
    userId,
    Math.min(limit, 50),
    cursor,
  );
  return c.json(result);
};

export const getItineraryHandler = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user?.userId && !user?.id) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userId = user.userId || user.id;

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const itineraryService = c.get("itineraryService");
  const itinerary = await itineraryService.getById(id, userId);

  if (!itinerary) {
    return c.json({ error: "Itinerary not found" }, 404);
  }

  return c.json(itinerary);
};

export const shareItineraryHandler = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user?.userId && !user?.id) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userId = user.userId || user.id;

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const itineraryService = c.get("itineraryService");
  const shareToken = await itineraryService.generateShareToken(id, userId);

  if (!shareToken) {
    return c.json({ error: "Itinerary not found" }, 404);
  }

  return c.json({ shareToken });
};

export const getSharedItineraryHandler = async (c: Context<AppContext>) => {
  const shareToken = c.req.param("shareToken");
  if (!shareToken) {
    return c.json({ error: "shareToken is required" }, 400);
  }

  const itineraryService = c.get("itineraryService");
  const itinerary = await itineraryService.getByShareToken(shareToken);

  if (!itinerary) {
    return c.json({ error: "Itinerary not found" }, 404);
  }

  // Strip userId for public response
  const { userId, ...safeItinerary } = itinerary as any;
  return c.json(safeItinerary);
};

export const activateItineraryHandler = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user?.userId && !user?.id) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userId = user.userId || user.id;

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const checkinService = c.get("itineraryCheckinService");
  const activated = await checkinService.activateItinerary(userId, id);

  if (!activated) {
    return c.json({ error: "Itinerary not found or not ready" }, 404);
  }

  return c.json({ success: true });
};

export const deactivateItineraryHandler = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user?.userId && !user?.id) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userId = user.userId || user.id;

  const checkinService = c.get("itineraryCheckinService");
  await checkinService.deactivateItinerary(userId);

  return c.json({ success: true });
};

export const getActiveItineraryHandler = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user?.userId && !user?.id) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userId = user.userId || user.id;

  const checkinService = c.get("itineraryCheckinService");
  const itinerary = await checkinService.getActiveItinerary(userId);

  if (!itinerary) {
    return c.json({ active: false });
  }

  return c.json({ active: true, itinerary });
};

export const checkinItineraryItemHandler = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user?.userId && !user?.id) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userId = user.userId || user.id;

  const id = c.req.param("id");
  const itemId = c.req.param("itemId");
  if (!id || !itemId) {
    return c.json({ error: "id and itemId are required" }, 400);
  }

  const checkinService = c.get("itineraryCheckinService");
  const result = await checkinService.manualCheckin(userId, id, itemId);

  if (!result.success) {
    return c.json({ error: "Item not found" }, 404);
  }

  return c.json({ success: true, checkedInAt: result.checkedInAt });
};

export const deleteItineraryHandler = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user?.userId && !user?.id) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userId = user.userId || user.id;

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const itineraryService = c.get("itineraryService");
  const deleted = await itineraryService.deleteById(id, userId);

  if (!deleted) {
    return c.json({ error: "Itinerary not found" }, 404);
  }

  return c.json({ success: true });
};
