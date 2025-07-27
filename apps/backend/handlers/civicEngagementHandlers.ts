import {
  withErrorHandling,
  requireAuth,
  requireParam,
  type Handler,
} from "../utils/handlerUtils";
import type {
  UpdateCivicEngagementInput,
  CivicEngagementFilters,
  AdminUpdateCivicEngagementStatusInput,
} from "../types/civicEngagement";
import {
  CivicEngagement,
  CivicEngagementType,
  CivicEngagementStatus,
  User,
} from "@realtime-markers/database";
import {
  processCivicEngagementFormData,
  validateCivicEngagementData,
  processCivicEngagementUpdateFormData,
  prepareCivicEngagementUpdateData,
} from "../utils/civicEngagementUtils";
import { civicEngagementNotificationService } from "../services/CivicEngagementNotificationService";
import AppDataSource from "../data-source";

export type CivicEngagementHandler = Handler;

export const createCivicEngagementHandler: CivicEngagementHandler =
  withErrorHandling(async (c) => {
    const user = requireAuth(c);
    const jobQueue = c.get("jobQueue");

    // Process form data and extract civic engagement data
    const { data } = await processCivicEngagementFormData(
      c,
      c.get("storageService"),
      user,
    );

    // Validate the civic engagement data
    try {
      validateCivicEngagementData(data);
    } catch (validationError) {
      throw new Error(
        validationError instanceof Error
          ? validationError.message
          : "Validation failed",
      );
    }

    // Prepare job data
    const jobData = {
      title: data.title!,
      type: data.type!,
      description: data.description,
      location: data.location
        ? {
            type: "Point" as const,
            coordinates: data.location.coordinates as [number, number],
          }
        : undefined,
      address: data.address,
      locationNotes: data.locationNotes,
      creatorId: user.userId!,
      contentType: data.contentType,
      filename: data.filename,
    };

    // Prepare buffer data if image is provided - this will be processed in the background job
    let bufferData: Buffer | undefined;
    if (data.imageBuffer) {
      bufferData = Buffer.from(data.imageBuffer, "base64");
    }

    // Enqueue the civic engagement processing job
    const jobId = await jobQueue.enqueueCivicEngagementJob(jobData, {
      bufferData,
    });

    return c.json({
      jobId,
      message: "Civic engagement processing started",
      status: "pending",
    });
  });

export const getCivicEngagementsHandler: CivicEngagementHandler =
  withErrorHandling(async (c) => {
    const filters: CivicEngagementFilters = {
      type: c.req.query("type")?.split(",") as CivicEngagementType[],
      status: c.req.query("status")?.split(",") as CivicEngagementStatus[],
      creatorId: c.req.query("creatorId"),
      search: c.req.query("search"),
      limit: c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined,
      offset: c.req.query("offset")
        ? parseInt(c.req.query("offset")!)
        : undefined,
    };

    // Handle location filter
    const lat = c.req.query("lat");
    const lng = c.req.query("lng");
    const radius = c.req.query("radius");
    if (lat && lng && radius) {
      filters.location = {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        radius: parseFloat(radius),
      };
    }

    // Handle date range
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    if (startDate || endDate) {
      filters.dateRange = {
        start: startDate ? new Date(startDate) : undefined,
        end: endDate ? new Date(endDate) : undefined,
      };
    }

    const civicEngagementService = c.get("civicEngagementService");
    const result = await civicEngagementService.getCivicEngagements(filters);

    return c.json({
      civicEngagements: result.items,
      total: result.total,
    });
  });

export const getCivicEngagementByIdHandler: CivicEngagementHandler =
  withErrorHandling(async (c) => {
    const id = requireParam(c, "id");
    const civicEngagementService = c.get("civicEngagementService");

    const civicEngagement =
      await civicEngagementService.getCivicEngagementById(id);
    if (!civicEngagement) {
      return c.json({ error: "Civic engagement not found" }, 404);
    }

    return c.json(civicEngagement);
  });

