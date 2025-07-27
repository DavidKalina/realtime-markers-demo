// src/handlers/eventHandlers.ts

import { Buffer } from "buffer";
import type { CategoryProcessingService } from "../services/CategoryProcessingService";
import { RsvpStatus } from "@realtime-markers/database";
import {
  processEventFormData,
  validateEventData,
  processCategories,
  generateEmbedding,
  prepareCreateEventInput,
  processEventUpdateFormData,
  prepareUpdateData,
} from "../utils";
import {
  withErrorHandling,
  requireAuth,
  requireParam,
  requireQueryParam,
  requireEvent,
  requireBodyField,
  validateEnum,
  getEventService,
  getJobQueue,
  type Handler,
} from "../utils/handlerUtils";

// Define a type for our handler functions
export type EventHandler = Handler;

export const getNearbyEventsHandler: EventHandler = withErrorHandling(
  async (c) => {
    const lat = requireQueryParam(c, "lat");
    const lng = requireQueryParam(c, "lng");
    const radius = c.req.query("radius");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    const eventService = getEventService(c);
    const nearbyEvents = await eventService.getNearbyEvents(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : undefined,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    return c.json(nearbyEvents);
  },
);

export const getCategoriesHandler: EventHandler = withErrorHandling(
  async (c) => {
    const eventService = getEventService(c);
    const categories = await eventService.getAllCategories();
    return c.json(categories);
  },
);

export const getEventsByCategoriesHandler: EventHandler = withErrorHandling(
  async (c) => {
    const categoriesParam = requireQueryParam(c, "categories");
    const categoryIds = categoriesParam.split(",");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const limit = c.req.query("limit");
    const offset = c.req.query("offset");

    if (categoryIds.length === 0) {
      throw new Error("Categories parameter cannot be empty");
    }

    const eventService = getEventService(c);
    const result = await eventService.getEventsByCategories(categoryIds, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    return c.json(result);
  },
);

export const searchEventsHandler: EventHandler = withErrorHandling(
  async (c) => {
    const query = requireQueryParam(c, "q");
    const limit = c.req.query("limit");
    const cursor = c.req.query("cursor");

    const eventService = getEventService(c);
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
  },
);

export const processEventImageHandler: EventHandler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);

    // Extract form data from the request
    const formData = await c.req.formData();
    const imageEntry = formData.get("image");
    const userLat = formData.get("userLat");
    const userLng = formData.get("userLng");

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

    // Get job queue from context
    const jobQueue = getJobQueue(c);

    // Validate the image
    if (!imageEntry) {
      throw new Error("Missing image file");
    }

    // Ensure imageEntry is treated as a File object
    if (typeof imageEntry === "string") {
      throw new Error("Invalid file upload");
    }

    const file = imageEntry as File;

    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Invalid file type. Only JPEG and PNG files are allowed");
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
        creatorId: user.id,
        authToken: c.req.header("Authorization") || undefined,
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
  },
);

export const getProcessingStatusHandler: EventHandler = withErrorHandling(
  async (c) => {
    const jobId = requireParam(c, "jobId");
    const jobQueue = getJobQueue(c);
    const eventService = getEventService(c);

    // Get job status
    const job = await jobQueue.getJobStatus(jobId);

    if (!job) {
      throw new Error("Job not found");
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
  },
);

export const getUserJobsHandler: EventHandler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const jobQueue = getJobQueue(c);

  // Get limit from query parameter, default to 50
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  // Validate limit parameter
  if (limitParam && (isNaN(limit) || limit < 1 || limit > 1000)) {
    throw new Error("Invalid limit parameter. Must be between 1 and 1000.");
  }

  const jobs = await jobQueue.getUserJobs(user.id, limit);
  return c.json({ jobs });
});

export const getJobProgressContextHandler: EventHandler = withErrorHandling(
  async (c) => {
    const jobId = requireParam(c, "jobId");
    const redisService = c.get("redisService");

    // Get the job progress context
    const contextKey = `job:${jobId}:progress`;
    const progressContext = await redisService.get(contextKey);

    if (!progressContext) {
      throw new Error("Job progress context not found");
    }

    return c.json(progressContext);
  },
);

