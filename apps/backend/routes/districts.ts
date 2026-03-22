import { Hono } from "hono";
import {
  browseDistrictsHandler,
  districtDetailHandler,
  districtCoverageHandler,
} from "../handlers/districtHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";

export const districtRouter = new Hono<AppContext>();

// All district endpoints require auth
districtRouter.use("*", authMiddleware);

districtRouter.get("/browse", browseDistrictsHandler);
districtRouter.get("/coverage", districtCoverageHandler);
districtRouter.get("/:id", districtDetailHandler);
