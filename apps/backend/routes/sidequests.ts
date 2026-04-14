import { Hono } from "hono";
import {
  listSidequestsHandler,
  getSidequestHandler,
  deleteSidequestHandler,
  batchDeleteSidequestHandler,
  shareSidequestHandler,
  getSharedSidequestHandler,
  activateSidequestHandler,
  deactivateSidequestHandler,
  getActiveSidequestHandler,
  checkinObjectiveHandler,
  getPopularStopsHandler,
  completeChallengeHandler,
  rateSidequestHandler,
  listCompletedHandler,
  listUnratedHandler,
  listPendingCaptureHandler,
  browseSidequestsHandler,
  getDeckStatsHandler,
  promoteSidequestHandler,
  searchSidequestsHandler,
  prescribeQuestHandler,
  prescribeWeekPackHandler,
} from "../handlers/sidequestHandlers";
import {
  objectiveJournalHandler,
  objectivePredictionHandler,
} from "../handlers/objectiveHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";
import { withErrorHandling, requireAuth } from "../utils/handlerUtils";
import { generateFearLadder } from "../services/FearLadderGenerationService";
import { generateBarriers } from "../services/BarrierGenerationService";
import { assessGoal, refineNext } from "../services/GoalRefinementService";
import type { RefinementState } from "../services/GoalRefinementService";
import type { ComfortZoneService } from "../services/ComfortZoneService";

export const sidequestRouter = new Hono<AppContext>();

sidequestRouter.use("*", ip());
sidequestRouter.use("*", authMiddleware);

const readRateLimit = rateLimit({
  maxRequests: 9999,
  windowMs: 60 * 60 * 1000,
  keyGenerator: (c) => {
    const user = c.get("user");
    return `sidequest-read:${user?.userId || user?.id || "anon"}`;
  },
});

const writeRateLimit = rateLimit({
  maxRequests: 9999,
  windowMs: 60 * 60 * 1000,
  keyGenerator: (c) => {
    const user = c.get("user");
    return `sidequest-write:${user?.userId || user?.id || "anon"}`;
  },
});

// ── Read routes ─────────────────────────────────────────────
sidequestRouter.get("/", readRateLimit, listSidequestsHandler);
sidequestRouter.get("/completed", readRateLimit, listCompletedHandler);
sidequestRouter.get("/unrated", readRateLimit, listUnratedHandler);
sidequestRouter.get("/pending-capture", readRateLimit, listPendingCaptureHandler);
sidequestRouter.get("/active", readRateLimit, getActiveSidequestHandler);
sidequestRouter.get("/browse", readRateLimit, browseSidequestsHandler);
sidequestRouter.get("/search", readRateLimit, searchSidequestsHandler);
sidequestRouter.get("/deck-stats", readRateLimit, getDeckStatsHandler);

sidequestRouter.get(
  "/comfort-zone",
  readRateLimit,
  withErrorHandling(async (c) => {
    const user = requireAuth(c);
    const comfortZoneService = c.get("comfortZoneService") as ComfortZoneService;
    return c.json(await comfortZoneService.getComfortZone(user.id));
  }),
);

sidequestRouter.get(
  "/world-size",
  readRateLimit,
  withErrorHandling(async (c) => {
    const user = requireAuth(c);
    const comfortZoneService = c.get("comfortZoneService") as ComfortZoneService;
    return c.json(await comfortZoneService.getWorldSize(user.id));
  }),
);

sidequestRouter.get("/:id", readRateLimit, getSidequestHandler);

// ── Write routes ────────────────────────────────────────────
sidequestRouter.post("/prescribe", writeRateLimit, prescribeQuestHandler);
sidequestRouter.post("/prescribe-pack", writeRateLimit, prescribeWeekPackHandler);
sidequestRouter.post("/batch-delete", writeRateLimit, batchDeleteSidequestHandler);
sidequestRouter.post("/deactivate", writeRateLimit, deactivateSidequestHandler);

