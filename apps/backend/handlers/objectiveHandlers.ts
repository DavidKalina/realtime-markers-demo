import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";
import type { ComfortZoneService } from "../services/ComfortZoneService";
import type { StorageService } from "../services/shared/StorageService";
import { User } from "@realtime-markers/database";

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
