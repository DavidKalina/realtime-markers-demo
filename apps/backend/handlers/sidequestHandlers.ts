import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";
import type { SidequestService } from "../services/SidequestService";
import type { SidequestCheckinService } from "../services/SidequestCheckinService";

const MAX_SIDEQUESTS_PER_DAY = 20;

export const createSidequestHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

  const sidequestService = c.get("sidequestService") as SidequestService;

  const body = await c.req.json<{
    prompt: string;
    radiusMiles: number;
    budgetMax: number;
    latitude: number;
    longitude: number;
    timezone?: string;
    activityTypes?: string[];
    intention?: string;
    city?: string;
    surpriseMe?: boolean;
    note?: string;
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
    body.radiusMiles > 50
  ) {
    return c.json(
      { error: "radiusMiles must be a number between 0.5 and 50" },
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
  const shell = await sidequestService.createShell(userId, {
    prompt: body.prompt,
    radiusMiles: body.radiusMiles,
    budgetMax: body.budgetMax,
    latitude: body.latitude,
    longitude: body.longitude,
    timezone: body.timezone,
    activityTypes: body.activityTypes,
    intention: body.intention,
    city: body.city,
    surpriseMe: body.surpriseMe,
    note: body.note,
  });

  // Enqueue generation job
  const jobQueue = c.get("jobQueue");
  const jobId = await jobQueue.enqueue("generate_sidequest", {
    userId,
    creatorId: userId,
    sidequestId: shell.id,
    prompt: body.prompt,
    radiusMiles: body.radiusMiles,
    budgetMax: body.budgetMax,
    latitude: body.latitude,
    longitude: body.longitude,
    ...(body.timezone && { timezone: body.timezone }),
    ...(body.activityTypes && { activityTypes: body.activityTypes }),
    ...(body.intention && { intention: body.intention }),
    ...(body.city && { city: body.city }),
    ...(body.surpriseMe && { surpriseMe: body.surpriseMe }),
    ...(body.note && { note: body.note }),
  });

  return c.json(
    {
      sidequestId: shell.id,
      jobId,
      streamUrl: `/api/jobs/${jobId}/stream`,
    },
    202,
  );
});

export const listSidequestsHandler: Handler = withErrorHandling(async (c) => {
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

  const sidequestService = c.get("sidequestService") as SidequestService;

  const result = await sidequestService.listByUser(userId, {
    limit,
    cursor,
    sort,
    intention,
    status,
  });
  return c.json(result);
});

export const getSidequestHandler: Handler = withErrorHandling(async (c) => {
  requireAuth(c);

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const sidequestService = c.get("sidequestService") as SidequestService;
  const sidequest = await sidequestService.getById(id);

  if (!sidequest) {
    return c.json({ error: "Sidequest not found" }, 404);
  }

  return c.json(sidequest);
});

export const deleteSidequestHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const sidequestService = c.get("sidequestService") as SidequestService;
  const deleted = await sidequestService.deleteById(id, userId);

  if (!deleted) {
    return c.json({ error: "Sidequest not found" }, 404);
  }

  return c.json({ success: true });
});

export const shareSidequestHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const sidequestService = c.get("sidequestService") as SidequestService;
  const shareToken = await sidequestService.generateShareToken(id, userId);

  if (!shareToken) {
    return c.json({ error: "Sidequest not found" }, 404);
  }

  return c.json({ shareToken });
});

export const getSharedSidequestHandler: Handler = withErrorHandling(
  async (c) => {
    const shareToken = c.req.param("shareToken");
    if (!shareToken) {
      return c.json({ error: "shareToken is required" }, 400);
    }

    const sidequestService = c.get("sidequestService") as SidequestService;
    const sidequest = await sidequestService.getByShareToken(shareToken);

    if (!sidequest) {
      return c.json({ error: "Sidequest not found" }, 404);
    }

    // Strip userId for public response
    const { userId: _, ...safeSidequest } = sidequest as any;
    return c.json(safeSidequest);
  },
);

export const activateSidequestHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const userId = user.id;

    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "id is required" }, 400);
    }

    const sidequestCheckinService = c.get("sidequestCheckinService") as SidequestCheckinService;
    const activated = await sidequestCheckinService.activateSidequest(userId, id);

    if (!activated) {
      return c.json({ error: "Sidequest not found or not ready" }, 404);
    }

    return c.json({ success: true });
  },
);

export const deactivateSidequestHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const userId = user.id;

    const sidequestCheckinService = c.get("sidequestCheckinService") as SidequestCheckinService;
    await sidequestCheckinService.deactivateSidequest(userId);

    return c.json({ success: true });
  },
);

export const getActiveSidequestHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const userId = user.id;

    const sidequestCheckinService = c.get("sidequestCheckinService") as SidequestCheckinService;
    const sidequest = await sidequestCheckinService.getActiveSidequest(userId);

    if (!sidequest) {
      return c.json({ active: false });
    }

    return c.json({ active: true, sidequest });
  },
);

export const checkinObjectiveHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const userId = user.id;

    const id = c.req.param("id");
    const objectiveId = c.req.param("objectiveId");
    if (!id || !objectiveId) {
      return c.json({ error: "id and objectiveId are required" }, 400);
    }

    const sidequestCheckinService = c.get("sidequestCheckinService") as SidequestCheckinService;
    const result = await sidequestCheckinService.manualCheckin(userId, id, objectiveId);

    if (!result.success) {
      return c.json({ error: "Objective not found" }, 404);
    }

    return c.json({ success: true, checkedInAt: result.checkedInAt });
  },
);

export const rateSidequestHandler: Handler = withErrorHandling(async (c) => {
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

  const sidequestService = c.get("sidequestService") as SidequestService;
  const result = await sidequestService.rate(
    id,
    userId,
    body.rating,
    body.comment,
  );

  if (!result) {
    return c.json({ error: "Sidequest not found or not completed" }, 404);
  }

  return c.json({ success: true, rating: result.rating });
});

export const listCompletedHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 50);
  const sidequestService = c.get("sidequestService") as SidequestService;
  const data = await sidequestService.listCompleted(userId, limit);

  return c.json({ data });
});

export const browseSidequestsHandler: Handler = withErrorHandling(
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

    // Optionally exclude current user's own sidequests
    const user = c.get("user");
    const excludeUserId = user?.userId || user?.id || undefined;

    const sidequestService = c.get("sidequestService") as SidequestService;
    const data = await sidequestService.browsePublished({
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

export const getPopularStopsHandler: Handler = withErrorHandling(async (c) => {
  const city = c.req.query("city");
  if (!city || typeof city !== "string") {
    return c.json({ error: "city query parameter is required" }, 400);
  }

  const limit = Math.min(parseInt(c.req.query("limit") || "15", 10), 30);
  const sidequestService = c.get("sidequestService") as SidequestService;
  const stops = await sidequestService.getPopularStops(
    decodeURIComponent(city),
    limit,
  );

  return c.json({ data: stops });
});

export const getSidequestOptionsHandler: Handler = withErrorHandling(
  async (c) => {
    requireAuth(c);

    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "id is required" }, 400);
    }

    const sidequestService = c.get("sidequestService") as SidequestService;
    const children = await sidequestService.getOptions(id);

    return c.json({ data: children });
  },
);

export const selectSidequestOptionHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const userId = user.id;

    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "id is required" }, 400);
    }

    const sidequestService = c.get("sidequestService") as SidequestService;
    await sidequestService.selectOption(id, userId);

    return c.json({ success: true });
  },
);
