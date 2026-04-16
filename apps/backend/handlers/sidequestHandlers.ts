import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";
import type { SidequestService } from "../services/SidequestService";
import type { SidequestCheckinService } from "../services/SidequestCheckinService";
import type { ComfortZoneService } from "../services/ComfortZoneService";
import { RejectionReason } from "../entities/SidequestRejection";

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

  // Replenish deck if below target
  const sidequestCheckinService = c.get("sidequestCheckinService") as SidequestCheckinService;
  sidequestCheckinService.replenishDeck(userId);

  return c.json({ success: true });
});

export const batchDeleteSidequestHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const userId = user.id;

    const body = await c.req.json<{ ids: unknown }>();
    const { ids } = body;

    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > 50 ||
      !ids.every((id) => typeof id === "string")
    ) {
      return c.json(
        { error: "ids must be a non-empty array of strings (max 50)" },
        400,
      );
    }

    const sidequestService = c.get("sidequestService") as SidequestService;
    const deletedCount = await sidequestService.deleteByIds(
      ids as string[],
      userId,
    );

    // Replenish deck if below target
    const sidequestCheckinService = c.get("sidequestCheckinService") as SidequestCheckinService;
    sidequestCheckinService.replenishDeck(userId);

    return c.json({ success: true, deletedCount });
  },
);

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

    // Body is optional — legacy clients still POST empty. Newer clients
    // send lat/lng so the server can distance-validate the check-in.
    let userLocation: { latitude: number; longitude: number } | undefined;
    try {
      const body = await c.req.json<{ latitude?: number; longitude?: number }>();
      if (
        typeof body?.latitude === "number" &&
        typeof body?.longitude === "number"
      ) {
        userLocation = { latitude: body.latitude, longitude: body.longitude };
      }
    } catch {
      // No body — fall through as pre-location client.
    }

    const sidequestCheckinService = c.get("sidequestCheckinService") as SidequestCheckinService;
    const result = await sidequestCheckinService.manualCheckin(
      userId,
      id,
      objectiveId,
      userLocation,
    );

    if (!result.success) {
      if (result.tooFar) {
        return c.json(
          { error: "You're too far from this location to check in." },
          403,
        );
      }
      return c.json({ error: "Objective not found" }, 404);
    }

    return c.json({ success: true, checkedInAt: result.checkedInAt });
  },
);

export const completeChallengeHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const userId = user.id;

    const id = c.req.param("id");
    const objectiveId = c.req.param("objectiveId");
    if (!id || !objectiveId) {
      return c.json({ error: "id and objectiveId are required" }, 400);
    }

    const body = await c.req.json<{
      journalEntry: string;
      completedActivity?: string;
      socialContext?: string;
      completedVersion?: string;
      latitude?: number;
      longitude?: number;
    }>();

    const userLocation =
      typeof body.latitude === "number" && typeof body.longitude === "number"
        ? { latitude: body.latitude, longitude: body.longitude }
        : undefined;

    // Reflection gate: require a meaningful journal entry
    if (!body.journalEntry?.trim() || body.journalEntry.trim().length < 20) {
      return c.json(
        { error: "A meaningful reflection is required to complete a challenge (at least 20 characters)" },
        400,
      );
    }

    if (body.journalEntry.length > 2000) {
      return c.json({ error: "journalEntry must be 2000 characters or fewer" }, 400);
    }

    const validSocialContexts = ["solo", "with_someone", "met_someone_new", "group_activity"];
    if (body.socialContext && !validSocialContexts.includes(body.socialContext)) {
      return c.json({ error: `socialContext must be one of: ${validSocialContexts.join(", ")}` }, 400);
    }
    const validVersions = ["full", "smaller", "tiny"] as const;
    if (body.completedVersion && !validVersions.includes(body.completedVersion as (typeof validVersions)[number])) {
      return c.json({ error: `completedVersion must be one of: ${validVersions.join(", ")}` }, 400);
    }

    // 1. Save journal entry (triggers async LLM reflection analysis)
    const comfortZoneService = c.get("comfortZoneService") as ComfortZoneService;
    const updated = await comfortZoneService.updateObjectiveJournal(
      userId,
      objectiveId,
      {
        journalEntry: body.journalEntry,
        completedActivity: body.completedActivity,
        socialContext: body.socialContext,
        completedVersion: body.completedVersion as "full" | "smaller" | "tiny" | undefined,
      },
    );

    if (!updated) {
      return c.json({ error: "Objective not found or not authorized" }, 404);
    }

    // 2. Mark checked in (triggers sidequest completion if last objective)
    const sidequestCheckinService = c.get("sidequestCheckinService") as SidequestCheckinService;
    const result = await sidequestCheckinService.manualCheckin(
      userId,
      id,
      objectiveId,
      userLocation,
    );

    if (!result.success) {
      if (result.tooFar) {
        return c.json(
          { error: "You're too far from this location to complete the challenge." },
          403,
        );
      }
      return c.json({ error: "Failed to complete challenge" }, 500);
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

export const listUnratedHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

  const limit = Math.min(parseInt(c.req.query("limit") || "5", 10), 10);
  const sidequestService = c.get("sidequestService") as SidequestService;
  const data = await sidequestService.listUnrated(userId, limit);

  return c.json({ data });
});

