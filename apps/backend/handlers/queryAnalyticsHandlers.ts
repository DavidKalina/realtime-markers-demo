import { withErrorHandling, type Handler } from "../utils/handlerUtils";

/**
 * Get query insights with analytics data
 */
export const getQueryInsightsHandler: Handler = withErrorHandling(async (c) => {
  // Add cache-busting headers
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  c.header("Pragma", "no-cache");
  c.header("Expires", "0");

  const eventService = c.get("eventService");
  const days = parseInt(c.req.query("days") || "30");
  const limit = parseInt(c.req.query("limit") || "10");
  const minSearches = parseInt(c.req.query("minSearches") || "3");

  const insights = await eventService.getQueryInsights({
    days,
    limit,
    minSearches,
  });

  return c.json({
    success: true,
    insights,
    filters: {
      days,
      limit,
      minSearches,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * Get popular queries
 */
export const getPopularQueriesHandler: Handler = withErrorHandling(
  async (c) => {
    const eventService = c.get("eventService");
    const limit = parseInt(c.req.query("limit") || "10");

    const popularQueries = await eventService.getPopularQueries(limit);

    return c.json({
      success: true,
      popularQueries,
      total: popularQueries.length,
    });
  },
);

/**
 * Get queries with low hit rates
 */
export const getLowHitRateQueriesHandler: Handler = withErrorHandling(
  async (c) => {
    const eventService = c.get("eventService");
    const limit = parseInt(c.req.query("limit") || "10");

    const lowHitRateQueries = await eventService.getLowHitRateQueries(limit);

    return c.json({
      success: true,
      lowHitRateQueries,
      total: lowHitRateQueries.length,
    });
  },
);

/**
 * Get queries with zero results
 */
export const getZeroResultQueriesHandler: Handler = withErrorHandling(
  async (c) => {
    const eventService = c.get("eventService");
    const limit = parseInt(c.req.query("limit") || "10");

    const zeroResultQueries = await eventService.getZeroResultQueries(limit);

    return c.json({
      success: true,
      zeroResultQueries,
      total: zeroResultQueries.length,
    });
  },
);

/**
 * Get stats for a specific query
 */
export const getQueryStatsHandler: Handler = withErrorHandling(async (c) => {
  const query = c.req.param("query");
  const eventService = c.get("eventService");

  const stats = await eventService.getQueryStats(query);

  if (!stats) {
    return c.json(
      {
        success: false,
        error: "Query not found",
      },
      404,
    );
  }

  return c.json({
    success: true,
    query,
    stats,
  });
});

/**
 * Update query flags
 */
export const updateQueryFlagsHandler: Handler = withErrorHandling(async (c) => {
  const eventService = c.get("eventService");

  const result = await eventService.updateQueryFlags();

  return c.json({
    success: true,
    message: "Query flags updated successfully",
    result,
  });
});

/**
 * Get query clusters
 */
export const getQueryClustersHandler: Handler = withErrorHandling(async (c) => {
  const eventService = c.get("eventService");
  const similarityThreshold = parseFloat(
    c.req.query("similarityThreshold") || "0.8",
  );

  const clusters = await eventService.getQueryClusters(similarityThreshold);

  return c.json({
    success: true,
    clusters,
    total: clusters.length,
    similarityThreshold,
  });
});

/**
 * Find similar queries
 */
export const findSimilarQueriesHandler: Handler = withErrorHandling(
  async (c) => {
    const query = c.req.param("query");
    const eventService = c.get("eventService");
    const limit = parseInt(c.req.query("limit") || "10");
    const similarityThreshold = parseFloat(
      c.req.query("similarityThreshold") || "0.8",
    );

    const similarQueries = await eventService.findSimilarQueries(
      query,
      limit,
      similarityThreshold,
    );

    return c.json({
      success: true,
      originalQuery: query,
      similarQueries,
      total: similarQueries.length,
      limit,
      similarityThreshold,
    });
  },
);