export const updateCivicEngagementHandler: CivicEngagementHandler =
  withErrorHandling(async (c) => {
    const id = requireParam(c, "id");
    const user = requireAuth(c);

    const civicEngagementService = c.get("civicEngagementService");
    const storageService = c.get("storageService");
    const embeddingService = c.get("embeddingService");

    // First, get the civic engagement to check permissions
    const existingEngagement =
      await civicEngagementService.getCivicEngagementById(id);
    if (!existingEngagement) {
      return c.json({ error: "Civic engagement not found" }, 404);
    }

    // Check if user is the creator or an admin
    if (existingEngagement.creatorId !== user.id && user.role !== "ADMIN") {
      return c.json(
        { error: "You can only modify your own civic engagements" },
        403,
      );
    }

    // Store the previous values for notification purposes
    const previousStatus = existingEngagement.status;
    const previousAdminNotes = existingEngagement.adminNotes;

    // Process form data and extract civic engagement data
    const { data, imageUrls } = await processCivicEngagementUpdateFormData(
      c,
      storageService,
      user,
      id,
    );

    // Prepare the update data (generate embeddings if needed)
    const processedData = await prepareCivicEngagementUpdateData(
      data,
      embeddingService,
    );

    // Prepare the final update input
    const input: UpdateCivicEngagementInput = {
      title: processedData.title,
      description: processedData.description,
      // Handle status and adminNotes from the original data (not processedData)
      status: data.status as CivicEngagementStatus,
      adminNotes: data.adminNotes,
      // Merge existing image URLs with new ones
      imageUrls:
        imageUrls.length > 0
          ? [...(existingEngagement.imageUrls || []), ...imageUrls]
          : existingEngagement.imageUrls,
    };

    const civicEngagement = await civicEngagementService.updateCivicEngagement(
      id,
      input,
    );

    // Send push notifications if this is an admin update
    if (user.role === "ADMIN" && existingEngagement.creatorId !== user.id) {
      try {
        // Get the full user object for the notification service
        const userRepository = AppDataSource.getRepository(User);
        const adminUser = await userRepository.findOne({
          where: { id: user.id },
        });

        if (adminUser) {
          // Notify about status change if status actually changed
          if (previousStatus !== civicEngagement.status) {
            await civicEngagementNotificationService.notifyCivicEngagementStatusUpdate(
              civicEngagement,
              previousStatus,
              adminUser,
            );

            // Special notification for implementation
            if (civicEngagement.status === CivicEngagementStatus.IMPLEMENTED) {
              await civicEngagementNotificationService.notifyCivicEngagementImplemented(
                civicEngagement,
                adminUser,
              );
            }
          }

          // Notify about admin notes if they were added or changed
          if (
            civicEngagement.adminNotes &&
            civicEngagement.adminNotes !== previousAdminNotes
          ) {
            await civicEngagementNotificationService.notifyAdminNotesAdded(
              civicEngagement,
              adminUser,
              previousAdminNotes,
            );
          }
        }
      } catch (notificationError) {
        console.error(
          "Error sending civic engagement notifications:",
          notificationError,
        );
        // Don't fail the request if notifications fail
      }
    }

    return c.json(civicEngagement);
  });

export const adminUpdateCivicEngagementStatusHandler: CivicEngagementHandler =
  withErrorHandling(async (c) => {
    const id = requireParam(c, "id");
    const user = requireAuth(c);

    // Ensure user is an admin
    if (user.role !== "ADMIN") {
      return c.json({ error: "Admin access required" }, 403);
    }

    const civicEngagementService = c.get("civicEngagementService");

    // First, get the civic engagement to ensure it exists
    const existingEngagement =
      await civicEngagementService.getCivicEngagementById(id);
    if (!existingEngagement) {
      return c.json({ error: "Civic engagement not found" }, 404);
    }

    // Store the previous status for notification purposes
    const previousStatus = existingEngagement.status;
    const previousAdminNotes = existingEngagement.adminNotes;

    // Parse the request body
    const body = await c.req.json();
    const {
      status,
      adminNotes,
      implementedAt,
    }: AdminUpdateCivicEngagementStatusInput = body;

    // Validate the status
    if (!status || !Object.values(CivicEngagementStatus).includes(status)) {
      return c.json({ error: "Invalid status provided" }, 400);
    }

    // Prepare the update input
    const input: UpdateCivicEngagementInput = {
      status,
      adminNotes,
      // Only set implementedAt if status is IMPLEMENTED
      ...(status === CivicEngagementStatus.IMPLEMENTED && implementedAt
        ? { implementedAt: new Date(implementedAt) }
        : {}),
    };

    const civicEngagement = await civicEngagementService.updateCivicEngagement(
      id,
      input,
    );

    // Send push notifications based on the type of update
    try {
      // Get the full user object for the notification service
      const userRepository = AppDataSource.getRepository(User);
      const adminUser = await userRepository.findOne({
        where: { id: user.id },
      });

      if (adminUser) {
        // Notify about status change if status actually changed
        if (previousStatus !== civicEngagement.status) {
          await civicEngagementNotificationService.notifyCivicEngagementStatusUpdate(
            civicEngagement,
            previousStatus,
            adminUser,
          );

          // Special notification for implementation
          if (civicEngagement.status === CivicEngagementStatus.IMPLEMENTED) {
            await civicEngagementNotificationService.notifyCivicEngagementImplemented(
              civicEngagement,
              adminUser,
            );
          }
        }

        // Notify about admin notes if they were added or changed
        if (
          civicEngagement.adminNotes &&
          civicEngagement.adminNotes !== previousAdminNotes
        ) {
          await civicEngagementNotificationService.notifyAdminNotesAdded(
            civicEngagement,
            adminUser,
            previousAdminNotes,
          );
        }
      }
    } catch (notificationError) {
      console.error(
        "Error sending civic engagement notifications:",
        notificationError,
      );
      // Don't fail the request if notifications fail
    }

    return c.json({
      ...civicEngagement,
      message: "Civic engagement status updated successfully",
    });
  });

