import { Hono } from "hono";
import {
  createItineraryHandler,
  listItinerariesHandler,
  getItineraryHandler,
  deleteItineraryHandler,
  shareItineraryHandler,
  getSharedItineraryHandler,
  activateItineraryHandler,
  deactivateItineraryHandler,
  getActiveItineraryHandler,
  checkinItineraryItemHandler,
  getPopularStopsHandler,
  rateItineraryHandler,
  listCompletedHandler,
  browseItinerariesHandler,
  adoptItineraryHandler,
} from "../handlers/itineraryHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";

export const itineraryRouter = new Hono<AppContext>();

itineraryRouter.use("*", ip());
itineraryRouter.use("*", authMiddleware);

const readRateLimit = rateLimit({
  maxRequests: 120,
  windowMs: 60 * 60 * 1000, // 1 hour
  keyGenerator: (c) => {
    const user = c.get("user");
    return `itinerary-read:${user?.userId || user?.id || "anon"}`;
  },
});

const writeRateLimit = rateLimit({
  maxRequests: 20,
  windowMs: 60 * 60 * 1000, // 1 hour
  keyGenerator: (c) => {
    const user = c.get("user");
    return `itinerary-write:${user?.userId || user?.id || "anon"}`;
  },
});

itineraryRouter.get("/", readRateLimit, listItinerariesHandler);
itineraryRouter.get("/completed", readRateLimit, listCompletedHandler);
itineraryRouter.get("/active", readRateLimit, getActiveItineraryHandler);
itineraryRouter.get("/browse", readRateLimit, browseItinerariesHandler);
itineraryRouter.get("/:id", readRateLimit, getItineraryHandler);
itineraryRouter.post("/", writeRateLimit, createItineraryHandler);
itineraryRouter.post("/deactivate", writeRateLimit, deactivateItineraryHandler);
itineraryRouter.post("/:id/share", writeRateLimit, shareItineraryHandler);
itineraryRouter.post("/:id/activate", writeRateLimit, activateItineraryHandler);
itineraryRouter.post("/:id/rate", writeRateLimit, rateItineraryHandler);
itineraryRouter.post("/:id/adopt", writeRateLimit, adoptItineraryHandler);
itineraryRouter.post(
  "/:id/items/:itemId/checkin",
  writeRateLimit,
  checkinItineraryItemHandler,
);
itineraryRouter.delete("/:id", writeRateLimit, deleteItineraryHandler);

// Public shared itinerary router (no auth)
export const publicItineraryRouter = new Hono<AppContext>();

publicItineraryRouter.use("*", ip());
publicItineraryRouter.use(
  "*",
  rateLimit({
    maxRequests: 30,
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `public-itinerary:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);

publicItineraryRouter.get("/popular-stops", getPopularStopsHandler);
publicItineraryRouter.get("/:shareToken", getSharedItineraryHandler);
