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
    startTime?: string;
    endTime?: string;
    intention?: string;
    anchorStops?: {
      coordinates: [number, number];
      label?: string;
      address?: string;
      placeId?: string;
      primaryType?: string;
      rating?: number;
    }[];
  }>();

  const hasAnchors =
    Array.isArray(body.anchorStops) && body.anchorStops.length > 0;
  if (!hasAnchors && (!body.city || typeof body.city !== "string")) {
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
      city: body.city || "",
      plannedDate: body.plannedDate,
      budgetMin: body.budgetMin ?? 0,
      budgetMax: body.budgetMax ?? 0,
      durationHours: body.durationHours,
      activityTypes: body.activityTypes ?? [],
      stopCount: body.stopCount ?? 0,
      ...(body.startTime && { startTime: body.startTime }),
      ...(body.endTime && { endTime: body.endTime }),
      ...(body.intention && { intention: body.intention }),
      ...(body.anchorStops &&
        body.anchorStops.length > 0 && {
          anchorStops: body.anchorStops.map((a) => ({
            coordinates: a.coordinates,
            label: a.label,
            address: a.address,
            placeId: a.placeId,
            primaryType: a.primaryType,
            rating: a.rating,
          })),
        }),
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

export const rateItineraryHandler = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user?.userId && !user?.id) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userId = user.userId || user.id;

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const body = await c.req.json<{ rating: number; comment?: string }>();
  if (
    typeof body.rating !== "number" ||
    body.rating < 1 ||
    body.rating > 5 ||
    !Number.isInteger(body.rating)
  ) {
    return c.json({ error: "rating must be an integer between 1 and 5" }, 400);
  }

  const itineraryService = c.get("itineraryService");
  const result = await itineraryService.rateItinerary(
    id,
    userId,
    body.rating,
    body.comment,
  );

  if (!result) {
    return c.json({ error: "Itinerary not found or not completed" }, 404);
  }

  return c.json({ success: true, rating: result.rating });
};

export const listCompletedHandler = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user?.userId && !user?.id) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userId = user.userId || user.id;

  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 50);
  const itineraryService = c.get("itineraryService");
  const data = await itineraryService.listCompleted(userId, limit);

  return c.json({ data });
};

export const browseItinerariesHandler = async (c: Context<AppContext>) => {
  const city = c.req.query("city");
  if (!city || typeof city !== "string") {
    return c.json({ error: "city query parameter is required" }, 400);
  }

  const sort = (c.req.query("sort") || "popular") as
    | "popular"
    | "recent"
    | "top_rated";
  const intention = c.req.query("intention") || undefined;
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 50);
  const cursor = c.req.query("cursor") || undefined;

  // Optionally exclude current user's own itineraries
  const user = c.get("user");
  const excludeUserId = user?.userId || user?.id || undefined;

  const itineraryService = c.get("itineraryService");
  const data = await itineraryService.browsePublished({
    city: decodeURIComponent(city),
    sort,
    intention,
    limit,
    cursor,
    excludeUserId,
  });

  return c.json({ data });
};

export const adoptItineraryHandler = async (c: Context<AppContext>) => {
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
  try {
    const itinerary = await itineraryService.adoptItinerary(id, userId);
    return c.json(itinerary, 201);
  } catch {
    return c.json({ error: "Itinerary not found or not available" }, 404);
  }
};

export const getPopularStopsHandler = async (c: Context<AppContext>) => {
  const city = c.req.query("city");
  if (!city || typeof city !== "string") {
    return c.json({ error: "city query parameter is required" }, 400);
  }

  const limit = Math.min(parseInt(c.req.query("limit") || "15", 10), 30);
  const itineraryService = c.get("itineraryService");
  const stops = await itineraryService.getPopularStops(
    decodeURIComponent(city),
    limit,
  );

  return c.json({ data: stops });
};
