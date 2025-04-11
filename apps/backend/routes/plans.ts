// routes/plans.ts
import { Hono } from "hono";
import { z } from "zod";
import { PlanService } from "../services/PlanService";
import { PlanType } from "../entities/User";
import type { AppContext } from "../types/context";
import dataSource from "../data-source";
import { authMiddleware } from "../middleware/authMiddleware";

const plansRouter = new Hono<AppContext>();

// Apply auth middleware to all plan routes
plansRouter.use("*", authMiddleware);

// Get plan details
plansRouter.get("/", async (c) => {
  const user = c.get("user");

  console.log({ user });

  if (!user?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const planService = new PlanService(dataSource);
  try {
    const planDetails = await planService.getPlanDetails(user.userId);
    return c.json(planDetails);
  } catch (error) {
    console.error("Error getting plan details:", error);
    return c.json({ error: "Failed to get plan details" }, 500);
  }
});

// Update plan (admin only)
plansRouter.post("/update", async (c) => {
  const userId = c.get("user")?.userId;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check if user is admin
  const user = await dataSource.getRepository("User").findOne({
    where: { id: userId },
    select: ["role"],
  });

  if (!user || user.role !== "ADMIN") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const schema = z.object({
    userId: z.string().uuid(),
    planType: z.nativeEnum(PlanType),
  });

  try {
    const body = await c.req.json();
    const { userId: targetUserId, planType } = schema.parse(body);

    const planService = new PlanService(dataSource);
    await planService.updatePlan(targetUserId, planType);

    return c.json({ message: "Plan updated successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid request body", details: error.errors }, 400);
    }
    console.error("Error updating plan:", error);
    return c.json({ error: "Failed to update plan" }, 500);
  }
});

export default plansRouter;
