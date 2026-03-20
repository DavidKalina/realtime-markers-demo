import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";

/**
 * Get all filters for the current user
 */
export const getFiltersHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userPreferencesService = c.get("userPreferencesService");
  const filters = await userPreferencesService.getUserFilters(user.id);

  return c.json(filters);
});

/**
 * Get a specific filter by ID for the current user
 */
export const getFilterByIdHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const filterId = c.req.param("id");

  if (!filterId) {
    return c.json({ error: "Filter ID is required" }, 400);
  }

  const userPreferencesService = c.get("userPreferencesService");
  const filter = await userPreferencesService.getFilterById(filterId, user.id);

  if (!filter) {
    return c.json({ error: "Filter not found" }, 404);
  }

  return c.json(filter);
});

export const getInternalFiltersHandler: Handler = withErrorHandling(
  async (c) => {
    const userId = c.req.query("userId");

    if (!userId) {
      return c.json({ error: "Missing userId parameter" }, 400);
    }

    const userPreferencesService = c.get("userPreferencesService");
    const filters = await userPreferencesService.getUserFilters(userId);

    return c.json(filters);
  },
);

export const createFilterHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const filterData = await c.req.json();

  if (!filterData.name) {
    return c.json({ error: "Filter name is required" }, 400);
  }

  const userPreferencesService = c.get("userPreferencesService");
  const existingFilters = await userPreferencesService.getUserFilters(user.id);

  if (existingFilters.length === 0) {
    if (!filterData.criteria || !filterData.criteria.dateRange) {
      return c.json(
        { error: "Date range is required for the first filter" },
        400,
      );
    }
  } else {
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

  if (!filterData.criteria) {
    filterData.criteria = {};
  }

  const filter = await userPreferencesService.createFilter(user.id, filterData);

  return c.json(filter, 201);
});

/**
 * Update an existing filter
 */
export const updateFilterHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const filterId = c.req.param("id");
  const filterData = await c.req.json();
  const userPreferencesService = c.get("userPreferencesService");

  try {
    const filter = await userPreferencesService.updateFilter(
      filterId,
      user.id,
      filterData,
    );
    return c.json(filter);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return c.json({ error: "Filter not found" }, 404);
    }
    throw err;
  }
});

/**
 * Delete a filter
 */
export const deleteFilterHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const filterId = c.req.param("id");
  const userPreferencesService = c.get("userPreferencesService");

  try {
    const success = await userPreferencesService.deleteFilter(
      filterId,
      user.id,
    );
    return c.json({ success });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return c.json({ error: "Filter not found" }, 404);
    }
    throw err;
  }
});

/**
 * Apply filters to the current session
 */
export const applyFiltersHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const { filterIds } = await c.req.json();

  if (!Array.isArray(filterIds)) {
    return c.json({ error: "filterIds must be an array" }, 400);
  }

  const userPreferencesService = c.get("userPreferencesService");
  const activeFilters = await userPreferencesService.applyFilters(
    user.id,
    filterIds,
  );

  return c.json({
    message: "Filters applied successfully",
    activeFilters,
  });
});

/**
 * Clear all filters for the current session
 */
export const clearFiltersHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userPreferencesService = c.get("userPreferencesService");
  const success = await userPreferencesService.clearActiveFilters(user.id);

  return c.json({
    message: "Filters cleared successfully",
    success,
  });
});

/**
 * Get category preferences for the current user
 */
export const getCategoryPreferencesHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const userPreferencesService = c.get("userPreferencesService");
    const preferences = await userPreferencesService.getCategoryPreferences(
      user.id,
    );

    return c.json(preferences);
  },
);

/**
 * Set category preferences for the current user
 */
export const setCategoryPreferencesHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const { includeCategoryIds, excludeCategoryIds } = await c.req.json();

    if (
      !Array.isArray(includeCategoryIds) ||
      !Array.isArray(excludeCategoryIds)
    ) {
      return c.json(
        {
          error:
            "includeCategoryIds and excludeCategoryIds must both be arrays",
        },
        400,
      );
    }

    const userPreferencesService = c.get("userPreferencesService");
    const preferences = await userPreferencesService.setCategoryPreferences(
      user.id,
      includeCategoryIds,
      excludeCategoryIds,
    );

    return c.json(preferences);
  },
);

export const searchWithFilterHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const filterId = c.req.param("id");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = parseInt(c.req.query("offset") || "0");

  const userPreferencesService = c.get("userPreferencesService");
  const eventService = c.get("eventService");

  const filter = await userPreferencesService.getFilterById(filterId, user.id);

  if (!filter) {
    return c.json({ error: "Filter not found" }, 404);
  }

  const results = await eventService.searchEventsByFilter(filter, {
    limit,
    offset,
  });

  return c.json(results);
});

/**
 * Get currently active filters for the current user
 */
export const getActiveFiltersHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const userPreferencesService = c.get("userPreferencesService");
  const activeFilters = await userPreferencesService.getActiveFilters(user.id);

  return c.json(activeFilters);
});

/**
 * Toggle a filter's active state
 */
export const toggleFilterHandler: Handler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const filterId = c.req.param("id");

  if (!filterId) {
    return c.json({ error: "Filter ID is required" }, 400);
  }

  const userPreferencesService = c.get("userPreferencesService");
  const filter = await userPreferencesService.getFilterById(filterId, user.id);

  if (!filter) {
    return c.json({ error: "Filter not found" }, 404);
  }

  const updatedFilter = await userPreferencesService.updateFilter(
    filterId,
    user.id,
    { isActive: !filter.isActive },
  );

  return c.json(updatedFilter);
});

/**
 * Generate an emoji for a filter based on its criteria
 */
export const generateFilterEmojiHandler: Handler = withErrorHandling(
  async (c) => {
    requireAuth(c);
    const filterData = await c.req.json();

    if (!filterData.name) {
      return c.json({ error: "Filter name is required" }, 400);
    }

    const userPreferencesService = c.get("userPreferencesService");
    const emoji =
      await userPreferencesService.generateFilterEmojiForData(filterData);

    return c.json({ emoji });
  },
);
