// src/handlers/eventHandlers.ts

import type { Context } from "hono";
import type { AppContext } from "../types/context";
import { Buffer } from "buffer";
import type { CategoryProcessingService } from "../services/CategoryProcessingService";
import { RecurrenceFrequency, DayOfWeek } from "../entities/Event";

// Define a type for our handler functions
export type EventHandler = (
  c: Context<AppContext>,
) => Promise<Response> | Response;

export const getNearbyEventsHandler: EventHandler = async (c) => {
  try {
    const lat = c.req.query("lat");
    const lng = c.req.query("lng");
    const radius = c.req.query("radius");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    if (!lat || !lng) {
      return c.json(
        { error: "Missing required query parameters: lat and lng" },
        400,
      );
    }

    // Now c.get("eventService") is properly typed!
    const eventService = c.get("eventService");

    const nearbyEvents = await eventService.getNearbyEvents(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : undefined,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    return c.json(nearbyEvents);
  } catch (error) {
    console.error("Error fetching nearby events:", error);
    return c.json({ error: "Failed to fetch nearby events" }, 500);
  }
};

export const getCategoriesHandler: EventHandler = async (c) => {
  try {
    const eventService = c.get("eventService");
    const categories = await eventService.getAllCategories();
    return c.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return c.json({ error: "Failed to fetch categories" }, 500);
  }
};

export const getEventsByCategoriesHandler: EventHandler = async (c) => {
  try {
    const categoryIds = c.req.query("categories")?.split(",");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const limit = c.req.query("limit");
    const offset = c.req.query("offset");

    if (!categoryIds || categoryIds.length === 0) {
      return c.json(
        { error: "Missing required query parameter: categories" },
        400,
      );
    }

    const eventService = c.get("eventService");
    const result = await eventService.getEventsByCategories(categoryIds, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    return c.json(result);
  } catch (error) {
    console.error("Error fetching events by categories:", error);
    return c.json({ error: "Failed to fetch events by categories" }, 500);
  }
};

export const searchEventsHandler: EventHandler = async (c) => {
  try {
    const query = c.req.query("q");
    const limit = c.req.query("limit");
    const cursor = c.req.query("cursor");

    if (!query) {
      return c.json({ error: "Missing required query parameter: q" }, 400);
    }

    const eventService = c.get("eventService");
    const { results: searchResults, nextCursor } =
      await eventService.searchEvents(
        query,
        limit ? parseInt(limit) : undefined,
        cursor || undefined,
      );

    return c.json({
      query,
      results: searchResults.map(({ event, score }) => ({
        ...event,
        _score: score,
      })),
      nextCursor,
    });
  } catch (error) {
    console.error("Error searching events:", error);
    return c.json(
      {
        error: "Failed to search events",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const processEventImageHandler: EventHandler = async (c) => {
  try {
    // Extract form data from the request
    const formData = await c.req.formData();
    const imageEntry = formData.get("image");
    const userLat = formData.get("userLat");
    const userLng = formData.get("userLng");
    const user = c.get("user");

    console.log("userLat", userLat);
    console.log("userLng", userLng);
    console.log("imageEntry", imageEntry);

    const userCoordinates =
      userLat && userLng
        ? {
            lat: parseFloat(userLat.toString()),
            lng: parseFloat(userLng.toString()),
          }
        : null;

    if (!user || !user?.userId) {
      return c.json({ error: "Missing user id" }, 404);
    }

    // Get job queue and plan service from context
    const jobQueue = c.get("jobQueue");
    const planService = c.get("planService");

    // Check if user has reached their scan limit
    const hasReachedLimit = await planService.hasReachedScanLimit(user.userId);
    if (hasReachedLimit) {
      return c.json(
        {
          error: "Scan limit reached",
          message:
            "You have reached your weekly scan limit. Please upgrade to Pro for more scans.",
        },
        403,
      );
    }

    // Increment scan count before processing
    await planService.incrementWeeklyScanCount(user.userId);

    // Validate the image
    if (!imageEntry) {
      return c.json({ error: "Missing image file" }, 400);
    }

    // Ensure imageEntry is treated as a File object
    if (typeof imageEntry === "string") {
      return c.json({ error: "Invalid file upload" }, 400);
    }

    const file = imageEntry as File;

    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return c.json(
        { error: "Invalid file type. Only JPEG and PNG files are allowed" },
        400,
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create job with minimal metadata
    const jobId = await jobQueue.enqueue(
      "process_flyer",
      {
        filename: file.name,
        contentType: file.type,
        size: buffer.length,
        userCoordinates: userCoordinates,
        creatorId: user.userId,
        authToken: c.req.header("Authorization"),
      },
      {
        bufferData: buffer,
      },
    );

    return c.json(
      {
        status: "processing",
        jobId,
        message:
          "Your image is being processed. Check status at /api/jobs/" + jobId,
        _links: {
          self: `/api/events/process/${jobId}`,
          status: `/api/jobs/${jobId}`,
          stream: `/api/jobs/${jobId}/stream`,
        },
      },
      202,
    );
  } catch (error) {
    console.error("Error submitting flyer for processing:", error);
    return c.json({ error: "Failed to process flyer image" }, 500);
  }
};

export const getProcessingStatusHandler: EventHandler = async (c) => {
  const jobId = c.req.param("jobId");
  const jobQueue = c.get("jobQueue");
  const eventService = c.get("eventService");

  // Get job status
  const job = await jobQueue.getJobStatus(jobId);

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  // If job is complete and has an event ID, fetch the event details
  if (job.status === "completed" && job.eventId) {
    const event = await eventService.getEventById(job.eventId);
    if (event) {
      return c.json({
        ...job,
        event: event,
      });
    }
  }

  // Otherwise just return the job status
  return c.json(job);
};

export const getUserJobsHandler: EventHandler = async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not authenticated" }, 401);
  }

  const userId = user.id;
  const jobQueue = c.get("jobQueue");

  // Get limit from query parameter, default to 50
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  // Validate limit parameter
  if (limitParam && (isNaN(limit) || limit < 1 || limit > 1000)) {
    return c.json(
      { error: "Invalid limit parameter. Must be between 1 and 1000." },
      400,
    );
  }

  try {
    const jobs = await jobQueue.getUserJobs(userId, limit);
    return c.json({ jobs });
  } catch (error) {
    console.error("Error fetching user jobs:", error);
    return c.json({ error: "Failed to fetch jobs" }, 500);
  }
};

export const getJobProgressContextHandler: EventHandler = async (c) => {
  const jobId = c.req.param("jobId");
  const redisService = c.get("redisService");

  try {
    // Get the job progress context
    const contextKey = `job:${jobId}:progress`;
    const progressContext = await redisService.get(contextKey);

    if (!progressContext) {
      return c.json({ error: "Job progress context not found" }, 404);
    }

    return c.json(progressContext);
  } catch (error) {
    console.error("Error fetching job progress context:", error);
    return c.json({ error: "Failed to fetch job progress" }, 500);
  }
};

export const createEventHandler: EventHandler = async (c) => {
  try {
    const eventService = c.get("eventService");
    const embeddingService = c.get("embeddingService");
    const redisPub = c.get("redisClient");
    const storageService = c.get("storageService");
    const user = c.get("user");
    const categoryProcessingService = c.get("categoryProcessingService") as
      | CategoryProcessingService
      | undefined;

    let data: Partial<{
      title: string;
      description?: string;
      eventDate: string | Date;
      endDate?: string | Date;
      emoji?: string;
      emojiDescription?: string;
      address?: string;
      locationNotes?: string;
      isPrivate?: boolean;
      sharedWithIds?: string[];
      location: { type: "Point"; coordinates: number[] };
      categories?: Array<{ id: string; name: string }>;
      categoryIds?: string[];
      creatorId: string;
      originalImageUrl?: string | null;
      embedding?: number[];
      confidenceScore?: number;
      timezone?: string;
      qrDetectedInImage?: boolean;
      detectedQrData?: string;
      isRecurring?: boolean;
      recurrenceFrequency?: RecurrenceFrequency;
      recurrenceDays?: DayOfWeek[];
      recurrenceTime?: string;
      recurrenceStartDate?: Date;
      recurrenceEndDate?: Date;
      recurrenceInterval?: number;
    }>;
    let originalImageUrl: string | null = null;

    // Check if the request contains form data (for image uploads)
    const contentType = c.req.header("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // Handle form data with potential image upload
      const formData = await c.req.formData();
      const imageEntry = formData.get("image");

      // Upload image if provided
      if (imageEntry && typeof imageEntry !== "string") {
        const file = imageEntry as File;

        // Validate file type
        const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
        if (!allowedTypes.includes(file.type)) {
          return c.json(
            { error: "Invalid file type. Only JPEG and PNG files are allowed" },
            400,
          );
        }

        // Convert file to buffer and upload
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        originalImageUrl = await storageService.uploadImage(
          buffer,
          "event-images",
          {
            filename: file.name,
            contentType: file.type,
            size: buffer.length.toString(),
            uploadedBy: user?.userId || "unknown",
          },
        );
      }

      // Parse other form data
      const eventData = formData.get("eventData");
      if (eventData && typeof eventData === "string") {
        try {
          data = JSON.parse(eventData);
        } catch (error) {
          return c.json({ error: "Invalid event data format" }, 400);
        }
      } else {
        // Extract individual fields from form data
        data = {
          title: formData.get("title")?.toString() || "",
          description: formData.get("description")?.toString(),
          eventDate: formData.get("eventDate")?.toString()
            ? new Date(formData.get("eventDate")!.toString())
            : undefined,
          endDate: formData.get("endDate")?.toString()
            ? new Date(formData.get("endDate")!.toString())
            : undefined,
          emoji: formData.get("emoji")?.toString() || "📍",
          emojiDescription: formData.get("emojiDescription")?.toString(),
          address: formData.get("address")?.toString(),
          locationNotes: formData.get("locationNotes")?.toString(),
          isPrivate: formData.get("isPrivate") === "true",
          sharedWithIds: formData.get("sharedWithIds")
            ? (formData.get("sharedWithIds") as string).split(",")
            : [],
        };

        // Handle location coordinates
        const lat = formData.get("lat");
        const lng = formData.get("lng");
        if (lat && lng) {
          data.location = {
            type: "Point",
            coordinates: [
              parseFloat(lat.toString()),
              parseFloat(lng.toString()),
            ],
          };
        }

        // Handle categories
        const categories = formData.get("categories");
        if (categories && typeof categories === "string") {
          try {
            data.categories = JSON.parse(categories);
          } catch (error) {
            // If not JSON, treat as comma-separated category IDs
            data.categoryIds = categories.split(",");
          }
        }
      }
    } else {
      // Handle JSON data (existing behavior)
      data = await c.req.json();
    }

    // Validate input
    if (!data.title || !data.eventDate || !data.location?.coordinates) {
      return c.json(
        { error: "Missing required fields", receivedData: data },
        400,
      );
    }

    // Ensure location is in GeoJSON format
    if (data.location && !data.location.type) {
      data.location = {
        type: "Point",
        coordinates: data.location.coordinates,
      };
    }

    if (!user?.userId) {
      return c.json({ error: "Missing user id" });
    }

    data.creatorId = user.userId;

    // Add the uploaded image URL if available
    if (originalImageUrl) {
      data.originalImageUrl = originalImageUrl;
    }

    // Automatically generate categories if not provided
    if (!data.categories || data.categories.length === 0) {
      // Use title and description for category extraction
      const text = `${data.title}\n${data.description || ""}`;
      if (categoryProcessingService) {
        const processedCategories =
          await categoryProcessingService.extractAndProcessCategories(text);
        // Convert Category objects to categoryIds for the service
        data.categoryIds = processedCategories.map((cat) => cat.id);
        // Also keep the full categories for embedding generation
        data.categories = processedCategories;
      }
    } else {
      // If categories are provided, convert them to categoryIds
      data.categoryIds = data.categories.map((cat: { id: string } | string) =>
        typeof cat === "string" ? cat : cat.id,
      );
    }

    // Generate embedding if not provided
    if (!data.embedding) {
      console.log(
        "[createEventHandler] Generating embedding for event:",
        data.title,
      );

      // Create text for embedding using the same format as EventProcessingService
      const textForEmbedding = `
        TITLE: ${data.title} ${data.title} ${data.title}
        EMOJI: ${data.emoji || "📍"} - ${data.emojiDescription || ""}
        CATEGORIES: ${data.categories?.map((c: { name: string }) => c.name).join(", ") || ""}
        DESCRIPTION: ${data.description || ""}
        LOCATION: ${data.address || ""}
        LOCATION_NOTES: ${data.locationNotes || ""}
      `.trim();

      try {
        data.embedding = await embeddingService.getEmbedding(textForEmbedding);
        console.log("[createEventHandler] Generated embedding successfully");
      } catch (embeddingError) {
        console.error(
          "[createEventHandler] Error generating embedding:",
          embeddingError,
        );
        // Continue without embedding - the event can still be created
        data.embedding = [];
      }
    }

    // Ensure required fields are present and convert to CreateEventInput format
    const eventInput = {
      emoji: data.emoji || "📍",
      emojiDescription: data.emojiDescription,
      title: data.title!,
      description: data.description,
      eventDate:
        typeof data.eventDate === "string"
          ? new Date(data.eventDate)
          : data.eventDate!,
      endDate: data.endDate
        ? typeof data.endDate === "string"
          ? new Date(data.endDate)
          : data.endDate
        : undefined,
      location: data.location!,
      categoryIds: data.categoryIds,
      confidenceScore: data.confidenceScore,
      address: data.address,
      locationNotes: data.locationNotes,
      creatorId: data.creatorId!,
      timezone: data.timezone,
      qrDetectedInImage: data.qrDetectedInImage,
      detectedQrData: data.detectedQrData,
      originalImageUrl: data.originalImageUrl,
      embedding: data.embedding || [],
      isPrivate: data.isPrivate,
      sharedWithIds: data.sharedWithIds,
      isRecurring: data.isRecurring,
      recurrenceFrequency: data.recurrenceFrequency as
        | RecurrenceFrequency
        | undefined,
      recurrenceDays: data.recurrenceDays as DayOfWeek[] | undefined,
      recurrenceTime: data.recurrenceTime,
      recurrenceStartDate: data.recurrenceStartDate,
      recurrenceEndDate: data.recurrenceEndDate,
      recurrenceInterval: data.recurrenceInterval,
    };

    const newEvent = await eventService.createEvent(eventInput);

    // Publish to Redis for WebSocket service to broadcast
    await redisPub.publish(
      "event_changes",
      JSON.stringify({
        operation: "INSERT",
        record: newEvent,
      }),
    );

    return c.json(newEvent);
  } catch (error) {
    console.error("Error creating event:", error);
    return c.json({ error: "Failed to create event" }, 500);
  }
};

export const deleteEventHandler: EventHandler = async (c) => {
  try {
    const id = c.req.param("id");
    const eventService = c.get("eventService");
    const redisPub = c.get("redisClient");
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const event = await eventService.getEventById(id);
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    // Check if user has access to delete the event
    const hasAccess = await eventService.hasEventAccess(id, user.userId);

    console.log("hasAccess", hasAccess);

    if (!hasAccess) {
      return c.json(
        { error: "You don't have permission to delete this event" },
        403,
      );
    }

    const isSuccess = await eventService.deleteEvent(id);

    if (isSuccess && event) {
      await redisPub.publish(
        "event_changes",
        JSON.stringify({
          operation: "DELETE",
          record: {
            id: event.id,
            location: event.location,
          },
        }),
      );
    }

    return c.json({ success: isSuccess });
  } catch (error) {
    console.error("Error deleting event:", error);
    return c.json({ error: "Failed to delete event" }, 500);
  }
};

export const updateEventHandler: EventHandler = async (c) => {
  try {
    const id = c.req.param("id");
    const eventService = c.get("eventService");
    const redisPub = c.get("redisClient");
    const storageService = c.get("storageService");
    const user = c.get("user");

    let data: Partial<{
      title?: string;
      description?: string;
      eventDate?: Date;
      endDate?: Date;
      emoji?: string;
      emojiDescription?: string;
      address?: string;
      locationNotes?: string;
      isPrivate?: boolean;
      sharedWithIds?: string[];
      location?: { type: "Point"; coordinates: number[] };
      categories?: Array<{ id: string; name: string }>;
      categoryIds?: string[];
      originalImageUrl?: string | null;
    }>;
    let originalImageUrl: string | null = null;

    // Check if the request contains form data (for image uploads)
    const contentType = c.req.header("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // Handle form data with potential image upload
      const formData = await c.req.formData();
      const imageEntry = formData.get("image");

      // Upload image if provided
      if (imageEntry && typeof imageEntry !== "string") {
        const file = imageEntry as File;

        // Validate file type
        const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
        if (!allowedTypes.includes(file.type)) {
          return c.json(
            { error: "Invalid file type. Only JPEG and PNG files are allowed" },
            400,
          );
        }

        // Convert file to buffer and upload
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        originalImageUrl = await storageService.uploadImage(
          buffer,
          "event-images",
          {
            filename: file.name,
            contentType: file.type,
            size: buffer.length.toString(),
            uploadedBy: user?.userId || "unknown",
            eventId: id,
          },
        );
      }

      // Parse other form data
      const eventData = formData.get("eventData");
      if (eventData && typeof eventData === "string") {
        try {
          data = JSON.parse(eventData);
        } catch (error) {
          return c.json({ error: "Invalid event data format" }, 400);
        }
      } else {
        // Extract individual fields from form data
        data = {
          title: formData.get("title")?.toString(),
          description: formData.get("description")?.toString(),
          eventDate: formData.get("eventDate")?.toString()
            ? new Date(formData.get("eventDate")!.toString())
            : undefined,
          endDate: formData.get("endDate")?.toString()
            ? new Date(formData.get("endDate")!.toString())
            : undefined,
          emoji: formData.get("emoji")?.toString(),
          emojiDescription: formData.get("emojiDescription")?.toString(),
          address: formData.get("address")?.toString(),
          locationNotes: formData.get("locationNotes")?.toString(),
          isPrivate: formData.get("isPrivate") === "true",
          sharedWithIds: formData.get("sharedWithIds")
            ? (formData.get("sharedWithIds") as string).split(",")
            : [],
        };

        // Handle location coordinates
        const lat = formData.get("lat");
        const lng = formData.get("lng");
        if (lat && lng) {
          data.location = {
            type: "Point",
            coordinates: [
              parseFloat(lat.toString()),
              parseFloat(lng.toString()),
            ],
          };
        }

        // Handle categories
        const categories = formData.get("categories");
        if (categories && typeof categories === "string") {
          try {
            data.categories = JSON.parse(categories);
          } catch (error) {
            // If not JSON, treat as comma-separated category IDs
            data.categoryIds = categories.split(",");
          }
        }
      }
    } else {
      // Handle JSON data (existing behavior)
      data = await c.req.json();
    }

    console.log({ id, data });

    if (!user?.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    // Check if the event exists
    const event = await eventService.getEventById(id);
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    // Check if user has access to update the event
    const hasAccess = await eventService.hasEventAccess(id, user.userId);
    if (!hasAccess) {
      return c.json(
        { error: "You don't have permission to update this event" },
        403,
      );
    }

    // Add the uploaded image URL if available
    if (originalImageUrl) {
      data.originalImageUrl = originalImageUrl;
    }

    // Convert string dates to Date objects if needed
    if (data.eventDate && typeof data.eventDate === "string") {
      data.eventDate = new Date(data.eventDate);
    }
    if (data.endDate && typeof data.endDate === "string") {
      data.endDate = new Date(data.endDate);
    }

    // Ensure location is in GeoJSON format if provided
    if (data.location && !data.location.type) {
      data.location = {
        type: "Point",
        coordinates: data.location.coordinates,
      };
    }

    const updatedEvent = await eventService.updateEvent(id, data);

    if (updatedEvent) {
      // Publish to Redis for WebSocket service to broadcast
      await redisPub.publish(
        "event_changes",
        JSON.stringify({
          operation: "UPDATE",
          record: updatedEvent,
        }),
      );
    }

    return c.json(updatedEvent);
  } catch (error) {
    console.error("Error updating event:", error);
    return c.json(
      {
        error: "Failed to update event",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const getEventByIdHandler: EventHandler = async (c) => {
  try {
    const id = c.req.param("id");
    console.log({ idParam: id });
    const eventService = c.get("eventService");
    const event = await eventService.getEventById(id);

    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    return c.json(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    return c.json({ error: "Failed to fetch event" }, 500);
  }
};

export const getAllEventsHandler: EventHandler = async (c) => {
  try {
    const limit = c.req.query("limit");
    const offset = c.req.query("offset");
    const eventService = c.get("eventService");

    console.log("Fetching all events with limit:", limit, "offset:", offset);

    const eventsData = await eventService.getEvents({
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    console.log(`Retrieved ${eventsData.length} events from database`);

    // For each private event, get its shares
    const eventsWithShares = await Promise.all(
      eventsData.map(async (event) => {
        if (event.isPrivate) {
          console.log(`Fetching shares for private event ${event.id}`);
          const shares = await eventService.getEventShares(event.id);
          console.log(`Found ${shares.length} shares for event ${event.id}`);
          return {
            ...event,
            sharedWith: shares,
          };
        }
        return event;
      }),
    );

    console.log(`Returning ${eventsWithShares.length} events with shares`);

    // Return data in the format expected by the filter processor
    return c.json({
      events: eventsWithShares,
      total: eventsWithShares.length,
      hasMore: false, // Since we're not implementing pagination in the backend yet
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return c.json({ error: "Failed to fetch events" }, 500);
  }
};

// Add this to src/handlers/eventHandlers.ts

export const toggleSaveEventHandler: EventHandler = async (c) => {
  try {
    const eventId = c.req.param("id");
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    if (!eventId) {
      return c.json({ error: "Missing event ID" }, 400);
    }

    const eventService = c.get("eventService");

    // Check if the event exists first
    const event = await eventService.getEventById(eventId);
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    // Toggle save status
    const result = await eventService.toggleSaveEvent(user.userId, eventId);

    return c.json({
      eventId,
      ...result,
    });
  } catch (error) {
    console.error("Error toggling event save status:", error);
    return c.json(
      {
        error: "Failed to toggle event save status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const getSavedEventsHandler: EventHandler = async (c) => {
  try {
    const user = c.get("user");
    const limit = c.req.query("limit");
    const cursor = c.req.query("cursor");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const eventService = c.get("eventService");

    const savedEvents = await eventService.getSavedEventsByUser(user.userId, {
      limit: limit ? parseInt(limit) : undefined,
      cursor: cursor,
    });

    return c.json(savedEvents);
  } catch (error) {
    console.error("Error fetching saved events:", error);
    return c.json(
      {
        error: "Failed to fetch saved events",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const isEventSavedHandler: EventHandler = async (c) => {
  try {
    const eventId = c.req.param("id");
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    if (!eventId) {
      return c.json({ error: "Missing event ID" }, 400);
    }

    const eventService = c.get("eventService");

    // Check if the event exists
    const event = await eventService.getEventById(eventId);
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    // Check if the event is saved by the user
    const isSaved = await eventService.isEventSavedByUser(user.userId, eventId);

    return c.json({
      eventId,
      isSaved,
    });
  } catch (error) {
    console.error("Error checking event save status:", error);
    return c.json(
      {
        error: "Failed to check event save status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const getDiscoveredEventsHandler: EventHandler = async (c) => {
  try {
    const user = c.get("user");
    const limit = c.req.query("limit");
    const cursor = c.req.query("cursor");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const eventService = c.get("eventService");

    const discoveredEvents = await eventService.getDiscoveredEventsByUser(
      user.userId,
      {
        limit: limit ? parseInt(limit) : undefined,
        cursor: cursor,
      },
    );

    return c.json(discoveredEvents);
  } catch (error) {
    console.error("Error fetching discovered events:", error);
    return c.json(
      {
        error: "Failed to fetch discovered events",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const getClusterHubDataHandler: EventHandler = async (c) => {
  try {
    const data = await c.req.json();
    const { markerIds } = data;

    if (!markerIds || !Array.isArray(markerIds)) {
      return c.json({ error: "Missing or invalid markerIds array" }, 400);
    }

    const eventService = c.get("eventService");
    const hubData = await eventService.getClusterHubData(markerIds);

    return c.json(hubData);
  } catch (error) {
    console.error("Error fetching cluster hub data:", error);
    return c.json(
      {
        error: "Failed to fetch cluster hub data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const getFriendsSavedEventsHandler: EventHandler = async (c) => {
  try {
    const user = c.get("user");
    const limit = c.req.query("limit");
    const cursor = c.req.query("cursor");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const eventService = c.get("eventService");

    const savedEvents = await eventService.getFriendsSavedEvents(user.userId, {
      limit: limit ? parseInt(limit) : undefined,
      cursor: cursor,
    });

    return c.json(savedEvents);
  } catch (error) {
    console.error("Error fetching friends' saved events:", error);
    return c.json(
      {
        error: "Failed to fetch friends' saved events",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const createPrivateEventHandler: EventHandler = async (c) => {
  try {
    const data = await c.req.json();
    const jobQueue = c.get("jobQueue");
    const user = c.get("user");
    const notificationService = c.get("notificationService");

    // Validate input
    if (!data.title || !data.date || !data.location?.coordinates) {
      return c.json(
        { error: "Missing required fields", receivedData: data },
        400,
      );
    }

    // Ensure location is in GeoJSON format
    if (data.location && !data.location.type) {
      data.location = {
        type: "Point",
        coordinates: data.location.coordinates,
      };
    }

    if (!user?.userId) {
      return c.json({ error: "Missing user id" }, 401);
    }

    // Validate shared users if provided
    if (data.sharedWithIds && !Array.isArray(data.sharedWithIds)) {
      return c.json({ error: "sharedWithIds must be an array" }, 400);
    }

    // Create job for private event processing
    const jobId = await jobQueue.enqueuePrivateEventJob(
      {
        emoji: data.emoji,
        emojiDescription: data.emojiDescription,
        title: data.title,
        date: data.date,
        endDate: data.endDate,
        address: data.address,
        location: data.location,
        description: data.description,
        categories: data.categories,
        timezone: data.timezone,
        locationNotes: data.locationNotes,
      },
      user.userId,
      data.sharedWithIds || [],
      data.userCoordinates,
    );

    // Notify the creator
    await notificationService.createNotification(
      user.userId,
      "EVENT_CREATED",
      "Private Event Created",
      `Your private event "${data.title}" is being processed`,
      {
        jobId,
        eventTitle: data.title,
        coordinates: data.location.coordinates,
        id: data.id,
      },
    );

    // Notify invited users
    if (data.sharedWithIds?.length > 0) {
      await Promise.all(
        data.sharedWithIds.map((invitedUserId: string) =>
          notificationService.createNotification(
            invitedUserId,
            "EVENT_CREATED",
            "New Event Invitation",
            `${user.email} has invited you to "${data.title}"`,
            {
              jobId,
              eventTitle: data.title,
              creatorId: user.userId,
              id: data.id,
              coordinates: data.location.coordinates,
            },
          ),
        ),
      );
    }

    return c.json(
      {
        status: "processing",
        jobId,
        message:
          "Your private event is being processed. Check status at /api/jobs/" +
          jobId,
        _links: {
          self: `/api/events/process/${jobId}`,
          status: `/api/jobs/${jobId}`,
          stream: `/api/jobs/${jobId}/stream`,
        },
      },
      202,
    );
  } catch (error) {
    console.error("Error creating private event:", error);
    return c.json(
      {
        error: "Failed to create private event",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const toggleRsvpEventHandler: EventHandler = async (c) => {
  try {
    const eventId = c.req.param("id");
    const user = c.get("user");
    const { status } = await c.req.json();

    const notificationService = c.get("notificationService");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    if (!eventId) {
      return c.json({ error: "Missing event ID" }, 400);
    }

    if (!status || !["GOING", "NOT_GOING"].includes(status)) {
      return c.json({ error: "Invalid RSVP status" }, 400);
    }

    const eventService = c.get("eventService");

    // Check if the event exists
    const event = await eventService.getEventById(eventId);
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    // Toggle RSVP status
    const result = await eventService.toggleRsvpEvent(
      user.userId,
      eventId,
      status,
    );

    // Notify creator RSVP status

    if (result.status === "GOING") {
      notificationService.createNotification(
        event.creatorId || "",
        "EVENT_RSVP_TOGGLED",
        `${user.email} is going to ${event.title}`,
        `${user.email} is going to ${event.title}`,
      );
    }

    return c.json({
      eventId,
      ...result,
    });
  } catch (error) {
    console.error("Error toggling event RSVP status:", error);
    return c.json(
      {
        error: "Failed to toggle event RSVP status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const isEventRsvpedHandler: EventHandler = async (c) => {
  try {
    const eventId = c.req.param("id");
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    if (!eventId) {
      return c.json({ error: "Missing event ID" }, 400);
    }

    const eventService = c.get("eventService");

    // Check if the event exists
    const event = await eventService.getEventById(eventId);
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    // Check if user has RSVP'd
    const rsvp = await eventService.getUserRsvpStatus(user.userId, eventId);
    const isRsvped = rsvp?.status === "GOING";

    return c.json({
      isRsvped,
    });
  } catch (error) {
    console.error("Error checking event RSVP status:", error);
    return c.json(
      {
        error: "Failed to check event RSVP status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const getEventSharesHandler: EventHandler = async (c) => {
  try {
    const eventId = c.req.param("id");
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    if (!eventId) {
      return c.json({ error: "Missing event ID" }, 400);
    }

    const eventService = c.get("eventService");

    // Check if the event exists
    const event = await eventService.getEventById(eventId);
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    // Check if user has access to view shares
    const hasAccess = await eventService.hasEventAccess(eventId, user.userId);
    if (!hasAccess) {
      return c.json(
        { error: "You don't have permission to view this event's shares" },
        403,
      );
    }

    // Get the shares
    const shares = await eventService.getEventShares(eventId);

    return c.json(shares);
  } catch (error) {
    console.error("Error fetching event shares:", error);
    return c.json(
      {
        error: "Failed to fetch event shares",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const getEventsByCategoryHandler: EventHandler = async (c) => {
  try {
    const categoryId = c.req.param("categoryId");
    const limit = c.req.query("limit");
    const cursor = c.req.query("cursor");

    if (!categoryId) {
      return c.json({ error: "Missing required parameter: categoryId" }, 400);
    }

    const eventService = c.get("eventService");
    const result = await eventService.getEventsByCategory(categoryId, {
      limit: limit ? parseInt(limit) : undefined,
      cursor: cursor,
    });

    return c.json(result);
  } catch (error) {
    console.error("Error fetching events by category:", error);
    return c.json(
      {
        error: "Failed to fetch events by category",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const getEventEngagementHandler: EventHandler = async (c) => {
  try {
    const eventId = c.req.param("id");

    if (!eventId) {
      return c.json({ error: "Missing event ID" }, 400);
    }

    const eventService = c.get("eventService");

    // Check if the event exists
    const event = await eventService.getEventById(eventId);
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    // Get engagement metrics
    const engagement = await eventService.getEventEngagement(eventId);

    return c.json(engagement);
  } catch (error) {
    console.error("Error fetching event engagement:", error);
    return c.json(
      {
        error: "Failed to fetch event engagement",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const trackEventViewHandler: EventHandler = async (c) => {
  try {
    const eventId = c.req.param("id");
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    if (!eventId) {
      return c.json({ error: "Missing event ID" }, 400);
    }

    const eventService = c.get("eventService");

    // Check if the event exists
    const event = await eventService.getEventById(eventId);
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    // Track the view
    await eventService.createViewRecord(user.userId, eventId);

    return c.json({
      success: true,
      message: "Event view tracked successfully",
    });
  } catch (error) {
    console.error("Error tracking event view:", error);
    return c.json(
      {
        error: "Failed to track event view",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};
