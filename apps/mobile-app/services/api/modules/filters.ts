import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";
import { Filter, FilterCreateInput, FilterUpdateInput } from "../base/types";
import { apiClient } from "../../ApiClient";

export class FiltersModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  /**
   * Get all filters for the current user
   * @returns Array of filters
   */
  async getFilters(): Promise<Filter[]> {
    const url = `${this.client.baseUrl}/api/filters`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Filter[]>(response);
  }

  /**
   * Get a specific filter by ID
   * @param filterId - ID of the filter to retrieve
   * @returns Filter object
   */
  async getFilterById(filterId: string): Promise<Filter> {
    const url = `${this.client.baseUrl}/api/filters/${filterId}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Filter>(response);
  }

  /**
   * Create a new filter
   * @param filterData - Filter data to create
   * @returns Created filter
   */
  async createFilter(filterData: FilterCreateInput): Promise<Filter> {
    const url = `${this.client.baseUrl}/api/filters`;
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
    filterData: FilterUpdateInput,
  ): Promise<Filter> {
    const url = `${this.client.baseUrl}/api/filters/${filterId}`;
    const response = await this.fetchWithAuth(url, {
      method: "PATCH",
      body: JSON.stringify(filterData),
    });
    return this.handleResponse<Filter>(response);
  }

  /**
   * Delete a filter
   * @param filterId - ID of the filter to delete
   * @returns Success status
   */
  async deleteFilter(filterId: string): Promise<void> {
    const url = `${this.client.baseUrl}/api/filters/${filterId}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    await this.handleResponse<void>(response);
  }

  /**
   * Apply filters to the current session
   * @param filterIds - Array of filter IDs to apply
   * @returns Object containing success message and active filters
   */
  async applyFilters(
    filterIds: string[],
  ): Promise<{ message: string; activeFilters: Filter[] }> {
    const url = `${this.client.baseUrl}/api/filters/apply`;
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
    const url = `${this.client.baseUrl}/api/filters/clear`;
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
    const url = `${this.client.baseUrl}/api/filters/active`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Filter[]>(response);
  }

  /**
   * Toggle a filter's active state
   * @param filterId - ID of the filter to toggle
   * @returns Updated filter
   */
  async toggleFilter(filterId: string): Promise<Filter> {
    const url = `${this.client.baseUrl}/api/filters/${filterId}/toggle`;
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
    filterData: FilterCreateInput,
  ): Promise<{ emoji: string }> {
    const url = `${this.client.baseUrl}/api/filters/generate-emoji`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(filterData),
    });
    return this.handleResponse<{ emoji: string }>(response);
  }
}

// Export as singleton using the main ApiClient instance
export const filtersModule = new FiltersModule(apiClient);
export default filtersModule;
