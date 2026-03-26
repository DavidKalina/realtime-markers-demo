import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";
import { toDate } from "date-fns-tz";

export const createItineraryHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

  const itineraryService = c.get("itineraryService");

  const body = await c.req.json<{
    city: string;
    plannedDate?: string;
    budgetMin?: number;
    budgetMax?: number;
    durationHours?: number;
    activityTypes?: string[];
    stopCount?: number;
    startTime?: string;
    endTime?: string;
    intention?: string;
    title?: string;
    surpriseMe?: boolean;
    timezone?: string;
    isTemplate?: boolean;
    constraints?: Record<string, unknown>;
    anchorStops?: {
      coordinates: [number, number];
      label?: string;
      address?: string;
      placeId?: string;
      primaryType?: string;
      rating?: number;
      note?: string;
    }[];
  }>();

  const isTemplate = body.isTemplate === true;
  const hasAnchors =
    Array.isArray(body.anchorStops) && body.anchorStops.length > 0;
  if (!hasAnchors && (!body.city || typeof body.city !== "string")) {
    return c.json({ error: "city is required" }, 400);
  }

  // Resolve planned date — optional for templates
  let resolvedPlannedDate: Date | undefined;
  if (body.plannedDate) {
    // Accept YYYY-MM-DD (convert to midnight in provided timezone) or full ISO 8601
    if (/^\d{4}-\d{2}-\d{2}$/.test(body.plannedDate)) {
      const tz = body.timezone || "UTC";
      resolvedPlannedDate = toDate(`${body.plannedDate}T00:00:00`, {
        timeZone: tz,
      });
    } else {
      resolvedPlannedDate = new Date(body.plannedDate);
    }
    if (isNaN(resolvedPlannedDate.getTime())) {
      return c.json(
        { error: "plannedDate must be a valid ISO 8601 date string" },
        400,
      );
    }
  } else if (!isTemplate) {
    return c.json({ error: "plannedDate is required for non-template itineraries" }, 400);
  }

  // durationHours defaults to 4 for templates
  const durationHours = body.durationHours ?? (isTemplate ? 4 : 0);
  if (durationHours < 0.5 || durationHours > 24) {
    return c.json({ error: "durationHours must be between 0.5 and 24" }, 400);
  }

  // Create shell itinerary record upfront so we have an ID immediately
  const shell = await itineraryService.createShell(userId, {
    city: body.city || "",
    plannedDate: resolvedPlannedDate,
    budgetMin: body.budgetMin ?? 0,
    budgetMax: body.budgetMax ?? (isTemplate ? 100 : 0),
    durationHours,
    activityTypes: body.activityTypes ?? [],
    intention: body.intention,
    title: body.title,
    isTemplate,
    constraints: body.constraints,
  });

  const jobQueue = c.get("jobQueue");

  const jobId = await jobQueue.enqueue("generate_itinerary", {
    userId,
    creatorId: userId,
    itineraryId: shell.id,
    city: body.city || "",
    ...(resolvedPlannedDate && { plannedDate: resolvedPlannedDate }),
    budgetMin: body.budgetMin ?? 0,
    budgetMax: body.budgetMax ?? (isTemplate ? 100 : 0),
    durationHours,
    activityTypes: body.activityTypes ?? [],
    stopCount: body.stopCount ?? 0,
    isTemplate,
    ...(body.constraints && { constraints: body.constraints }),
    ...(body.timezone && { timezone: body.timezone }),
    ...(body.startTime && { startTime: body.startTime }),
    ...(body.endTime && { endTime: body.endTime }),
    ...(body.intention && { intention: body.intention }),
    ...(body.title && { title: body.title }),
    ...(body.surpriseMe && { surpriseMe: true }),
    ...(body.anchorStops &&
      body.anchorStops.length > 0 && {
        anchorStops: body.anchorStops.map((a) => ({
          coordinates: a.coordinates,
          label: a.label,
          address: a.address,
          placeId: a.placeId,
          primaryType: a.primaryType,
          rating: a.rating,
          note: a.note,
        })),
      }),
  });

  return c.json(
    {
      itineraryId: shell.id,
      jobId,
      streamUrl: `/api/jobs/${jobId}/stream`,
    },
    202,
  );
});

export const listItinerariesHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 50);
  const cursor = c.req.query("cursor") || undefined;
  const sortParam = c.req.query("sort") || undefined;
  const intention = c.req.query("intention") || undefined;
  const statusParam = c.req.query("status") || undefined;

  const validSorts = ["newest", "oldest", "upcoming", "top_rated"] as const;
  const sort = validSorts.includes(sortParam as (typeof validSorts)[number])
    ? (sortParam as (typeof validSorts)[number])
    : undefined;

  const validStatuses = ["completed", "upcoming"] as const;
  const status = validStatuses.includes(
    statusParam as (typeof validStatuses)[number],
  )
    ? (statusParam as (typeof validStatuses)[number])
    : undefined;

  const itineraryService = c.get("itineraryService");

  const result = await itineraryService.listByUser(userId, {
    limit,
    cursor,
    sort,
    intention,
    status,
  });
  return c.json(result);
});

export const getItineraryHandler: Handler = withErrorHandling(async (c) => {
  requireAuth(c);

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const itineraryService = c.get("itineraryService");
  const itinerary = await itineraryService.getById(id);

  if (!itinerary) {
    return c.json({ error: "Itinerary not found" }, 404);
  }

  return c.json(itinerary);
});

export const shareItineraryHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

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
});

export const getSharedItineraryHandler: Handler = withErrorHandling(
  async (c) => {
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
    const { userId: _, ...safeItinerary } = itinerary as any;
    return c.json(safeItinerary);
  },
);

export const activateItineraryHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const userId = user.id;

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
  },
);

export const deactivateItineraryHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const userId = user.id;

    const checkinService = c.get("itineraryCheckinService");
    await checkinService.deactivateItinerary(userId);

    return c.json({ success: true });
  },
);

export const getActiveItineraryHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const userId = user.id;

    const checkinService = c.get("itineraryCheckinService");
    const itinerary = await checkinService.getActiveItinerary(userId);

    if (!itinerary) {
      return c.json({ active: false });
    }

    return c.json({ active: true, itinerary });
  },
);

export const checkinItineraryItemHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const userId = user.id;

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
  },
);

export const deleteItineraryHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

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
});

export const rateItineraryHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

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
});

export const listCompletedHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 50);
  const itineraryService = c.get("itineraryService");
  const data = await itineraryService.listCompleted(userId, limit);

  return c.json({ data });
});

export const browseItinerariesHandler: Handler = withErrorHandling(
  async (c) => {
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
  },
);

export const adoptItineraryHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const itineraryService = c.get("itineraryService");
  const itinerary = await itineraryService.adoptItinerary(id, userId);
  return c.json(itinerary, 201);
});

export const getPopularStopsHandler: Handler = withErrorHandling(async (c) => {
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
});
