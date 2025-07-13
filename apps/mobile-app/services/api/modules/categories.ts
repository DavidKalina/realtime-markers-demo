import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";
import {
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "../base/types";
import { apiClient } from "../../ApiClient";

export class CategoriesModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  /**
   * Get all categories
   * @returns Promise<Category[]> Array of all categories
   */
  async getCategories(): Promise<Category[]> {
    const url = `${this.client.baseUrl}/api/categories`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Category[]>(response);
  }

  /**
   * Get a category by ID
   * @param id Category ID
   * @returns Promise<Category> The requested category
   */
  async getCategory(id: string): Promise<Category> {
    const url = `${this.client.baseUrl}/api/categories/${id}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Category>(response);
  }

  /**
   * Create a new category
   * @param input Category creation input
   * @returns Promise<Category> The created category
   */
  async createCategory(input: CreateCategoryRequest): Promise<Category> {
    const url = `${this.client.baseUrl}/api/categories`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return this.handleResponse<Category>(response);
  }

  /**
   * Update an existing category
   * @param id Category ID
   * @param input Category update input
   * @returns Promise<Category> The updated category
   */
  async updateCategory(
    id: string,
    input: UpdateCategoryRequest,
  ): Promise<Category> {
    const url = `${this.client.baseUrl}/api/categories/${id}`;
    const response = await this.fetchWithAuth(url, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return this.handleResponse<Category>(response);
  }

  /**
   * Delete a category
   * @param id Category ID
   * @returns Promise<void>
   */
  async deleteCategory(id: string): Promise<void> {
    const url = `${this.client.baseUrl}/api/categories/${id}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    await this.handleResponse<void>(response);
  }

  /**
   * Search categories by name
   * @param query Search query string
   * @returns Promise<Category[]> Array of matching categories
   */
  async searchCategories(query: string): Promise<Category[]> {
    const url = `${this.client.baseUrl}/api/categories/search?query=${encodeURIComponent(query)}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Category[]>(response);
  }

  /**
   * Get categories by IDs
   * @param categoryIds Array of category IDs to fetch
   * @returns Promise<Category[]> Array of requested categories
   */
  async getCategoriesByIds(categoryIds: string[]): Promise<Category[]> {
    const url = `${this.client.baseUrl}/api/categories/batch`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ categoryIds }),
    });
    return this.handleResponse<Category[]>(response);
  }

  /**
   * Extract categories from text using AI
   * @param text Text to extract categories from
   * @returns Promise<Category[]> Array of extracted categories
   */
  async extractCategories(text: string): Promise<Category[]> {
    const url = `${this.client.baseUrl}/api/categories/extract`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    return this.handleResponse<Category[]>(response);
  }
}

// Export as singleton using the main ApiClient instance
export const categoriesModule = new CategoriesModule(apiClient);
export default categoriesModule;
