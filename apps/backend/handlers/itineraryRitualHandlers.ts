import type { Context } from "hono";
import type { AppContext } from "../types/context";

export const createRitualHandler = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user?.userId && !user?.id) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userId = user.userId || user.id;

  const body = await c.req.json<{
    name: string;
    emoji?: string;
    budgetMin?: number;
    budgetMax?: number;
    durationHours: number;
    activityTypes?: string[];
    stopCount?: number;
    categoryNames?: string[];
  }>();

  if (
    !body.name ||
    typeof body.name !== "string" ||
    body.name.trim().length === 0
  ) {
    return c.json({ error: "name is required" }, 400);
  }
  if (
    typeof body.durationHours !== "number" ||
    body.durationHours < 0.5 ||
    body.durationHours > 24
  ) {
    return c.json({ error: "durationHours must be between 0.5 and 24" }, 400);
  }

  const ritualService = c.get("itineraryRitualService");
  const ritual = await ritualService.create(userId, {
    name: body.name.trim(),
    emoji: body.emoji || "🔁",
    budgetMin: body.budgetMin ?? 0,
    budgetMax: body.budgetMax ?? 0,
    durationHours: body.durationHours,
    activityTypes: body.activityTypes ?? [],
    stopCount: body.stopCount ?? 0,
    categoryNames: body.categoryNames ?? [],
  });

  return c.json(ritual, 201);
};

export const listRitualsHandler = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user?.userId && !user?.id) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userId = user.userId || user.id;

  const ritualService = c.get("itineraryRitualService");
  const rituals = await ritualService.listByUser(userId);
  return c.json(rituals);
};

export const getRitualHandler = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user?.userId && !user?.id) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userId = user.userId || user.id;

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const ritualService = c.get("itineraryRitualService");
  const ritual = await ritualService.getById(id, userId);

  if (!ritual) {
    return c.json({ error: "Ritual not found" }, 404);
  }

  return c.json(ritual);
};

export const updateRitualHandler = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user?.userId && !user?.id) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userId = user.userId || user.id;

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const body = await c.req.json<{
    name?: string;
    emoji?: string;
    budgetMin?: number;
    budgetMax?: number;
    durationHours?: number;
    activityTypes?: string[];
    stopCount?: number;
    categoryNames?: string[];
  }>();

  const ritualService = c.get("itineraryRitualService");
  const ritual = await ritualService.update(id, userId, {
    name: body.name?.trim(),
    emoji: body.emoji,
    budgetMin: body.budgetMin,
    budgetMax: body.budgetMax,
    durationHours: body.durationHours,
    activityTypes: body.activityTypes,
    stopCount: body.stopCount,
    categoryNames: body.categoryNames,
  });

  if (!ritual) {
    return c.json({ error: "Ritual not found" }, 404);
  }

  return c.json(ritual);
};

export const deleteRitualHandler = async (c: Context<AppContext>) => {
  const user = c.get("user");
  if (!user?.userId && !user?.id) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userId = user.userId || user.id;

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const ritualService = c.get("itineraryRitualService");
  const deleted = await ritualService.deleteById(id, userId);

  if (!deleted) {
    return c.json({ error: "Ritual not found" }, 404);
  }

  return c.json({ success: true });
};
