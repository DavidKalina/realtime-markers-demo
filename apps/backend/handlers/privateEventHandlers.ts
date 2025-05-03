import type { Context } from "hono";
import { PrivateEventService } from "../services/PrivateEventService";
import { PrivateEventStatus } from "../entities/PrivateEvent";
import AppDataSource from "../data-source";

// Initialize service
const privateEventService = new PrivateEventService(AppDataSource);

export const privateEventHandlers = {
  // Create a new private event
  async createPrivateEventHandler(c: Context) {
    try {
      const body = await c.req.json();
      const event = await privateEventService.createEvent(body);
      return c.json(event, 201);
    } catch (error) {
      console.error("Error creating private event:", error);
      return c.json({ error: "Failed to create private event" }, 500);
    }
  },

  // Get a private event by ID
  async getPrivateEventByIdHandler(c: Context) {
    try {
      const id = c.req.param("id");
      const event = await privateEventService.getEventById(id);

      if (!event) {
        return c.json({ error: "Private event not found" }, 404);
      }

      return c.json(event);
    } catch (error) {
      console.error("Error fetching private event:", error);
      return c.json({ error: "Failed to fetch private event" }, 500);
    }
  },

  // Update a private event
  async updatePrivateEventHandler(c: Context) {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const event = await privateEventService.updateEvent(id, body);

      if (!event) {
        return c.json({ error: "Private event not found" }, 404);
      }

      return c.json(event);
    } catch (error) {
      console.error("Error updating private event:", error);
      return c.json({ error: "Failed to update private event" }, 500);
    }
  },

  // Delete a private event
  async deletePrivateEventHandler(c: Context) {
    try {
      const id = c.req.param("id");
      const success = await privateEventService.deleteEvent(id);

      if (!success) {
        return c.json({ error: "Private event not found" }, 404);
      }

      return c.json({ message: "Private event deleted successfully" });
    } catch (error) {
      console.error("Error deleting private event:", error);
      return c.json({ error: "Failed to delete private event" }, 500);
    }
  },

  // Get events created by a user
  async getEventsByCreatorHandler(c: Context) {
    try {
      const creatorId = c.req.param("userId");
      const limit = parseInt(c.req.query("limit") || "10");
      const offset = parseInt(c.req.query("offset") || "0");

      const result = await privateEventService.getEventsByCreator(creatorId, { limit, offset });
      return c.json(result);
    } catch (error) {
      console.error("Error fetching creator's private events:", error);
      return c.json({ error: "Failed to fetch private events" }, 500);
    }
  },

  // Get events where a user is invited
  async getInvitedEventsHandler(c: Context) {
    try {
      const userId = c.req.param("userId");
      const limit = parseInt(c.req.query("limit") || "10");
      const offset = parseInt(c.req.query("offset") || "0");

      const result = await privateEventService.getInvitedEvents(userId, { limit, offset });
      return c.json(result);
    } catch (error) {
      console.error("Error fetching invited events:", error);
      return c.json({ error: "Failed to fetch invited events" }, 500);
    }
  },
};
