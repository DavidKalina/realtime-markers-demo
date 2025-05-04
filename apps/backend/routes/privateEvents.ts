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

// Search for locations (more specific route)
privateEventsRouter.get("/locations/search", privateEventHandlers.searchLocationsHandler);

// Get location from coordinates (more specific route)
privateEventsRouter.get(
  "/locations/coordinates",
  privateEventHandlers.getLocationFromCoordinatesHandler
);

// Get events created by a user (more specific route)
privateEventsRouter.get("/creator/:userId", privateEventHandlers.getEventsByCreatorHandler);

// Get events where a user is invited (more specific route)
privateEventsRouter.get("/invited/:userId", privateEventHandlers.getInvitedEventsHandler);

// Create a new private event
privateEventsRouter.post("/", privateEventHandlers.createPrivateEventHandler);

// Get a private event by ID (more general route)
privateEventsRouter.get("/:id", privateEventHandlers.getPrivateEventByIdHandler);

// Update a private event (more general route)
privateEventsRouter.put("/:id", privateEventHandlers.updatePrivateEventHandler);

// Delete a private event (more general route)
privateEventsRouter.delete("/:id", privateEventHandlers.deletePrivateEventHandler);

export default privateEventsRouter;
