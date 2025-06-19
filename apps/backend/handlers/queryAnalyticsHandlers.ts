import type { Context } from "hono";
import type { AppContext } from "../types/context";

// Define a type for our handler functions
export type QueryAnalyticsHandler = (
  c: Context<AppContext>,
) => Promise<Response> | Response;

/**
 * Get query insights with analytics data
 */
export const getQueryInsightsHandler: QueryAnalyticsHandler = async (c) => {
  try {
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
      timestamp: new Date().toISOString(), // Add timestamp for cache busting
    });
  } catch (error) {
    console.error("Error fetching query insights:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch query insights",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Get popular queries
 */
export const getPopularQueriesHandler: QueryAnalyticsHandler = async (c) => {
  try {
    const eventService = c.get("eventService");
    const limit = parseInt(c.req.query("limit") || "10");

    const popularQueries = await eventService.getPopularQueries(limit);

    return c.json({
      success: true,
      popularQueries,
      total: popularQueries.length,
    });
  } catch (error) {
    console.error("Error fetching popular queries:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch popular queries",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Get queries with low hit rates
 */
export const getLowHitRateQueriesHandler: QueryAnalyticsHandler = async (c) => {
  try {
    const eventService = c.get("eventService");
    const limit = parseInt(c.req.query("limit") || "10");

    const lowHitRateQueries = await eventService.getLowHitRateQueries(limit);

    return c.json({
      success: true,
      lowHitRateQueries,
      total: lowHitRateQueries.length,
    });
  } catch (error) {
    console.error("Error fetching low hit rate queries:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch low hit rate queries",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Get queries with zero results
 */
export const getZeroResultQueriesHandler: QueryAnalyticsHandler = async (c) => {
  try {
    const eventService = c.get("eventService");
    const limit = parseInt(c.req.query("limit") || "10");

    const zeroResultQueries = await eventService.getZeroResultQueries(limit);

    return c.json({
      success: true,
      zeroResultQueries,
      total: zeroResultQueries.length,
    });
  } catch (error) {
    console.error("Error fetching zero result queries:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch zero result queries",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Get stats for a specific query
 */
export const getQueryStatsHandler: QueryAnalyticsHandler = async (c) => {
  try {
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
  } catch (error) {
    console.error("Error fetching query stats:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch query stats",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Update query flags
 */
export const updateQueryFlagsHandler: QueryAnalyticsHandler = async (c) => {
  try {
    const eventService = c.get("eventService");

    const result = await eventService.updateQueryFlags();

    return c.json({
      success: true,
      message: "Query flags updated successfully",
      result,
    });
  } catch (error) {
    console.error("Error updating query flags:", error);
    return c.json(
      {
        success: false,
        error: "Failed to update query flags",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Get query clusters
 */
export const getQueryClustersHandler: QueryAnalyticsHandler = async (c) => {
  try {
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
  } catch (error) {
    console.error("Error fetching query clusters:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch query clusters",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Find similar queries
 */
export const findSimilarQueriesHandler: QueryAnalyticsHandler = async (c) => {
  try {
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
  } catch (error) {
    console.error("Error finding similar queries:", error);
    return c.json(
      {
        success: false,
        error: "Failed to find similar queries",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};
