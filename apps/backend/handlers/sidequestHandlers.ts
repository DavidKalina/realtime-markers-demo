import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";
import type { SidequestService } from "../services/SidequestService";
import type { SidequestCheckinService } from "../services/SidequestCheckinService";
import type { ComfortZoneService } from "../services/ComfortZoneService";
import { generateFearLadder } from "../services/FearLadderGenerationService";
import { generateBarriers } from "../services/BarrierGenerationService";
import { assessGoal, refineNext } from "../services/GoalRefinementService";
import type { RefinementState } from "../services/GoalRefinementService";
import type { StorageService } from "../services/shared/StorageService";
import { User } from "@realtime-markers/database";

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

    const sidequestCheckinService = c.get("sidequestCheckinService") as SidequestCheckinService;
    const result = await sidequestCheckinService.manualCheckin(userId, id, objectiveId);

    if (!result.success) {
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
    }>();

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

    // 1. Save journal entry (triggers async LLM reflection analysis)
    const comfortZoneService = c.get("comfortZoneService") as ComfortZoneService;
    const updated = await comfortZoneService.updateObjectiveJournal(
      userId,
      objectiveId,
      {
        journalEntry: body.journalEntry,
        completedActivity: body.completedActivity,
        socialContext: body.socialContext,
      },
    );

    if (!updated) {
      return c.json({ error: "Objective not found or not authorized" }, 404);
    }

    // 2. Mark checked in (triggers sidequest completion if last objective)
    const sidequestCheckinService = c.get("sidequestCheckinService") as SidequestCheckinService;
    const result = await sidequestCheckinService.manualCheckin(userId, id, objectiveId);

    if (!result.success) {
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

// ─── Wellness Pivot Handlers ───────────────────────────────────────

const DAILY_PRESCRIBE_LIMIT = 3;

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

  // Enqueue prescription job
  const jobQueue = c.get("jobQueue");
  const jobId = await jobQueue.enqueue("prescribe_quest", {
    userId,
    creatorId: userId,
    latitude: body.latitude,
    longitude: body.longitude,
    ...(body.timezone && { timezone: body.timezone }),
    ...(body.model && { model: body.model }),
    ...(body.questType && { questType: body.questType }),
    ...(body.challengeCategory && { challengeCategory: body.challengeCategory }),
  });

  return c.json(
    {
      jobId,
      streamUrl: `/api/jobs/${jobId}/stream`,
      remaining: DAILY_PRESCRIBE_LIMIT - todayCount - 1,
    },
    202,
  );
});

export const prescribeWeekPackHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userId = user.id;

  const body = await c.req.json<{
    latitude: number;
    longitude: number;
    timezone?: string;
  }>();

  if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
    return c.json({ error: "latitude and longitude are required" }, 400);
  }

  const jobQueue = c.get("jobQueue");
  const jobId = await jobQueue.enqueue("prescribe_week_pack", {
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
    },
    202,
  );
});

export const getComfortZoneHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const comfortZoneService = c.get("comfortZoneService") as ComfortZoneService;
  const zone = await comfortZoneService.getComfortZone(user.id);
  return c.json(zone);
});

export const getWorldSizeHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const comfortZoneService = c.get("comfortZoneService") as ComfortZoneService;
  const worldSize = await comfortZoneService.getWorldSize(user.id);
  return c.json(worldSize);
});

export const setHomeAnchorHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);

  const body = await c.req.json<{ latitude: number; longitude: number }>();
  if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
    return c.json({ error: "latitude and longitude are required" }, 400);
  }

  const comfortZoneService = c.get("comfortZoneService") as ComfortZoneService;
  await comfortZoneService.detectHomeAnchor(user.id, body.latitude, body.longitude);

  const zone = await comfortZoneService.getComfortZone(user.id);
  return c.json(zone);
});

