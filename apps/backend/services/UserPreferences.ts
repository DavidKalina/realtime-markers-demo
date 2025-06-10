// This would be added to the backend service as src/services/UserPreferencesService.ts
import { DataSource, Repository } from "typeorm";
import { Filter as FilterEntity } from "../entities/Filter";
import { EmbeddingService } from "./shared/EmbeddingService";
import { OpenAIModel, OpenAIService } from "./shared/OpenAIService";
import { RedisService } from "./shared/RedisService";

interface Filter {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  semanticQuery?: string;
  embedding?: string;
  emoji?: string;
  criteria: {
    dateRange?: {
      start?: string;
      end?: string;
    };
    status?: string[];
    location?: {
      latitude?: number;
      longitude?: number;
      radius?: number;
    };
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
  private redisService: RedisService;
  private embeddingService: EmbeddingService;

  constructor(dataSource: DataSource, redisService: RedisService) {
    this.filterRepository = dataSource.getRepository(FilterEntity);
    this.redisService = redisService;
    this.embeddingService = EmbeddingService.getInstance();
  }

  /**
   * Generate an emoji for a filter based on its name and semantic query
   */
  public async generateFilterEmoji(
    name: string,
    semanticQuery?: string,
  ): Promise<string> {
    try {
      const prompt = `Generate a single emoji that best represents this filter:
Name: ${name}
${semanticQuery ? `Query: ${semanticQuery}` : ""}

IMPORTANT: Respond with ONLY a single emoji character. No text, no explanation, no quotes, no spaces.
Example valid responses: 🎉 🎨 🎭
Example invalid responses: "🎉" or "party" or "🎉 🎨"`;

      const completion = await OpenAIService.executeChatCompletion({
        model: OpenAIModel.GPT4OMini,
        messages: [
          {
            role: "system",
            content:
              "You are an emoji generator. Your ONLY task is to generate a single emoji character that best represents the given filter. Respond with ONLY the emoji character, no other text or explanation. If you cannot generate an appropriate emoji, respond with '❓'.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4,
      });

      const emoji = completion.choices[0].message.content?.trim();
      return emoji || "❓";
    } catch (error) {
      console.error(`Error generating emoji for filter "${name}":`, error);
      return "❓";
    }
  }

  /**
   * Generate an emoji for filter data (public method for handlers)
   */
  public async generateFilterEmojiForData(
    filterData: Partial<FilterEntity>,
  ): Promise<string> {
    if (!filterData.name) {
      throw new Error("Filter name is required for emoji generation");
    }

    return this.generateFilterEmoji(filterData.name, filterData.semanticQuery);
  }

  /**
   * Get all filters for a user
   */
  async getUserFilters(userId: string): Promise<Filter[]> {
    const filters = await this.filterRepository.find({
      where: { userId },
      order: { updatedAt: "DESC" },
    });
    return filters;
  }

  /**
   * Get active filters for a user
   */
  async getActiveFilters(userId: string): Promise<Filter[]> {
    const filters = await this.filterRepository.find({
      where: { userId, isActive: true },
      order: { updatedAt: "DESC" },
      cache: 60000,
    });
    return filters;
  }

  async createFilter(
    userId: string,
    filterData: Partial<FilterEntity>,
  ): Promise<FilterEntity> {
    // Create the filter first without embedding and emoji
    const filter = this.filterRepository.create({
      ...filterData,
      userId,
      isActive: filterData.isActive ?? true,
    });

    const savedFilter = await this.filterRepository.save(filter);

    // Generate embedding and emoji asynchronously (non-blocking)
    this.generateFilterEnhancements(savedFilter.id, filterData).catch(
      (error) => {
        console.error(
          `Error generating enhancements for filter "${savedFilter.id}":`,
          error,
        );
      },
    );

    // Publish filter change event to Redis
    await this.publishFilterChange(userId);

    return savedFilter;
  }

  /**
   * Generate embedding and emoji for a filter asynchronously
   */
  private async generateFilterEnhancements(
    filterId: string,
    filterData: Partial<FilterEntity>,
  ): Promise<void> {
    try {
      const updates: Partial<FilterEntity> = {};

      // Generate embedding if semanticQuery is provided
      if (filterData.semanticQuery) {
        try {
          const embeddingSql =
            await this.embeddingService.getStructuredEmbeddingSql({
              text: filterData.semanticQuery,
              weights: {
                text: 5,
              },
            });

          updates.embedding = embeddingSql;
        } catch (error) {
          console.error(
            `Error generating embedding for filter "${filterId}":`,
            error,
          );
        }
      }

      // Generate emoji for the filter
      try {
        if (filterData.name) {
          updates.emoji = await this.generateFilterEmoji(
            filterData.name,
            filterData.semanticQuery,
          );
        }
      } catch (error) {
        console.error(
          `Error generating emoji for filter "${filterId}":`,
          error,
        );
      }

      // Update the filter with enhancements if any were generated
      if (Object.keys(updates).length > 0) {
        await this.filterRepository.update(filterId, updates);
        console.log(
          `Updated filter ${filterId} with enhancements:`,
          Object.keys(updates),
        );
      }
    } catch (error) {
      console.error(
        `Error in generateFilterEnhancements for filter ${filterId}:`,
        error,
      );
    }
  }

  async updateFilter(
    filterId: string,
    userId: string,
    filterData: Partial<Filter>,
  ): Promise<Filter> {
    // Ensure the filter belongs to the user
    const filter = await this.filterRepository.findOne({
      where: { id: filterId, userId },
    });

    if (!filter) {
      console.error(
        `Filter ${filterId} not found or does not belong to user ${userId}`,
      );
      throw new Error("Filter not found or does not belong to user");
    }

    // Check if we need to generate new embedding or emoji
    const needsEnhancements =
      (filterData.semanticQuery &&
        filterData.semanticQuery !== filter.semanticQuery) ||
      (filterData.name && filterData.name !== filter.name);

    // Update the filter immediately with basic data
    const updatedFilter = this.filterRepository.merge(filter, filterData);
    const savedFilter = await this.filterRepository.save(updatedFilter);

    // Generate new embedding and emoji asynchronously if needed
    if (needsEnhancements) {
      this.generateFilterEnhancements(filterId, filterData).catch((error) => {
        console.error(
          `Error generating enhancements for filter update "${filterId}":`,
          error,
        );
      });
    }

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
      console.error(
        `Filter ${filterId} not found or does not belong to user ${userId}`,
      );
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
  async setActiveFilters(
    userId: string,
    filterIds: string[],
  ): Promise<Filter[]> {
    return this.filterRepository.manager.transaction(
      async (transactionalEntityManager) => {
        // Get all user filters - using transactionalEntityManager
        const userFilters = await transactionalEntityManager.find(
          FilterEntity,
          {
            where: { userId },
            order: { updatedAt: "DESC" },
          },
        );

        // Update the active state based on the provided IDs
        const updatedFilters = userFilters.map((filter) => ({
          ...filter,
          isActive: filterIds.includes(filter.id),
        }));

        // Save all updates - using transactionalEntityManager
        const savedFilters = await transactionalEntityManager.save(
          FilterEntity,
          updatedFilters,
        );
        console.log(
          `Successfully updated active state for ${savedFilters.length} filters for user ${userId}`,
        );

        // Publish filter change event to Redis (this happens outside the transaction)
        await this.publishFilterChange(userId);

        return savedFilters;
      },
    );
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

      // Publish the event to Redis using RedisService with the new publishMessage method
      await this.redisService.publishMessage("filter-changes", {
        userId,
        filters: activeFilters,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        `Error publishing filter change for user ${userId}:`,
        error,
      );
      // Don't throw the error - we want to continue even if Redis publishing fails
    }
  }

  async applyFilters(userId: string, filterIds: string[]): Promise<boolean> {
    try {
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

      // Publish filter change event with the active filters using the new publishMessage method
      try {
        await this.redisService.publishMessage("filter-changes", {
          userId,
          filters: activeFilters,
          timestamp: new Date().toISOString(),
        });
      } catch (redisError) {
        console.error("Error publishing filter change to Redis:", redisError);
        // Continue even if Redis publishing fails
      }

      return true;
    } catch (error) {
      console.error(`Error applying filters for user ${userId}:`, error);
      return false;
    }
  }

  async getFilterById(
    filterId: string,
    userId: string,
  ): Promise<FilterEntity | null> {
    const filter = await this.filterRepository.findOne({
      where: {
        id: filterId,
        userId,
      },
    });
    return filter;
  }
}
