import { Hono } from "hono";
import {
  areaScanHandler,
  clusterProfileHandler,
  eventHypeHandler,
  cityHypeHandler,
  trailDetailHandler,
} from "../handlers/areaScanHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";

export const areaScanRouter = new Hono<AppContext>();

areaScanRouter.use("*", ip());
areaScanRouter.use("*", authMiddleware);
areaScanRouter.use(
  "*",
  rateLimit({
    maxRequests: 30,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyGenerator: (c) => {
      const user = c.get("user");
      return `area-scan:${user?.userId || user?.id || "anon"}`;
    },
  }),
);

areaScanRouter.post("/", areaScanHandler);
areaScanRouter.post("/cluster", clusterProfileHandler);
areaScanRouter.post("/event", eventHypeHandler);
areaScanRouter.post("/city", cityHypeHandler);
areaScanRouter.get("/trail/:id", trailDetailHandler);