export const createEventHandler: EventHandler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const eventService = getEventService(c);
  const embeddingService = c.get("embeddingService");
  const storageService = c.get("storageService");
  const categoryProcessingService = c.get("categoryProcessingService") as
    | CategoryProcessingService
    | undefined;

  // Process form data and extract event data
  const { data, originalImageUrl } = await processEventFormData(
    c,
    storageService,
    user,
  );

  // Validate the event data
  try {
    validateEventData(data);
  } catch (validationError) {
    throw new Error(
      validationError instanceof Error
        ? validationError.message
        : "Validation failed",
    );
  }

  // Process categories
  const processedData = await processCategories(
    data,
    categoryProcessingService,
  );

  // Generate embedding
  const dataWithEmbedding = await generateEmbedding(
    processedData,
    embeddingService,
  );

  // Prepare the final CreateEventInput
  const eventInput = prepareCreateEventInput(
    dataWithEmbedding,
    user,
    originalImageUrl,
  );

  // Create the event
  const newEvent = await eventService.createEvent(eventInput);

  // Create discovery record for the creator
  if (user?.id) {
    await eventService.createDiscoveryRecord(user.id, newEvent.id);
  }

  return c.json(newEvent);
});

export const deleteEventHandler: EventHandler = withErrorHandling(async (c) => {
  const id = requireParam(c, "id");
  const user = requireAuth(c);
  const eventService = getEventService(c);

  const event = await requireEvent(c, id);

  // Check if user is the creator of the event
  if (event.creatorId !== user.id && user.role !== "ADMIN") {
    throw new Error("You don't have permission to delete this event");
  }

  const isSuccess = await eventService.deleteEvent(id);

  return c.json({ success: isSuccess });
});

export const updateEventHandler: EventHandler = withErrorHandling(async (c) => {
  const id = requireParam(c, "id");
  const user = requireAuth(c);
  const eventService = getEventService(c);
  const storageService = c.get("storageService");
  const embeddingService = c.get("embeddingService");
  const categoryProcessingService = c.get("categoryProcessingService") as
    | CategoryProcessingService
    | undefined;

  // Check if the event exists
  const event = await requireEvent(c, id);

  // Check if user is the creator of the event
  if (event.creatorId !== user.id && user.role !== "ADMIN") {
    throw new Error("You don't have permission to update this event");
  }

  // Process form data and extract event data
  const { data, originalImageUrl } = await processEventUpdateFormData(
    c,
    storageService,
    user,
    id,
  );

  // Add the uploaded image URL if available
  if (originalImageUrl) {
    data.originalImageUrl = originalImageUrl;
  }

  // Prepare the update data (process categories, generate embeddings, etc.)
  const processedData = await prepareUpdateData(
    data,
    categoryProcessingService,
    embeddingService,
  );

  console.log({ id, processedData });

  const updatedEvent = await eventService.updateEvent(id, processedData);

  return c.json(updatedEvent);
});

export const getEventByIdHandler: EventHandler = withErrorHandling(
  async (c) => {
    const id = requireParam(c, "id");
    const event = await requireEvent(c, id);
    return c.json(event);
  },
);

export const getAllEventsHandler: EventHandler = withErrorHandling(
  async (c) => {
    const limit = c.req.query("limit");
    const offset = c.req.query("offset");
    const eventService = getEventService(c);

    console.log("Fetching all events with limit:", limit, "offset:", offset);

    const eventsData = await eventService.getEvents({
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    console.log(`Retrieved ${eventsData.length} events from database`);

    // Return data in the format expected by the filter processor
    return c.json({
      events: eventsData,
      total: eventsData.length,
      hasMore: false, // Since we're not implementing pagination in the backend yet
    });
  },
);

export const toggleSaveEventHandler: EventHandler = withErrorHandling(
  async (c) => {
    const eventId = requireParam(c, "id");
    const user = requireAuth(c);
    const eventService = getEventService(c);

    // Check if the event exists first
    await requireEvent(c, eventId);

    // Toggle save status
    const result = await eventService.toggleSaveEvent(user.id, eventId);

    return c.json({
      eventId,
      ...result,
    });
  },
);

export const getSavedEventsHandler: EventHandler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const limit = c.req.query("limit");
    const cursor = c.req.query("cursor");
    const eventService = getEventService(c);

    const savedEvents = await eventService.getSavedEventsByUser(user.id, {
      limit: limit ? parseInt(limit) : undefined,
      cursor: cursor,
    });

    return c.json(savedEvents);
  },
);

