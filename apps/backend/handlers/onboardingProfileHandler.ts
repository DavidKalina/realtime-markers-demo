import type { Context } from "hono";
import type { AppContext } from "../types/context";
import { withErrorHandling, requireAuth } from "../utils/handlerUtils";
import { ValidationError } from "../utils/errors";
import { User } from "@realtime-markers/database";

const VALID_PACES = ["chill", "balanced", "send_it"];

function buildEmbeddingText(profile: {
  activities: string[];
  vibes: string[];
  idealDay: string;
  pace: string;
}): string {
  const activities = profile.activities.join(", ");
  const vibes = profile.vibes.join(" and ");
  const pace = profile.pace.replace("_", " ");

  return `A person who loves ${activities}. They want adventures that feel like ${vibes}. Their ideal day: ${profile.idealDay}. They prefer a ${pace} pace.`;
}

export const submitOnboardingProfile = withErrorHandling(
  async (c: Context<AppContext>) => {
    const user = requireAuth(c);
    const body = await c.req.json();

    const { activities, vibes, idealDay, pace } = body;

    // Validate activities
    if (!Array.isArray(activities) || activities.length < 3) {
      throw new ValidationError("At least 3 activities are required");
    }

    // Validate vibes
    if (!Array.isArray(vibes) || vibes.length < 1) {
      throw new ValidationError("At least 1 vibe is required");
    }

    // Validate idealDay
    if (!idealDay || typeof idealDay !== "string" || !idealDay.trim()) {
      throw new ValidationError("idealDay is required");
    }

    // Validate pace
    if (!pace || !VALID_PACES.includes(pace)) {
      throw new ValidationError(
        `Invalid pace. Must be one of: ${VALID_PACES.join(", ")}`,
      );
    }

    const profile = {
      activities: activities as string[],
      vibes: vibes as string[],
      idealDay: idealDay.trim(),
      pace,
    };

    // Build natural-language text and generate embedding (optional — may not be available in all environments)
    const embeddingText = buildEmbeddingText(profile);
    let embeddingSql: string | undefined;
    try {
      const embeddingService = c.get("embeddingService");
      embeddingSql = await embeddingService.getEmbeddingSql(embeddingText);
    } catch {
      // Embedding service not available — save profile without embedding
    }

    // Save to user record
    const dataSource = c.get("dataSource");
    const userRepo = dataSource.getRepository(User);
    if (embeddingSql) {
      await userRepo.update(user.id, {
        onboardingProfile: profile,
        preferenceEmbedding: embeddingSql,
      });
    } else {
      await userRepo.update(user.id, {
        onboardingProfile: profile,
      });
    }

    return c.json({ success: true });
  },
);
