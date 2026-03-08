import { Hono } from "hono";
import {
  createItineraryHandler,
  listItinerariesHandler,
  getItineraryHandler,
  deleteItineraryHandler,
  shareItineraryHandler,
  getSharedItineraryHandler,
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
itineraryRouter.get("/:id", readRateLimit, getItineraryHandler);
itineraryRouter.post("/", writeRateLimit, createItineraryHandler);
itineraryRouter.post("/:id/share", writeRateLimit, shareItineraryHandler);
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

publicItineraryRouter.get("/:shareToken", getSharedItineraryHandler);
