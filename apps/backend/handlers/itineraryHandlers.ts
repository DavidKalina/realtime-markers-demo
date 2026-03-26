import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";
import { toDate } from "date-fns-tz";

const MAX_ITINERARIES_PER_DAY = 3;
const MAX_SIDEQUESTS_PER_DAY = 20;

export const createItineraryHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

  // Enforce daily itinerary creation cap (applies to all users including admins)
  const itineraryService = c.get("itineraryService");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayCount = await itineraryService.countCreatedSince(userId, since);
  if (todayCount >= MAX_ITINERARIES_PER_DAY) {
    return c.json(
      {
        error: `You can create up to ${MAX_ITINERARIES_PER_DAY} itineraries per day. Please try again later.`,
      },
      429,
    );
  }

  const body = await c.req.json<{
    city: string;
    plannedDate: string;
    budgetMin?: number;
    budgetMax?: number;
    durationHours: number;
    activityTypes?: string[];
    stopCount?: number;
    startTime?: string;
    endTime?: string;
    intention?: string;
    title?: string;
    surpriseMe?: boolean;
    timezone?: string;
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

  const hasAnchors =
    Array.isArray(body.anchorStops) && body.anchorStops.length > 0;
  if (!hasAnchors && (!body.city || typeof body.city !== "string")) {
    return c.json({ error: "city is required" }, 400);
  }
  if (!body.plannedDate) {
    return c.json({ error: "plannedDate is required" }, 400);
  }
  // Accept YYYY-MM-DD (convert to midnight in provided timezone) or full ISO 8601
  let resolvedPlannedDate: Date;
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
  if (
    typeof body.durationHours !== "number" ||
    body.durationHours < 0.5 ||
    body.durationHours > 24
  ) {
    return c.json({ error: "durationHours must be between 0.5 and 24" }, 400);
  }

  // Create shell itinerary record upfront so we have an ID immediately
  const shell = await itineraryService.createShell(userId, {
    city: body.city || "",
    plannedDate: resolvedPlannedDate,
    budgetMin: body.budgetMin ?? 0,
    budgetMax: body.budgetMax ?? 0,
    durationHours: body.durationHours,
    activityTypes: body.activityTypes ?? [],
    intention: body.intention,
    title: body.title,
  });

  const jobQueue = c.get("jobQueue");

  const jobId = await jobQueue.enqueue("generate_itinerary", {
    userId,
    creatorId: userId,
    itineraryId: shell.id,
    city: body.city || "",
    plannedDate: resolvedPlannedDate,
    budgetMin: body.budgetMin ?? 0,
    budgetMax: body.budgetMax ?? 0,
    durationHours: body.durationHours,
    activityTypes: body.activityTypes ?? [],
    stopCount: body.stopCount ?? 0,
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

export const createSidequestHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

  const itineraryService = c.get("itineraryService");

  const body = await c.req.json<{
    prompt: string;
    radiusMiles: number;
    budgetMax: number;
    latitude: number;
    longitude: number;
    timezone?: string;
  }>();

  // Validate inputs
  if (typeof body.prompt !== "string" || body.prompt.length > 200) {
    return c.json(
      { error: "prompt must be a string of 200 characters or fewer" },
      400,
    );
  }
  if (
    typeof body.radiusMiles !== "number" ||
    body.radiusMiles < 0.5 ||
    body.radiusMiles > 25
  ) {
    return c.json(
      { error: "radiusMiles must be a number between 0.5 and 25" },
      400,
    );
  }
  if (
    typeof body.budgetMax !== "number" ||
    body.budgetMax < 0 ||
    body.budgetMax > 500
  ) {
    return c.json(
      { error: "budgetMax must be a number between 0 and 500" },
      400,
    );
  }
  if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
    return c.json({ error: "latitude and longitude are required" }, 400);
  }

  // Create shell record
  const shell = await itineraryService.createSidequestShell(userId, {
    prompt: body.prompt,
    radiusMiles: body.radiusMiles,
    budgetMax: body.budgetMax,
    latitude: body.latitude,
    longitude: body.longitude,
    timezone: body.timezone,
  });

  // Enqueue generation job
  const jobQueue = c.get("jobQueue");
  const jobId = await jobQueue.enqueue("generate_sidequest", {
    userId,
    creatorId: userId,
    itineraryId: shell.id,
    prompt: body.prompt,
    radiusMiles: body.radiusMiles,
    budgetMax: body.budgetMax,
    latitude: body.latitude,
    longitude: body.longitude,
    ...(body.timezone && { timezone: body.timezone }),
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
