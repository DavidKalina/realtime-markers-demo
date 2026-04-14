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

// ── Read routes ─────────────────────────────────────────────
sidequestRouter.get("/", listSidequestsHandler);
sidequestRouter.get("/completed", listCompletedHandler);
sidequestRouter.get("/unrated", listUnratedHandler);
sidequestRouter.get("/pending-capture", listPendingCaptureHandler);
sidequestRouter.get("/active", getActiveSidequestHandler);
sidequestRouter.get("/browse", browseSidequestsHandler);
sidequestRouter.get("/search", searchSidequestsHandler);
sidequestRouter.get("/deck-stats", getDeckStatsHandler);

sidequestRouter.get(
  "/comfort-zone",
  withErrorHandling(async (c) => {
    const user = requireAuth(c);
    const comfortZoneService = c.get("comfortZoneService") as ComfortZoneService;
    return c.json(await comfortZoneService.getComfortZone(user.id));
  }),
);

sidequestRouter.get(
  "/world-size",
  withErrorHandling(async (c) => {
    const user = requireAuth(c);
    const comfortZoneService = c.get("comfortZoneService") as ComfortZoneService;
    return c.json(await comfortZoneService.getWorldSize(user.id));
  }),
);

sidequestRouter.get("/:id", getSidequestHandler);

// ── Write routes ────────────────────────────────────────────
sidequestRouter.post("/prescribe", prescribeQuestHandler);
sidequestRouter.post("/batch-delete", batchDeleteSidequestHandler);
sidequestRouter.post("/deactivate", deactivateSidequestHandler);

sidequestRouter.post(
  "/home-anchor",
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

sidequestRouter.post("/:id/share", shareSidequestHandler);
sidequestRouter.post("/:id/activate", activateSidequestHandler);
sidequestRouter.post("/:id/rate", rateSidequestHandler);
sidequestRouter.post("/:id/promote", promoteSidequestHandler);
sidequestRouter.post(
  "/:id/objectives/:objectiveId/checkin",
  checkinObjectiveHandler,
);
sidequestRouter.post(
  "/:id/objectives/:objectiveId/complete-challenge",
  completeChallengeHandler,
);

sidequestRouter.post(
  "/generate-fear-ladder",
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
      onboardingPhase?: number;
    }>();

    const validPaces = ["gentle", "steady", "push_me"];
    if (body.pacePreference && !validPaces.includes(body.pacePreference)) {
      return c.json(
        { error: `pacePreference must be one of: ${validPaces.join(", ")}` },
        400,
      );
    }
    if (!body.pacePreference && !body.comfortProfile && !body.fearLadder && !body.onboardingProfile && !body.socialSituation && body.onboardingPhase === undefined) {
      return c.json({ error: "No fields to update" }, 400);
    }

    const comfortZoneService = c.get("comfortZoneService") as ComfortZoneService;
    await comfortZoneService.updateComfortProfile(user.id, {
      pacePreference: body.pacePreference,
      comfortProfile: body.comfortProfile,
      fearLadder: body.fearLadder,
      onboardingProfile: body.onboardingProfile,
      socialSituation: body.socialSituation,
      onboardingPhase: body.onboardingPhase,
    });

    return c.json(await comfortZoneService.getComfortZone(user.id));
  }),
);

sidequestRouter.put(
  "/objectives/:objectiveId/journal",
  objectiveJournalHandler,
);
sidequestRouter.put(
  "/objectives/:objectiveId/prediction",
  objectivePredictionHandler,
);
sidequestRouter.delete("/:id", deleteSidequestHandler);

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
