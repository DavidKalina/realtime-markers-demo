import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";
import { Filter, FilterCreateInput } from "../base/types";
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
   * Get category preferences for the current user
   */
  async getCategoryPreferences(): Promise<{
    includeCategoryIds: string[];
    excludeCategoryIds: string[];
  }> {
    const url = `${this.client.baseUrl}/api/filters/category-preferences`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{
      includeCategoryIds: string[];
      excludeCategoryIds: string[];
    }>(response);
  }

  /**
   * Set category preferences for the current user
   */
  async setCategoryPreferences(
    includeCategoryIds: string[],
    excludeCategoryIds: string[],
  ): Promise<{
    includeCategoryIds: string[];
    excludeCategoryIds: string[];
  }> {
    const url = `${this.client.baseUrl}/api/filters/category-preferences`;
    const response = await this.fetchWithAuth(url, {
      method: "PUT",
      body: JSON.stringify({ includeCategoryIds, excludeCategoryIds }),
    });
    return this.handleResponse<{
      includeCategoryIds: string[];
      excludeCategoryIds: string[];
    }>(response);
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
