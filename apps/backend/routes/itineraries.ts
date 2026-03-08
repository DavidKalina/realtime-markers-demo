import { Hono } from "hono";
import {
  createItineraryHandler,
  listItinerariesHandler,
  getItineraryHandler,
  deleteItineraryHandler,
} from "../handlers/itineraryHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";

export const itineraryRouter = new Hono<AppContext>();

itineraryRouter.use("*", ip());
itineraryRouter.use("*", authMiddleware);
itineraryRouter.use(
  "*",
  rateLimit({
    maxRequests: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyGenerator: (c) => {
      const user = c.get("user");
      return `itinerary:${user?.userId || user?.id || "anon"}`;
    },
  }),
);

itineraryRouter.post("/", createItineraryHandler);
itineraryRouter.get("/", listItinerariesHandler);
itineraryRouter.get("/:id", getItineraryHandler);
itineraryRouter.delete("/:id", deleteItineraryHandler);