export const listPendingCaptureHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

  const limit = Math.min(parseInt(c.req.query("limit") || "3", 10), 5);
  const sidequestService = c.get("sidequestService") as SidequestService;
  const data = await sidequestService.listPendingCapture(userId, limit);

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

export const promoteSidequestHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const sidequestService = c.get("sidequestService") as SidequestService;
  try {
    const sidequest = await sidequestService.promote(id, user.id);
    return c.json(sidequest);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Promotion failed";
    return c.json({ error: message }, 400);
  }
});

export const searchSidequestsHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

  const q = c.req.query("q");
  if (!q || typeof q !== "string" || q.trim().length === 0) {
    return c.json({ error: "q query parameter is required" }, 400);
  }
  if (q.length > 200) {
    return c.json({ error: "q must be 200 characters or fewer" }, 400);
  }

  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 50);
  const sidequestService = c.get("sidequestService") as SidequestService;
  const data = await sidequestService.searchByUser(userId, q.trim(), limit);

  return c.json({ data });
});

export const getDeckStatsHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const sidequestService = c.get("sidequestService") as SidequestService;
  const stats = await sidequestService.getDeckStats(user.id);
  return c.json(stats);
});

export const getCapacityRepsHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const sidequestService = c.get("sidequestService") as SidequestService;
  const data = await sidequestService.getCapacityReps(user.id);
  return c.json({ data });
});

// ─── Wellness Pivot Handlers ───────────────────────────────────────

const DAILY_PRESCRIBE_LIMIT = 3;
// In-flight dedup window. Long enough to cover a typical prescription job,
// short enough that a legitimate follow-up tap isn't blocked. Mirrors the
// auto-prescribe lock in SidequestCheckinService.
const PRESCRIBE_INFLIGHT_TTL_SECONDS = 90;