sidequestRouter.post(
  "/home-anchor",
  writeRateLimit,
  withErrorHandling(async (c) => {
    const user = requireAuth(c);
    const body = await c.req.json<{ latitude: number; longitude: number }>();
    if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
      return c.json({ error: "latitude and longitude are required" }, 400);
    }

    const comfortZoneService = c.get("comfortZoneService") as ComfortZoneService;
    await comfortZoneService.detectHomeAnchor(user.id, body.latitude, body.longitude);
    return c.json(await comfortZoneService.getComfortZone(user.id));
  }),
);

sidequestRouter.post("/:id/share", writeRateLimit, shareSidequestHandler);
sidequestRouter.post("/:id/activate", writeRateLimit, activateSidequestHandler);
sidequestRouter.post("/:id/rate", writeRateLimit, rateSidequestHandler);
sidequestRouter.post("/:id/promote", writeRateLimit, promoteSidequestHandler);
sidequestRouter.post(
  "/:id/objectives/:objectiveId/checkin",
  writeRateLimit,
  checkinObjectiveHandler,
);
sidequestRouter.post(
  "/:id/objectives/:objectiveId/complete-challenge",
  writeRateLimit,
  completeChallengeHandler,
);

sidequestRouter.post(
  "/generate-fear-ladder",
  writeRateLimit,
  withErrorHandling(async (c) => {
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
    return c.json(
      await generateFearLadder(openAIService, {
        primaryGoal: body.primaryGoal.trim(),
        goals: body.goals ?? [],
        barriers: body.barriers ?? [],
        activities: body.activities ?? [],
      }),
    );
  }),
);

sidequestRouter.post(
  "/generate-barriers",
  writeRateLimit,
  withErrorHandling(async (c) => {
    requireAuth(c);
    const body = await c.req.json<{ primaryGoal: string }>();

    if (!body.primaryGoal || typeof body.primaryGoal !== "string" || body.primaryGoal.trim().length === 0) {
      return c.json({ error: "primaryGoal is required" }, 400);
    }
    if (body.primaryGoal.length > 500) {
      return c.json({ error: "primaryGoal must be 500 characters or fewer" }, 400);
    }

    const openAIService = c.get("openAIService");
    return c.json(
      await generateBarriers(openAIService, { primaryGoal: body.primaryGoal.trim() }),
    );
  }),
);

sidequestRouter.post(
  "/assess-goal",
  writeRateLimit,
  withErrorHandling(async (c) => {
    requireAuth(c);
    const body = await c.req.json<{ goal: string }>();

    if (!body.goal || typeof body.goal !== "string" || body.goal.trim().length === 0) {
      return c.json({ error: "goal is required" }, 400);
    }
    if (body.goal.length > 500) {
      return c.json({ error: "goal must be 500 characters or fewer" }, 400);
    }

    const openAIService = c.get("openAIService");
    return c.json(await assessGoal(openAIService, body.goal.trim()));
  }),
);

sidequestRouter.post(
  "/refine-goal",
  writeRateLimit,
  withErrorHandling(async (c) => {
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
    return c.json(await refineNext(openAIService, body.state, body.response.trim()));
  }),
);

sidequestRouter.put(
  "/comfort-profile",
  writeRateLimit,
  withErrorHandling(async (c) => {
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
      onboardingProfile?: { activities: string[] };
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

    return c.json(await comfortZoneService.getComfortZone(user.id));
  }),
);

sidequestRouter.put(
  "/objectives/:objectiveId/journal",
  writeRateLimit,
  objectiveJournalHandler,
);
sidequestRouter.put(
  "/objectives/:objectiveId/prediction",
  writeRateLimit,
  objectivePredictionHandler,
);
sidequestRouter.delete("/:id", writeRateLimit, deleteSidequestHandler);

// ── Public shared sidequest router (no auth) ────────────────
export const publicSidequestRouter = new Hono<AppContext>();

publicSidequestRouter.use("*", ip());
publicSidequestRouter.use(
  "*",
  rateLimit({
    maxRequests: 30,
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `public-sidequest:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);

publicSidequestRouter.get("/popular-stops", getPopularStopsHandler);
publicSidequestRouter.get("/:shareToken", getSharedSidequestHandler);
