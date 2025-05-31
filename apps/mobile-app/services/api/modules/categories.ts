import { BaseApiClient } from "../base/ApiClient";
import { Category } from "../base/types";

export class CategoriesModule extends BaseApiClient {
  /**
   * Get all categories
   * @returns Promise<Category[]> Array of all categories
   */
  async getAllCategories(): Promise<Category[]> {
    const url = `${this.baseUrl}/api/categories`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Category[]>(response);
  }

  /**
   * Search categories by name
   * @param query Search query string
   * @returns Promise<Category[]> Array of matching categories
   */
  async searchCategories(query: string): Promise<Category[]> {
    const url = `${this.baseUrl}/api/categories/search?query=${encodeURIComponent(query)}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Category[]>(response);
  }

  /**
   * Get categories by IDs
   * @param categoryIds Array of category IDs to fetch
   * @returns Promise<Category[]> Array of requested categories
   */
  async getCategoriesByIds(categoryIds: string[]): Promise<Category[]> {
    const url = `${this.baseUrl}/api/categories/batch`;
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
    const url = `${this.baseUrl}/api/categories/extract`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    return this.handleResponse<Category[]>(response);
  }
}

// Export as singleton
export const categoriesModule = new CategoriesModule();
