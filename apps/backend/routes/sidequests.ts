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
  rateSidequestHandler,
  listCompletedHandler,
  browseSidequestsHandler,
  getDeckStatsHandler,
  promoteSidequestHandler,
  searchSidequestsHandler,
  prescribeQuestHandler,
  getComfortZoneHandler,
  getWorldSizeHandler,
  setHomeAnchorHandler,
  updateComfortProfileHandler,
  objectiveJournalHandler,
} from "../handlers/sidequestHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";

export const sidequestRouter = new Hono<AppContext>();

sidequestRouter.use("*", ip());
sidequestRouter.use("*", authMiddleware);

const readRateLimit = rateLimit({
  maxRequests: 240,
  windowMs: 60 * 60 * 1000,
  keyGenerator: (c) => {
    const user = c.get("user");
    return `sidequest-read:${user?.userId || user?.id || "anon"}`;
  },
});

const writeRateLimit = rateLimit({
  maxRequests: 40,
  windowMs: 60 * 60 * 1000,
  keyGenerator: (c) => {
    const user = c.get("user");
    return `sidequest-write:${user?.userId || user?.id || "anon"}`;
  },
});

sidequestRouter.get("/", readRateLimit, listSidequestsHandler);
sidequestRouter.get("/completed", readRateLimit, listCompletedHandler);
sidequestRouter.get("/active", readRateLimit, getActiveSidequestHandler);
sidequestRouter.get("/browse", readRateLimit, browseSidequestsHandler);
sidequestRouter.get("/search", readRateLimit, searchSidequestsHandler);
sidequestRouter.get("/deck-stats", readRateLimit, getDeckStatsHandler);
sidequestRouter.get("/comfort-zone", readRateLimit, getComfortZoneHandler);
sidequestRouter.get("/world-size", readRateLimit, getWorldSizeHandler);
sidequestRouter.get("/:id", readRateLimit, getSidequestHandler);
sidequestRouter.post("/prescribe", writeRateLimit, prescribeQuestHandler);
sidequestRouter.post("/batch-delete", writeRateLimit, batchDeleteSidequestHandler);
sidequestRouter.post("/deactivate", writeRateLimit, deactivateSidequestHandler);
sidequestRouter.post("/home-anchor", writeRateLimit, setHomeAnchorHandler);
sidequestRouter.post("/:id/share", writeRateLimit, shareSidequestHandler);
sidequestRouter.post("/:id/activate", writeRateLimit, activateSidequestHandler);
sidequestRouter.post("/:id/rate", writeRateLimit, rateSidequestHandler);
sidequestRouter.post("/:id/promote", writeRateLimit, promoteSidequestHandler);
sidequestRouter.post(
  "/:id/objectives/:objectiveId/checkin",
  writeRateLimit,
  checkinObjectiveHandler,
);
sidequestRouter.put("/comfort-profile", writeRateLimit, updateComfortProfileHandler);
sidequestRouter.put(
  "/objectives/:objectiveId/journal",
  writeRateLimit,
  objectiveJournalHandler,
);
sidequestRouter.delete("/:id", writeRateLimit, deleteSidequestHandler);

// Public shared sidequest router (no auth)
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
