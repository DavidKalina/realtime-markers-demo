import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";
import { generateFearLadder } from "../services/FearLadderGenerationService";
import { generateBarriers } from "../services/BarrierGenerationService";
import { assessGoal, refineNext } from "../services/GoalRefinementService";
import type { RefinementState } from "../services/GoalRefinementService";

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