export const prescribeQuestHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

  const body = await c.req.json<{
    latitude: number;
    longitude: number;
    timezone?: string;
    model?: string;
    questType?: "venue" | "challenge";
    challengeCategory?: string;
  }>();

  if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
    return c.json({ error: "latitude and longitude are required" }, 400);
  }

  const validChallengeCategories = ["social_reach", "vulnerability", "hosting", "reconnection"];
  if (body.questType === "challenge" && body.challengeCategory && !validChallengeCategories.includes(body.challengeCategory)) {
    return c.json({ error: `challengeCategory must be one of: ${validChallengeCategories.join(", ")}` }, 400);
  }

  // Daily cooldown — count prescribed quests created today
  const sidequestService = c.get("sidequestService") as SidequestService;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = await sidequestService.countCreatedSince(userId, todayStart);
  if (todayCount >= DAILY_PRESCRIBE_LIMIT) {
    return c.json(
      {
        error: `You've reached your daily limit of ${DAILY_PRESCRIBE_LIMIT} quests. Come back tomorrow!`,
        remaining: 0,
      },
      429,
    );
  }

  // In-flight dedup. Frontend has multiple paths that can fire prescribe
  // during the onboarding→dashboard handoff (the post-onboarding call plus
  // the empty-deck fallback in UserProfile). Reserve a per-user slot so
  // racing requests collapse onto the original job.
  const redisService = c.get("redisService");
  const client = redisService.getClient();
  const lockKey = `prescribe-quest-inflight:${userId}`;
  const reserved = await client.set(lockKey, "RESERVED", "EX", PRESCRIBE_INFLIGHT_TTL_SECONDS, "NX");
  if (!reserved) {
    const existingJobId = await client.get(lockKey);
    const inflightJobId = existingJobId && existingJobId !== "RESERVED" ? existingJobId : null;
    return c.json(
      {
        jobId: inflightJobId,
        streamUrl: inflightJobId ? `/api/jobs/${inflightJobId}/stream` : undefined,
        deduplicated: true,
        remaining: DAILY_PRESCRIBE_LIMIT - todayCount,
      },
      202,
    );
  }

  // Enqueue prescription job
  const jobQueue = c.get("jobQueue");
  let jobId: string;
  try {
    jobId = await jobQueue.enqueue("prescribe_quest", {
      userId,
      creatorId: userId,
      latitude: body.latitude,
      longitude: body.longitude,
      ...(body.timezone && { timezone: body.timezone }),
      ...(body.model && { model: body.model }),
      ...(body.questType && { questType: body.questType }),
      ...(body.challengeCategory && { challengeCategory: body.challengeCategory }),
    });
  } catch (err) {
    await client.del(lockKey);
    throw err;
  }

  // Stash the real jobId so racing callers can subscribe to the same stream.
  await client.set(lockKey, jobId, "EX", PRESCRIBE_INFLIGHT_TTL_SECONDS);

  return c.json(
    {
      jobId,
      streamUrl: `/api/jobs/${jobId}/stream`,
      remaining: DAILY_PRESCRIBE_LIMIT - todayCount - 1,
    },
    202,
  );
});

export const rejectQuestHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const body = await c.req.json<{
    reason: string;
    latitude: number;
    longitude: number;
    timezone?: string;
    note?: string;
  }>();

  if (!body.reason || !Object.values(RejectionReason).includes(body.reason as RejectionReason)) {
    return c.json(
      { error: `reason must be one of: ${Object.values(RejectionReason).join(", ")}` },
      400,
    );
  }
  if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
    return c.json({ error: "latitude and longitude are required" }, 400);
  }
  if (body.note && body.note.length > 500) {
    return c.json({ error: "note must be 500 characters or fewer" }, 400);
  }

  const sidequestService = c.get("sidequestService") as SidequestService;
  const rejection = await sidequestService.recordRejection(
    id,
    userId,
    body.reason as RejectionReason,
    body.note,
  );

  if (!rejection) {
    return c.json({ error: "Sidequest not found or already started" }, 404);
  }

  // Recalibration: enqueue a fresh prescription. Rejections bypass the daily
  // limit — the user isn't adding a quest, they're asking for a better one.
  const jobQueue = c.get("jobQueue");
  const jobId = await jobQueue.enqueue("prescribe_quest", {
    userId,
    creatorId: userId,
    latitude: body.latitude,
    longitude: body.longitude,
    ...(body.timezone && { timezone: body.timezone }),
  });

  return c.json(
    {
      jobId,
      streamUrl: `/api/jobs/${jobId}/stream`,
      rejectionId: rejection.id,
    },
    202,
  );
});