export const updateComfortProfileHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);

    const body = await c.req.json<{
      pacePreference?: string;
      comfortProfile?: {
        comfortZone: string;
        barriers: string;
        goals: string;
        goalTags?: string[];
        northStar?: string;
        primaryGoal?: string;
        targetDate?: string;
        goalLocation?: string;
      };
      onboardingProfile?: {
        activities: string[];
      };
      fearLadder?: {
        overallScore: number;
        dimensionScores: Record<string, number>;
        responses: Record<string, number>;
        scenarios?: { id: string; text: string; dimension: string }[];
        dimensions?: string[];
      };
      socialSituation?: {
        ageRange: string;
        gender: string;
        timeInArea: string;
        currentSocialLife: string;
        lookingFor: string[];
        workSituation: string;
        livingSituation: string;
        dailyRoutine?: string;
        transportation?: string;
        budget?: string;
      };
    }>();

    const validPaces = ["gentle", "steady", "push_me"];
    if (body.pacePreference && !validPaces.includes(body.pacePreference)) {
      return c.json(
        { error: `pacePreference must be one of: ${validPaces.join(", ")}` },
        400,
      );
    }

    if (!body.pacePreference && !body.comfortProfile && !body.fearLadder && !body.onboardingProfile && !body.socialSituation) {
      return c.json({ error: "No fields to update" }, 400);
    }

    const comfortZoneService = c.get("comfortZoneService") as ComfortZoneService;
    await comfortZoneService.updateComfortProfile(user.id, {
      pacePreference: body.pacePreference,
      comfortProfile: body.comfortProfile,
      fearLadder: body.fearLadder,
      onboardingProfile: body.onboardingProfile,
      socialSituation: body.socialSituation,
    });

    const zone = await comfortZoneService.getComfortZone(user.id);
    return c.json(zone);
  },
);

export const objectivePredictionHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const objectiveId = c.req.param("objectiveId");
    if (!objectiveId) {
      return c.json({ error: "objectiveId is required" }, 400);
    }

    const body = await c.req.json<{
      predictedAnxiety?: number;
      predictedDifficulty?: number;
      predictedOutcome?: string;
    }>();

    if (body.predictedAnxiety == null && body.predictedDifficulty == null && body.predictedOutcome == null) {
      return c.json({ error: "At least one prediction field is required" }, 400);
    }

    if (body.predictedAnxiety != null && (body.predictedAnxiety < 1 || body.predictedAnxiety > 5 || !Number.isInteger(body.predictedAnxiety))) {
      return c.json({ error: "predictedAnxiety must be an integer from 1 to 5" }, 400);
    }
    if (body.predictedDifficulty != null && (body.predictedDifficulty < 1 || body.predictedDifficulty > 5 || !Number.isInteger(body.predictedDifficulty))) {
      return c.json({ error: "predictedDifficulty must be an integer from 1 to 5" }, 400);
    }
    if (body.predictedOutcome && body.predictedOutcome.length > 500) {
      return c.json({ error: "predictedOutcome must be 500 characters or fewer" }, 400);
    }

    const comfortZoneService = c.get("comfortZoneService") as ComfortZoneService;
    const updated = await comfortZoneService.updateObjectivePrediction(
      user.id,
      objectiveId,
      {
        predictedAnxiety: body.predictedAnxiety,
        predictedDifficulty: body.predictedDifficulty,
        predictedOutcome: body.predictedOutcome,
      },
    );

    if (!updated) {
      return c.json({ error: "Objective not found or not authorized" }, 404);
    }

    // Return calibration feedback so the mobile app can nudge the user
    const userRecord = await c.get("dataSource").getRepository(User).findOne({
      where: { id: user.id },
      select: ["id", "expectancyCalibration"],
    });
    const cal = userRecord?.expectancyCalibration;
    let calibrationHint: string | null = null;
    if (cal && cal.totalViolations >= 3) {
      if (cal.avgAnxietyDelta > 1.5) {
        calibrationHint = `You've overestimated your anxiety by an average of ${cal.avgAnxietyDelta.toFixed(1)} points across ${cal.totalViolations} quests. Things usually go better than you expect!`;
      } else if (cal.avgAnxietyDelta > 0.5) {
        calibrationHint = `Your anxiety predictions have been a bit high — on average ${cal.avgAnxietyDelta.toFixed(1)} points above reality. You're doing better than you think.`;
      } else if (cal.avgAnxietyDelta < -0.5) {
        calibrationHint = `Quests have been a bit tougher than expected lately. It's okay to go easier on yourself.`;
      }
    }

    return c.json({ success: true, calibrationHint });
  },
);

