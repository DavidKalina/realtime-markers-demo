import { Hono } from "hono";
import {
  searchPlace,
  searchCityState,
  reverseGeocodeAddressHandler,
} from "../handlers/placeHandlers";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";
import { ip } from "../middleware/ip";
import { rateLimit } from "../middleware/rateLimit";

// Create a router with the correct typing
export const placesRouter = new Hono<AppContext>();

// Apply IP, rate limiting, and auth middleware to all routes
placesRouter.use("*", ip());
placesRouter.use("*", authMiddleware);
placesRouter.use(
  "*",
  rateLimit({
    maxRequests: 20, // 20 requests per minute for places routes
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ipInfo = c.get("ip");
      return `places:${ipInfo.isPrivate ? "private" : "public"}:${ipInfo.ip}`;
    },
  }),
);

// POST /api/places/search
// Search for a place using Google Places API
placesRouter.post("/search", searchPlace);

// POST /api/places/search-city-state
// Search for cities and states using Google Places API
placesRouter.post("/search-city-state", searchCityState);

// POST /api/places/reverse-geocode
// Get address details from coordinates
placesRouter.post("/reverse-geocode", reverseGeocodeAddressHandler);
