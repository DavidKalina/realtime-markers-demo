import type { Context } from "hono";
import type { AppContext } from "../types/context";
import { withErrorHandling, requireAuth } from "../utils/handlerUtils";
import { ValidationError } from "../utils/errors";
import { User } from "@realtime-markers/database";

const VALID_PACES = ["chill", "balanced", "send_it"];

export const submitOnboardingProfile = withErrorHandling(
  async (c: Context<AppContext>) => {
    const user = requireAuth(c);
    const body = await c.req.json();

    const { activities, pace } = body;

    // Validate activities
    if (!Array.isArray(activities) || activities.length < 3) {
      throw new ValidationError("At least 3 activities are required");
    }

    // Validate pace
    if (!pace || !VALID_PACES.includes(pace)) {
      throw new ValidationError(
        `Invalid pace. Must be one of: ${VALID_PACES.join(", ")}`,
      );
    }

    const profile = {
      activities: activities as string[],
      pace,
    };

    // Save to user record
    const dataSource = c.get("dataSource");
    const userRepo = dataSource.getRepository(User);
    await userRepo.update(user.id, {
      onboardingProfile: profile,
    });

    return c.json({ success: true });
  },
);
