import {
  withErrorHandling,
  requireAuth,
  requireParam,
  requireBodyField,
  type Handler,
} from "../utils/handlerUtils";
import type {
  UpdateCivicEngagementInput,
  CivicEngagementFilters,
} from "../types/civicEngagement";
import {
  CivicEngagementType,
  CivicEngagementStatus,
} from "../entities/CivicEngagement";

export type CivicEngagementHandler = Handler;

export const createCivicEngagementHandler: CivicEngagementHandler =
  withErrorHandling(async (c) => {
    const user = requireAuth(c);
    const title = await requireBodyField<string>(c, "title");
    const type = await requireBodyField<CivicEngagementType>(c, "type");

    const body = await c.req.json();

    // Get image buffer if provided
    const imageBuffer = body.imageBuffer
      ? Buffer.from(body.imageBuffer, "base64")
      : undefined;

    const civicEngagementData = {
      title,
      type,
      description: body.description,
      location: body.location,
      address: body.address,
      locationNotes: body.locationNotes,
      creatorId: user.id,
      contentType: body.contentType,
      filename: body.filename,
    };

    const jobQueue = c.get("jobQueue");
    const jobId = await jobQueue.enqueueCivicEngagementJob(
      civicEngagementData,
      { bufferData: imageBuffer },
    );

    return c.json({
      jobId,
      message: "Civic engagement request queued for processing",
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
    requireAuth(c);

    const body = await c.req.json();
    const input: UpdateCivicEngagementInput = {
      title: body.title,
      description: body.description,
      status: body.status as CivicEngagementStatus,
      adminNotes: body.adminNotes,
      imageUrls: body.imageUrls,
    };

    const civicEngagementService = c.get("civicEngagementService");
    const civicEngagement = await civicEngagementService.updateCivicEngagement(
      id,
      input,
    );

    return c.json(civicEngagement);
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
    requireAuth(c);

    const civicEngagementService = c.get("civicEngagementService");
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
