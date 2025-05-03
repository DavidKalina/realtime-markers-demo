import { Hono } from "hono";
import { privateEventHandlers } from "../handlers/privateEventHandlers";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";

const privateEventsRouter = new Hono();

// Apply IP, rate limiting, and auth middleware to all routes
privateEventsRouter.use("*", ip());
privateEventsRouter.use(
  "*",
  rateLimit({
    maxRequests: 20, // 20 requests per minute for private event routes
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `private-events:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  })
);
privateEventsRouter.use("*", authMiddleware);

// Create a new private event
privateEventsRouter.post("/", privateEventHandlers.createPrivateEventHandler);

// Get a private event by ID
privateEventsRouter.get("/:id", privateEventHandlers.getPrivateEventByIdHandler);

// Update a private event
privateEventsRouter.put("/:id", privateEventHandlers.updatePrivateEventHandler);

// Delete a private event
privateEventsRouter.delete("/:id", privateEventHandlers.deletePrivateEventHandler);

// Get events created by a user
privateEventsRouter.get("/creator/:userId", privateEventHandlers.getEventsByCreatorHandler);

// Get events where a user is invited
privateEventsRouter.get("/invited/:userId", privateEventHandlers.getInvitedEventsHandler);

export default privateEventsRouter;