export const isEventSavedHandler: EventHandler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const eventId = requireParam(c, "id");
    const eventService = getEventService(c);

    // Check if the event exists
    await requireEvent(c, eventId);

    // Check if the event is saved by the user
    const isSaved = await eventService.isEventSavedByUser(user.id, eventId);

    return c.json({
      eventId,
      isSaved,
    });
  },
);

export const getDiscoveredEventsHandler: EventHandler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const limit = c.req.query("limit");
    const cursor = c.req.query("cursor");
    const eventService = getEventService(c);

    const discoveredEvents = await eventService.getDiscoveredEventsByUser(
      user.id,
      {
        limit: limit ? parseInt(limit) : undefined,
        cursor: cursor,
      },
    );

    return c.json(discoveredEvents);
  },
);

export const toggleRsvpEventHandler: EventHandler = withErrorHandling(
  async (c) => {
    const eventId = requireParam(c, "id");
    const user = requireAuth(c);
    const status = validateEnum(
      await requireBodyField<string>(c, "status"),
      ["GOING", "NOT_GOING"],
      "status",
    ) as RsvpStatus;

    const eventService = getEventService(c);

    const result = await eventService.toggleRsvpEvent(user.id, eventId, status);

    return c.json({
      eventId,
      ...result,
    });
  },
);

export const isEventRsvpedHandler: EventHandler = withErrorHandling(
  async (c) => {
    const eventId = requireParam(c, "id");
    const user = requireAuth(c);
    const eventService = getEventService(c);

    // Check if the event exists
    await requireEvent(c, eventId);

    // Check if user has RSVP'd
    const rsvp = await eventService.getUserRsvpStatus(user.id, eventId);
    const isRsvped = rsvp?.status === "GOING";

    return c.json({
      isRsvped,
    });
  },
);

export const getEventsByCategoryHandler: EventHandler = withErrorHandling(
  async (c) => {
    const categoryId = requireParam(c, "categoryId");
    const limit = c.req.query("limit");
    const cursor = c.req.query("cursor");
    const eventService = getEventService(c);

    const result = await eventService.getEventsByCategory(categoryId, {
      limit: limit ? parseInt(limit) : undefined,
      cursor: cursor,
    });

    return c.json(result);
  },
);

export const getEventEngagementHandler: EventHandler = withErrorHandling(
  async (c) => {
    const eventId = requireParam(c, "id");
    const eventService = getEventService(c);

    // Check if the event exists
    await requireEvent(c, eventId);

    // Get engagement metrics
    const engagement = await eventService.getEventEngagement(eventId);

    return c.json(engagement);
  },
);

export const trackEventViewHandler: EventHandler = withErrorHandling(
  async (c) => {
    const eventId = requireParam(c, "id");
    const user = requireAuth(c);
    const eventService = getEventService(c);

    // Check if the event exists
    await requireEvent(c, eventId);

    // Track the view
    await eventService.createViewRecord(user.id, eventId);

    return c.json({
      success: true,
      message: "Event view tracked successfully",
    });
  },
);

export const getLandingPageDataHandler: EventHandler = withErrorHandling(
  async (c) => {
    const userLat = c.req.query("lat");
    const userLng = c.req.query("lng");
    const featuredLimit = c.req.query("featuredLimit");
    const upcomingLimit = c.req.query("upcomingLimit");
    const communityLimit = c.req.query("communityLimit");

    const eventService = getEventService(c);

    const landingPageData = await eventService.getLandingPageData({
      userLat: userLat ? parseFloat(userLat) : undefined,
      userLng: userLng ? parseFloat(userLng) : undefined,
      featuredLimit: featuredLimit ? parseInt(featuredLimit) : undefined,
      upcomingLimit: upcomingLimit ? parseInt(upcomingLimit) : undefined,
      communityLimit: communityLimit ? parseInt(communityLimit) : undefined,
    });

    return c.json(landingPageData);
  },
);
