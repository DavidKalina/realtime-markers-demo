// This would be added to the backend service as src/handlers/filterHandlers.ts
import type { Context } from "hono";
import type { AppContext } from "../types/context";

// Define a type for our handler functions
export type FilterHandler = (
  c: Context<AppContext>,
) => Promise<Response> | Response;

/**
 * Get all filters for the current user
 */
export const getFiltersHandler: FilterHandler = async (c) => {
  try {
    // Get the user from context (set by authMiddleware)
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    // Get the user preferences service
    const userPreferencesService = c.get("userPreferencesService");

    // Get filters for the user
    const filters = await userPreferencesService.getUserFilters(user.userId);

    return c.json(filters);
  } catch (error) {
    console.error("Error fetching user filters:", error);
    return c.json(
      {
        error: "Failed to fetch filters",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Get a specific filter by ID for the current user
 */
export const getFilterByIdHandler: FilterHandler = async (c) => {
  try {
    // Get the user from context
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    // Get the filter ID from the URL
    const filterId = c.req.param("id");

    if (!filterId) {
      return c.json({ error: "Filter ID is required" }, 400);
    }

    // Get the user preferences service
    const userPreferencesService = c.get("userPreferencesService");

    // Get the specific filter
    const filter = await userPreferencesService.getFilterById(
      filterId,
      user.userId,
    );

    if (!filter) {
      return c.json({ error: "Filter not found" }, 404);
    }

    return c.json(filter);
  } catch (error) {
    console.error("Error fetching filter by ID:", error);
    return c.json(
      {
        error: "Failed to fetch filter",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const getInternalFiltersHandler: FilterHandler = async (c) => {
  try {
    // Get the userId from query parameters instead of auth context
    const userId = c.req.query("userId");

    if (!userId) {
      return c.json({ error: "Missing userId parameter" }, 400);
    }

    // Get the user preferences service
    const userPreferencesService = c.get("userPreferencesService");

    // Get filters for the user - reusing the same service method
    const filters = await userPreferencesService.getUserFilters(userId);

    return c.json(filters);
  } catch (error) {
    console.error(
      `Error fetching internal user filters for userId=${c.req.query("userId")}:`,
      error,
    );
    return c.json(
      {
        error: "Failed to fetch filters",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

export const createFilterHandler: FilterHandler = async (c) => {
  try {
    // Get the user from context
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    // Get the request body
    const filterData = await c.req.json();

    // Validate the filter data
    if (!filterData.name) {
      return c.json({ error: "Filter name is required" }, 400);
    }

    // Get the user preferences service
    const userPreferencesService = c.get("userPreferencesService");

    // Check if user has any existing filters
    const existingFilters = await userPreferencesService.getUserFilters(
      user.userId,
    );

    // If there are no existing filters, allow creating a date/time only filter
    if (existingFilters.length === 0) {
      if (!filterData.criteria || !filterData.criteria.dateRange) {
        return c.json(
          { error: "Date range is required for the first filter" },
          400,
        );
      }
    } else {
      // For subsequent filters, require either semanticQuery or criteria
      if (
        !filterData.semanticQuery &&
        (!filterData.criteria || Object.keys(filterData.criteria).length === 0)
      ) {
        return c.json(
          { error: "Either semanticQuery or criteria must be provided" },
          400,
        );
      }
    }

    // Initialize criteria object if it doesn't exist
    if (!filterData.criteria) {
      filterData.criteria = {};
    }

    // Create the filter
    const filter = await userPreferencesService.createFilter(
      user.userId,
      filterData,
    );

    return c.json(filter, 201);
  } catch (error) {
    console.error("Error creating filter:", error);
    return c.json(
      {
        error: "Failed to create filter",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Update an existing filter
 */
export const updateFilterHandler: FilterHandler = async (c) => {
  try {
    // Get the user from context
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    // Get the filter ID from the URL
    const filterId = c.req.param("id");

    // Get the request body
    const filterData = await c.req.json();

    // Get the user preferences service
    const userPreferencesService = c.get("userPreferencesService");

    // Update the filter
    try {
      const filter = await userPreferencesService.updateFilter(
        filterId,
        user.userId,
        filterData,
      );
      return c.json(filter);
    } catch (err) {
      if (err instanceof Error && err.message.includes("not found")) {
        return c.json({ error: "Filter not found" }, 404);
      }
      throw err;
    }
  } catch (error) {
    console.error("Error updating filter:", error);
    return c.json(
      {
        error: "Failed to update filter",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Delete a filter
 */
export const deleteFilterHandler: FilterHandler = async (c) => {
  try {
    // Get the user from context
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    // Get the filter ID from the URL
    const filterId = c.req.param("id");

    // Get the user preferences service
    const userPreferencesService = c.get("userPreferencesService");

    // Delete the filter
    try {
      const success = await userPreferencesService.deleteFilter(
        filterId,
        user.userId,
      );
      return c.json({ success });
    } catch (err) {
      if (err instanceof Error && err.message.includes("not found")) {
        return c.json({ error: "Filter not found" }, 404);
      }
      throw err;
    }
  } catch (error) {
    console.error("Error deleting filter:", error);
    return c.json(
      {
        error: "Failed to delete filter",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Apply filters to the current session
 */
export const applyFiltersHandler: FilterHandler = async (c) => {
  try {
    // Get the user from context
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    // Get the request body
    const { filterIds } = await c.req.json();

    if (!Array.isArray(filterIds)) {
      return c.json({ error: "filterIds must be an array" }, 400);
    }

    // Get the user preferences service
    const userPreferencesService = c.get("userPreferencesService");

    // Set the active filters
    const activeFilters = await userPreferencesService.applyFilters(
      user.userId,
      filterIds,
    );

    return c.json({
      message: "Filters applied successfully",
      activeFilters,
    });
  } catch (error) {
    console.error("Error applying filters:", error);
    return c.json(
      {
        error: "Failed to apply filters",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Clear all filters for the current session
 */
export const clearFiltersHandler: FilterHandler = async (c) => {
  try {
    // Get the user from context
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    // Get the user preferences service
    const userPreferencesService = c.get("userPreferencesService");

    // Clear the active filters
    const success = await userPreferencesService.clearActiveFilters(
      user.userId,
    );

    return c.json({
      message: "Filters cleared successfully",
      success,
    });
  } catch (error) {
    console.error("Error clearing filters:", error);
    return c.json(
      {
        error: "Failed to clear filters",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

// Add this to your handlers

export const searchWithFilterHandler: FilterHandler = async (c) => {
  try {
    // Get the user from context
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    // Get filter ID from request
    const filterId = c.req.param("id");

    // Get pagination params
    const limit = parseInt(c.req.query("limit") || "10");
    const offset = parseInt(c.req.query("offset") || "0");

    // Get services
    const userPreferencesService = c.get("userPreferencesService");
    const eventService = c.get("eventService");

    // Get the filter
    const filter = await userPreferencesService.getFilterById(
      filterId,
      user.userId,
    );

    if (!filter) {
      return c.json({ error: "Filter not found" }, 404);
    }

    // Search events using the filter
    const results = await eventService.searchEventsByFilter(filter, {
      limit,
      offset,
    });

    return c.json(results);
  } catch (error) {
    console.error("Error searching with filter:", error);
    return c.json(
      {
        error: "Failed to search with filter",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Get currently active filters for the current user
 */
export const getActiveFiltersHandler: FilterHandler = async (c) => {
  try {
    // Get the user from context
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    // Get the user preferences service
    const userPreferencesService = c.get("userPreferencesService");

    // Get active filters for the user
    const activeFilters = await userPreferencesService.getActiveFilters(
      user.userId,
    );

    return c.json(activeFilters);
  } catch (error) {
    console.error("Error fetching active filters:", error);
    return c.json(
      {
        error: "Failed to fetch active filters",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Toggle a filter's active state
 */
export const toggleFilterHandler: FilterHandler = async (c) => {
  try {
    // Get the user from context
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    // Get the filter ID from the URL
    const filterId = c.req.param("id");

    if (!filterId) {
      return c.json({ error: "Filter ID is required" }, 400);
    }

    // Get the user preferences service
    const userPreferencesService = c.get("userPreferencesService");

    // Get the current filter
    const filter = await userPreferencesService.getFilterById(
      filterId,
      user.userId,
    );

    if (!filter) {
      return c.json({ error: "Filter not found" }, 404);
    }

    // Toggle the active state
    const updatedFilter = await userPreferencesService.updateFilter(
      filterId,
      user.userId,
      { isActive: !filter.isActive },
    );

    return c.json(updatedFilter);
  } catch (error) {
    console.error("Error toggling filter:", error);
    return c.json(
      {
        error: "Failed to toggle filter",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};

/**
 * Generate an emoji for a filter based on its criteria
 */
export const generateFilterEmojiHandler: FilterHandler = async (c) => {
  try {
    // Get the user from context
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    // Get the request body
    const filterData = await c.req.json();

    if (!filterData.name) {
      return c.json({ error: "Filter name is required" }, 400);
    }

    // Get the user preferences service
    const userPreferencesService = c.get("userPreferencesService");

    // Generate emoji using the public method
    const emoji =
      await userPreferencesService.generateFilterEmojiForData(filterData);

    return c.json({ emoji });
  } catch (error) {
    console.error("Error generating filter emoji:", error);
    return c.json(
      {
        error: "Failed to generate emoji",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};
