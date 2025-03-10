// This would be added to the backend service as src/handlers/filterHandlers.ts
import type { Context } from "hono";
import type { AppContext } from "../types/context";

// Define a type for our handler functions
export type FilterHandler = (c: Context<AppContext>) => Promise<Response> | Response;

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
      500
    );
  }
};

/**
 * Create a new filter for the current user
 */
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
    if (!filterData.name || !filterData.criteria) {
      return c.json({ error: "Filter name and criteria are required" }, 400);
    }

    // Get the user preferences service
    const userPreferencesService = c.get("userPreferencesService");

    // Create the filter
    const filter = await userPreferencesService.createFilter(user.userId, filterData);

    return c.json(filter, 201);
  } catch (error) {
    console.error("Error creating filter:", error);
    return c.json(
      {
        error: "Failed to create filter",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
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
      const filter = await userPreferencesService.updateFilter(filterId, user.userId, filterData);
      return c.json(filter);
    } catch (err: any) {
      if (err.message.includes("not found")) {
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
      500
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
      const success = await userPreferencesService.deleteFilter(filterId, user.userId);
      return c.json({ success });
    } catch (err: any) {
      if (err.message.includes("not found")) {
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
      500
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
    const activeFilters = await userPreferencesService.setActiveFilters(user.userId, filterIds);

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
      500
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
    const success = await userPreferencesService.clearActiveFilters(user.userId);

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
      500
    );
  }
};