export const objectiveJournalHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);

    const objectiveId = c.req.param("objectiveId");
    if (!objectiveId) {
      return c.json({ error: "objectiveId is required" }, 400);
    }

    const body = await c.req.json<{
      journalEntry?: string;
      completedActivity?: string;
      photoBase64?: string;
      socialContext?: string;
      wouldReturn?: boolean;
    }>();

    if (!body.journalEntry && !body.completedActivity && !body.photoBase64 && !body.socialContext && body.wouldReturn == null) {
      return c.json({ error: "At least one field is required" }, 400);
    }

    if (body.journalEntry && body.journalEntry.length > 2000) {
      return c.json({ error: "journalEntry must be 2000 characters or fewer" }, 400);
    }
    if (body.completedActivity && body.completedActivity.length > 2000) {
      return c.json({ error: "completedActivity must be 2000 characters or fewer" }, 400);
    }
    if (body.photoBase64 && body.photoBase64.length > 4 * 1024 * 1024) {
      return c.json({ error: "Photo is too large (max ~3MB)" }, 400);
    }
    const validSocialContexts = ["solo", "with_someone", "met_someone_new", "group_activity"];
    if (body.socialContext && !validSocialContexts.includes(body.socialContext)) {
      return c.json({ error: `socialContext must be one of: ${validSocialContexts.join(", ")}` }, 400);
    }

    // Upload photo to S3 if provided
    let photoUrl: string | undefined;
    if (body.photoBase64) {
      const imageBuffer = Buffer.from(body.photoBase64, "base64");
      const storageService = c.get("storageService") as StorageService;
      const uploadedUrl = await storageService.uploadImage(
        imageBuffer,
        "journal-photos",
        { objectiveId, userId: user.id },
      );
      if (uploadedUrl) {
        photoUrl = uploadedUrl;
      } else {
        console.warn(`[objectiveJournalHandler] Photo upload failed for objective ${objectiveId}`);
      }
    }

    const comfortZoneService = c.get("comfortZoneService") as ComfortZoneService;
    const updated = await comfortZoneService.updateObjectiveJournal(
      user.id,
      objectiveId,
      {
        journalEntry: body.journalEntry,
        completedActivity: body.completedActivity,
        photoUrl,
        socialContext: body.socialContext,
        wouldReturn: body.wouldReturn,
      },
    );

    if (!updated) {
      return c.json({ error: "Objective not found or not authorized" }, 404);
    }

    return c.json({ success: true });
  },
);

export const generateFearLadderHandler: Handler = withErrorHandling(
  async (c) => {
    requireAuth(c);

    const body = await c.req.json<{
      primaryGoal: string;
      goals: string[];
      barriers: string[];
      activities: string[];
    }>();

    if (!body.primaryGoal || typeof body.primaryGoal !== "string" || body.primaryGoal.trim().length === 0) {
      return c.json({ error: "primaryGoal is required" }, 400);
    }

    if (body.primaryGoal.length > 500) {
      return c.json({ error: "primaryGoal must be 500 characters or fewer" }, 400);
    }

    const openAIService = c.get("openAIService");
    const result = await generateFearLadder(openAIService, {
      primaryGoal: body.primaryGoal.trim(),
      goals: body.goals ?? [],
      barriers: body.barriers ?? [],
      activities: body.activities ?? [],
    });

    return c.json(result);
  },
);

export const generateBarriersHandler: Handler = withErrorHandling(
  async (c) => {
    requireAuth(c);

    const body = await c.req.json<{ primaryGoal: string }>();

    if (!body.primaryGoal || typeof body.primaryGoal !== "string" || body.primaryGoal.trim().length === 0) {
      return c.json({ error: "primaryGoal is required" }, 400);
    }

    if (body.primaryGoal.length > 500) {
      return c.json({ error: "primaryGoal must be 500 characters or fewer" }, 400);
    }

    const openAIService = c.get("openAIService");
    const result = await generateBarriers(openAIService, {
      primaryGoal: body.primaryGoal.trim(),
    });

    return c.json(result);
  },
);

export const assessGoalHandler: Handler = withErrorHandling(
  async (c) => {
    requireAuth(c);

    const body = await c.req.json<{ goal: string }>();

    if (!body.goal || typeof body.goal !== "string" || body.goal.trim().length === 0) {
      return c.json({ error: "goal is required" }, 400);
    }

    if (body.goal.length > 500) {
      return c.json({ error: "goal must be 500 characters or fewer" }, 400);
    }

    const openAIService = c.get("openAIService");
    const result = await assessGoal(openAIService, body.goal.trim());

    return c.json(result);
  },
);

export const refineGoalHandler: Handler = withErrorHandling(
  async (c) => {
    requireAuth(c);

    const body = await c.req.json<{
      state: RefinementState;
      response: string;
    }>();

    if (!body.state || !body.state.rawGoal) {
      return c.json({ error: "state with rawGoal is required" }, 400);
    }

    if (!body.response || typeof body.response !== "string" || body.response.trim().length === 0) {
      return c.json({ error: "response is required" }, 400);
    }

    if (body.response.length > 1000) {
      return c.json({ error: "response must be 1000 characters or fewer" }, 400);
    }

    const openAIService = c.get("openAIService");
    const result = await refineNext(openAIService, body.state, body.response.trim());

    return c.json(result);
  },
);

