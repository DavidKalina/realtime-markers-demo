// This would be added to the backend service as src/services/UserPreferencesService.ts
import { DataSource, Repository } from "typeorm";
import Redis from "ioredis";
import { Filter as FilterEntity } from "../entities/Filter";

// This would need to be created in the backend's entities folder
interface Filter {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  criteria: {
    categories?: string[];
    dateRange?: {
      start?: string;
      end?: string;
    };
    status?: string[];
    keywords?: string[];
    tags?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Preferences Service handles storing and retrieving user filter preferences,
 * and publishing filter change events to Redis when preferences are updated.
 */
export class UserPreferencesService {
  private filterRepository: Repository<Filter>;
  private redisClient: Redis;

  constructor(dataSource: DataSource, redisClient: Redis) {
    this.filterRepository = dataSource.getRepository(FilterEntity);
    this.redisClient = redisClient;
  }

  /**
   * Get all filters for a user
   */
  async getUserFilters(userId: string): Promise<Filter[]> {
    return this.filterRepository.find({
      where: { userId },
      order: { updatedAt: "DESC" },
    });
  }

  /**
   * Get active filters for a user
   */
  async getActiveFilters(userId: string): Promise<Filter[]> {
    return this.filterRepository.find({
      where: { userId, isActive: true },
      order: { updatedAt: "DESC" },
    });
  }

  /**
   * Create a new filter for a user
   */
  async createFilter(userId: string, filterData: Partial<Filter>): Promise<Filter> {
    const filter = this.filterRepository.create({
      ...filterData,
      userId,
      isActive: filterData.isActive ?? true,
    });

    const savedFilter = await this.filterRepository.save(filter);

    // Publish filter change event to Redis
    await this.publishFilterChange(userId);

    return savedFilter;
  }

  /**
   * Update an existing filter
   */
  async updateFilter(
    filterId: string,
    userId: string,
    filterData: Partial<Filter>
  ): Promise<Filter> {
    // Ensure the filter belongs to the user
    const filter = await this.filterRepository.findOne({
      where: { id: filterId, userId },
    });

    if (!filter) {
      throw new Error("Filter not found or does not belong to user");
    }

    // Update the filter
    const updatedFilter = this.filterRepository.merge(filter, filterData);
    const savedFilter = await this.filterRepository.save(updatedFilter);

    // Publish filter change event to Redis
    await this.publishFilterChange(userId);

    return savedFilter;
  }

  /**
   * Delete a filter
   */
  async deleteFilter(filterId: string, userId: string): Promise<boolean> {
    // Ensure the filter belongs to the user
    const filter = await this.filterRepository.findOne({
      where: { id: filterId, userId },
    });

    if (!filter) {
      throw new Error("Filter not found or does not belong to user");
    }

    // Delete the filter
    await this.filterRepository.remove(filter);

    // Publish filter change event to Redis
    await this.publishFilterChange(userId);

    return true;
  }

  /**
   * Set filters as active/inactive
   */
  async setActiveFilters(userId: string, filterIds: string[]): Promise<Filter[]> {
    // Get all user filters
    const userFilters = await this.getUserFilters(userId);

    // Update the active state based on the provided IDs
    const updatedFilters = userFilters.map((filter) => ({
      ...filter,
      isActive: filterIds.includes(filter.id),
    }));

    // Save all updates
    const savedFilters = await this.filterRepository.save(updatedFilters);

    // Publish filter change event to Redis
    await this.publishFilterChange(userId);

    return savedFilters;
  }

  /**
   * Clear all active filters for a user
   */
  async clearActiveFilters(userId: string): Promise<boolean> {
    const userFilters = await this.getUserFilters(userId);

    // Set all filters to inactive
    const updatedFilters = userFilters.map((filter) => ({
      ...filter,
      isActive: false,
    }));

    // Save all updates
    await this.filterRepository.save(updatedFilters);

    // Publish filter change event to Redis
    await this.publishFilterChange(userId);

    return true;
  }

  /**
   * Publish filter change event to Redis
   */
  private async publishFilterChange(userId: string): Promise<void> {
    try {
      // Get the active filters for the user
      const activeFilters = await this.getActiveFilters(userId);

      // Publish the event to Redis
      await this.redisClient.publish(
        "filter-changes",
        JSON.stringify({
          userId,
          filters: activeFilters,
          timestamp: new Date().toISOString(),
        })
      );

      console.log(`Published filter change event for user ${userId}`);
    } catch (error) {
      console.error(`Error publishing filter change for user ${userId}:`, error);
    }
  }

  async applyFilters(userId: string, filterIds: string[]): Promise<boolean> {
    try {
      console.log(`Applying filters for user ${userId}: ${filterIds.join(", ")}`);

      // Get all user filters
      const userFilters = await this.getUserFilters(userId);

      // Update isActive status based on filterIds
      const updatedFilters = userFilters.map((filter) => ({
        ...filter,
        isActive: filterIds.includes(filter.id),
      }));

      // Save the updates
      await this.filterRepository.save(updatedFilters);

      // Get only the active filters after update
      const activeFilters = updatedFilters.filter((filter) => filter.isActive);

      // Publish filter change event with the active filters
      await this.redisClient.publish(
        "filter-changes",
        JSON.stringify({
          userId,
          filters: activeFilters,
          timestamp: new Date().toISOString(),
        })
      );

      console.log(
        `Published filter change event for user ${userId} with ${activeFilters.length} active filters`
      );
      return true;
    } catch (error) {
      console.error(`Error applying filters for user ${userId}:`, error);
      return false;
    }
  }
}