export const adminBulkUpdateCivicEngagementStatusHandler: CivicEngagementHandler =
  withErrorHandling(async (c) => {
    const user = requireAuth(c);

    // Ensure user is an admin
    if (user.role !== "ADMIN") {
      return c.json({ error: "Admin access required" }, 403);
    }

    const civicEngagementService = c.get("civicEngagementService");

    // Parse the request body
    const body = await c.req.json();
    const {
      civicEngagementIds,
      status,
      adminNotes,
    }: {
      civicEngagementIds: string[];
      status: CivicEngagementStatus;
      adminNotes?: string;
    } = body;

    // Validate inputs
    if (
      !civicEngagementIds ||
      !Array.isArray(civicEngagementIds) ||
      civicEngagementIds.length === 0
    ) {
      return c.json(
        { error: "civicEngagementIds must be a non-empty array" },
        400,
      );
    }

    if (!status || !Object.values(CivicEngagementStatus).includes(status)) {
      return c.json({ error: "Invalid status provided" }, 400);
    }

    // Get the full user object for the notification service
    const userRepository = AppDataSource.getRepository(User);
    const adminUser = await userRepository.findOne({ where: { id: user.id } });

    // Process each civic engagement
    const results = [];
    const errors = [];

    for (const id of civicEngagementIds) {
      try {
        // Check if civic engagement exists
        const existingEngagement =
          await civicEngagementService.getCivicEngagementById(id);
        if (!existingEngagement) {
          errors.push({ id, error: "Civic engagement not found" });
          continue;
        }

        // Store the previous status for notification purposes
        const previousStatus = existingEngagement.status;
        const previousAdminNotes = existingEngagement.adminNotes;

        // Prepare the update input
        const input: UpdateCivicEngagementInput = {
          status,
          adminNotes,
          // Only set implementedAt if status is IMPLEMENTED
          ...(status === CivicEngagementStatus.IMPLEMENTED
            ? { implementedAt: new Date() }
            : {}),
        };

        const updatedEngagement =
          await civicEngagementService.updateCivicEngagement(id, input);
        results.push(updatedEngagement);

        // Send push notifications for this engagement
        if (adminUser) {
          try {
            // Notify about status change if status actually changed
            if (previousStatus !== updatedEngagement.status) {
              await civicEngagementNotificationService.notifyCivicEngagementStatusUpdate(
                updatedEngagement,
                previousStatus,
                adminUser,
              );

              // Special notification for implementation
              if (
                updatedEngagement.status === CivicEngagementStatus.IMPLEMENTED
              ) {
                await civicEngagementNotificationService.notifyCivicEngagementImplemented(
                  updatedEngagement,
                  adminUser,
                );
              }
            }

            // Notify about admin notes if they were added or changed
            if (
              updatedEngagement.adminNotes &&
              updatedEngagement.adminNotes !== previousAdminNotes
            ) {
              await civicEngagementNotificationService.notifyAdminNotesAdded(
                updatedEngagement,
                adminUser,
                previousAdminNotes,
              );
            }
          } catch (notificationError) {
            console.error(
              `Error sending notifications for civic engagement ${id}:`,
              notificationError,
            );
            // Don't fail the bulk operation if notifications fail
          }
        }
      } catch (error) {
        errors.push({
          id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return c.json({
      success: results.length,
      errors: errors.length,
      updated: results,
      failed: errors,
      message: `Successfully updated ${results.length} civic engagements, ${errors.length} failed`,
    });
  });

export const getNearbyCivicEngagementsHandler: CivicEngagementHandler =
  withErrorHandling(async (c) => {
    const lat = requireParam(c, "lat");
    const lng = requireParam(c, "lng");
    const radius = c.req.query("radius");
    const type = c.req.query("type")?.split(",") as CivicEngagementType[];
    const status = c.req.query("status")?.split(",") as CivicEngagementStatus[];
    const search = c.req.query("search");

    const civicEngagementService = c.get("civicEngagementService");
    const civicEngagements =
      await civicEngagementService.getNearbyCivicEngagements(
        parseFloat(lat),
        parseFloat(lng),
        radius ? parseFloat(radius) : undefined,
        {
          type,
          status,
          search,
        },
      );

    return c.json(civicEngagements);
  });

export const getCivicEngagementStatsHandler: CivicEngagementHandler =
  withErrorHandling(async (c) => {
    const civicEngagementSearchService = c.get("civicEngagementSearchService");
    const stats = await civicEngagementSearchService.getStats();

    return c.json(stats);
  });

export const getAllCivicEngagementsHandler: CivicEngagementHandler =
  withErrorHandling(async (c) => {
    const civicEngagementService = c.get("civicEngagementService");

    // Get pagination parameters
    const limit = c.req.query("limit")
      ? parseInt(c.req.query("limit")!)
      : 10000;
    const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : 0;

    // Get all civic engagements with pagination for internal use
    const result = await civicEngagementService.getCivicEngagements({
      limit,
      offset,
    });

    return c.json({
      items: result.items,
      total: result.total,
      hasMore: result.hasMore,
    });
  });

export const deleteCivicEngagementHandler: CivicEngagementHandler =
  withErrorHandling(async (c) => {
    const id = requireParam(c, "id");
    const user = requireAuth(c);

    const civicEngagementService = c.get("civicEngagementService");

    // First, get the civic engagement to check permissions
    const existingEngagement =
      await civicEngagementService.getCivicEngagementById(id);
    if (!existingEngagement) {
      return c.json({ error: "Civic engagement not found" }, 404);
    }

    // Check if user is the creator or an admin
    if (existingEngagement.creatorId !== user.id && user.role !== "ADMIN") {
      return c.json(
        { error: "You can only delete your own civic engagements" },
        403,
      );
    }

    await civicEngagementService.deleteCivicEngagement(id);

    return c.json({ success: true });
  });

export const searchCivicEngagementsHandler: CivicEngagementHandler =
  withErrorHandling(async (c) => {
    const query = requireParam(c, "query");
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : 10;

    const civicEngagementSearchService = c.get("civicEngagementSearchService");
    const result = await civicEngagementSearchService.searchCivicEngagements(
      query,
      limit,
    );

    return c.json({
      civicEngagements: result.results.map((r) => r.civicEngagement),
      total: result.results.length,
      scores: result.results.map((r) => ({
        id: r.civicEngagement.id,
        score: r.score,
      })),
    });
  });

export const getRecentCivicEngagementsHandler: CivicEngagementHandler =
  withErrorHandling(async (c) => {
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : 10;
    const cursor = c.req.query("cursor");

    const civicEngagementSearchService = c.get("civicEngagementSearchService");
    const result = await civicEngagementSearchService.getRecentCivicEngagements(
      { limit, cursor },
    );

    return c.json({
      civicEngagements: result.civicEngagements,
      nextCursor: result.nextCursor,
    });
  });

export const getCivicEngagementsByTypeHandler: CivicEngagementHandler =
  withErrorHandling(async (c) => {
    const type = requireParam(c, "type");
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : 10;
    const cursor = c.req.query("cursor");

    const civicEngagementSearchService = c.get("civicEngagementSearchService");
    const result = await civicEngagementSearchService.getCivicEngagementsByType(
      type,
      { limit, cursor },
    );

    return c.json({
      civicEngagements: result.civicEngagements,
      nextCursor: result.nextCursor,
    });
  });

export const getCivicEngagementsByStatusHandler: CivicEngagementHandler =
  withErrorHandling(async (c) => {
    const status = requireParam(c, "status");
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : 10;
    const cursor = c.req.query("cursor");

    const civicEngagementSearchService = c.get("civicEngagementSearchService");
    const result =
      await civicEngagementSearchService.getCivicEngagementsByStatus(status, {
        limit,
        cursor,
      });

    return c.json({
      civicEngagements: result.civicEngagements,
      nextCursor: result.nextCursor,
    });
  });

export const getCivicEngagementsByCreatorHandler: CivicEngagementHandler =
  withErrorHandling(async (c) => {
    const creatorId = requireParam(c, "creatorId");
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : 10;
    const cursor = c.req.query("cursor");

    const civicEngagementSearchService = c.get("civicEngagementSearchService");
    const result =
      await civicEngagementSearchService.getCivicEngagementsByCreator(
        creatorId,
        { limit, cursor },
      );

    return c.json({
      civicEngagements: result.civicEngagements,
      nextCursor: result.nextCursor,
    });
  });
