import { Hono } from "hono";
import {
  createRitualHandler,
  listRitualsHandler,
  getRitualHandler,
  updateRitualHandler,
  deleteRitualHandler,
} from "../handlers/itineraryRitualHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";

export const itineraryRitualRouter = new Hono<AppContext>();

itineraryRitualRouter.use("*", ip());
itineraryRitualRouter.use("*", authMiddleware);

const readRateLimit = rateLimit({
  maxRequests: 120,
  windowMs: 60 * 60 * 1000,
  keyGenerator: (c) => {
    const user = c.get("user");
    return `ritual-read:${user?.userId || user?.id || "anon"}`;
  },
});

const writeRateLimit = rateLimit({
  maxRequests: 30,
  windowMs: 60 * 60 * 1000,
  keyGenerator: (c) => {
    const user = c.get("user");
    return `ritual-write:${user?.userId || user?.id || "anon"}`;
  },
});

itineraryRitualRouter.get("/", readRateLimit, listRitualsHandler);
itineraryRitualRouter.get("/:id", readRateLimit, getRitualHandler);
itineraryRitualRouter.post("/", writeRateLimit, createRitualHandler);
itineraryRitualRouter.put("/:id", writeRateLimit, updateRitualHandler);
itineraryRitualRouter.delete("/:id", writeRateLimit, deleteRitualHandler);
