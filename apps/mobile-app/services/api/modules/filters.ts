import { BaseApiClient } from "../base/ApiClient";
import { Filter } from "../base/types";

export interface FilterOptions {
  isActive?: boolean;
  semanticQuery?: string;
  emoji?: string;
  criteria?: {
    dateRange?: {
      start?: string;
      end?: string;
    };
    status?: string[];
    location?: {
      latitude?: number;
      longitude?: number;
      radius?: number; // in meters
    };
  };
}

export class FiltersModule extends BaseApiClient {
  /**
   * Get all filters for the current user
   * @returns Array of filters
   */
  async getFilters(): Promise<Filter[]> {
    const url = `${this.baseUrl}/api/filters`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Filter[]>(response);
  }

  /**
   * Get a specific filter by ID
   * @param filterId - ID of the filter to retrieve
   * @returns Filter object
   */
  async getFilterById(filterId: string): Promise<Filter> {
    const url = `${this.baseUrl}/api/filters/${filterId}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Filter>(response);
  }

  /**
   * Create a new filter
   * @param filterData - Filter data to create
   * @returns Created filter
   */
  async createFilter(filterData: FilterOptions): Promise<Filter> {
    const url = `${this.baseUrl}/api/filters`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(filterData),
    });
    return this.handleResponse<Filter>(response);
  }

  /**
   * Update an existing filter
   * @param filterId - ID of the filter to update
   * @param filterData - Updated filter data
   * @returns Updated filter
   */
  async updateFilter(
    filterId: string,
    filterData: Partial<FilterOptions>,
  ): Promise<Filter> {
    const url = `${this.baseUrl}/api/filters/${filterId}`;
    const response = await this.fetchWithAuth(url, {
      method: "PUT",
      body: JSON.stringify(filterData),
    });
    return this.handleResponse<Filter>(response);
  }

  /**
   * Delete a filter
   * @param filterId - ID of the filter to delete
   * @returns Success status
   */
  async deleteFilter(filterId: string): Promise<{ success: boolean }> {
    const url = `${this.baseUrl}/api/filters/${filterId}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    return this.handleResponse<{ success: boolean }>(response);
  }

  /**
   * Apply filters to the current session
   * @param filterIds - Array of filter IDs to apply
   * @returns Object containing success message and active filters
   */
  async applyFilters(
    filterIds: string[],
  ): Promise<{ message: string; activeFilters: Filter[] }> {
    const url = `${this.baseUrl}/api/filters/apply`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ filterIds }),
    });
    return this.handleResponse<{ message: string; activeFilters: Filter[] }>(
      response,
    );
  }

  /**
   * Clear all active filters
   * @returns Success status and message
   */
  async clearFilters(): Promise<{ message: string; success: boolean }> {
    const url = `${this.baseUrl}/api/filters/clear`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    return this.handleResponse<{ message: string; success: boolean }>(response);
  }

  /**
   * Get currently active filters
   * @returns Array of active filters
   */
  async getActiveFilters(): Promise<Filter[]> {
    const url = `${this.baseUrl}/api/filters/active`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Filter[]>(response);
  }

  /**
   * Toggle a filter's active state
   * @param filterId - ID of the filter to toggle
   * @returns Updated filter
   */
  async toggleFilter(filterId: string): Promise<Filter> {
    const url = `${this.baseUrl}/api/filters/${filterId}/toggle`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    return this.handleResponse<Filter>(response);
  }

  /**
   * Generate an emoji for a filter based on its criteria
   * @param filterData - Filter data to generate emoji for
   * @returns Generated emoji
   */
  async generateFilterEmoji(
    filterData: FilterOptions,
  ): Promise<{ emoji: string }> {
    const url = `${this.baseUrl}/api/filters/generate-emoji`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(filterData),
    });
    return this.handleResponse<{ emoji: string }>(response);
  }
}

// Export as singleton
export const filtersModule = new FiltersModule();
export default filtersModule;
