import { Hono } from "hono";
import { EmojisHandler } from "../handlers/EmojisHandler";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";

// Create a router with the correct typing
export const emojisRouter = new Hono<AppContext>();

// Initialize the handler
const emojisHandler = new EmojisHandler();

// Apply IP, rate limiting, and auth middleware to all routes in this router
emojisRouter.use("*", ip());
emojisRouter.use(
  "*",
  rateLimit({
    maxRequests: 20,
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `emojis:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  })
);
emojisRouter.use("*", authMiddleware);

// Define routes
emojisRouter.get("/", (c) => emojisHandler.getEmojis(c));
emojisRouter.post("/", (c) => emojisHandler.createEmoji(c));
emojisRouter.put("/:id", (c) => emojisHandler.updateEmoji(c));
emojisRouter.delete("/:id", (c) => emojisHandler.deleteEmoji(c));
