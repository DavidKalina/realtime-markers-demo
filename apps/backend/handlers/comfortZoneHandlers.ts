import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";
import type { ComfortZoneService } from "../services/ComfortZoneService";

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
