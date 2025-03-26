// This would be added to the backend service as src/services/UserPreferencesService.ts
import { DataSource, Repository } from "typeorm";
import Redis from "ioredis";
import { Filter as FilterEntity } from "../entities/Filter";
import { EmbeddingService } from "./shared/EmbeddingService";
import { OpenAIService } from "./shared/OpenAIService";

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
  private redisClient: Redis;
  private embeddingService: EmbeddingService;

  constructor(dataSource: DataSource, redisClient: Redis) {
    this.filterRepository = dataSource.getRepository(FilterEntity);
    this.redisClient = redisClient;
    this.embeddingService = EmbeddingService.getInstance();
    console.log('UserPreferencesService initialized');
  }

  /**
   * Generate an emoji for a filter based on its name and semantic query
   */
  private async generateFilterEmoji(name: string, semanticQuery?: string): Promise<string> {
    try {
      console.log(`Generating emoji for filter: ${name}${semanticQuery ? ` (query: ${semanticQuery})` : ''}`);
      const prompt = `Generate a single emoji that best represents this filter:
Name: ${name}
${semanticQuery ? `Query: ${semanticQuery}` : ''}

IMPORTANT: Respond with ONLY a single emoji character. No text, no explanation, no quotes, no spaces.
Example valid responses: 🎉 🎨 🎭
Example invalid responses: "🎉" or "party" or "🎉 🎨"`;

      console.log('Sending prompt to OpenAI:', prompt);
      const completion = await OpenAIService.executeChatCompletion({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content: "You are an emoji generator. Your ONLY task is to generate a single emoji character that best represents the given filter. Respond with ONLY the emoji character, no other text or explanation. If you cannot generate an appropriate emoji, respond with '❓'.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4,
        presence_penalty: 0,
        frequency_penalty: 0,
      });

      console.log('Raw OpenAI response:', JSON.stringify(completion, null, 2));
      console.log('OpenAI response content:', completion.choices[0].message.content);
      const emoji = completion.choices[0].message.content?.trim();
      console.log(`Generated emoji for filter "${name}": ${emoji || '❓'}`);
      return emoji || "❓";
    } catch (error) {
      console.error(`Error generating emoji for filter "${name}":`, error);
      return "❓";
    }
  }

  /**
   * Get all filters for a user
   */
  async getUserFilters(userId: string): Promise<Filter[]> {
    console.log(`Fetching all filters for user ${userId}`);
    const filters = await this.filterRepository.find({
      where: { userId },
      order: { updatedAt: "DESC" },
    });
    console.log(`Found ${filters.length} filters for user ${userId}`);
    return filters;
  }

  /**
   * Get active filters for a user
   */
  async getActiveFilters(userId: string): Promise<Filter[]> {
    console.log(`Fetching active filters for user ${userId}`);
    const filters = await this.filterRepository.find({
      where: { userId, isActive: true },
      order: { updatedAt: "DESC" },
      cache: 60000,
    });
    console.log(`Found ${filters.length} active filters for user ${userId}`);
    return filters;
  }

  async createFilter(userId: string, filterData: Partial<FilterEntity>): Promise<FilterEntity> {
    console.log(`Creating new filter for user ${userId}:`, { name: filterData.name, semanticQuery: filterData.semanticQuery });
    
    // Generate embedding if semanticQuery is provided
    if (filterData.semanticQuery) {
      try {
        console.log(`Generating embedding for filter "${filterData.name}"`);
        const embeddingSql = await this.embeddingService.getStructuredEmbeddingSql({
          text: filterData.semanticQuery,
          weights: {
            text: 5,
          },
        });

        filterData.embedding = embeddingSql;
        console.log(`Successfully generated embedding for filter "${filterData.name}"`);
      } catch (error) {
        console.error(`Error generating embedding for filter "${filterData.name}":`, error);
      }
    }

    // Generate emoji for the filter
    try {
      if (!filterData.name) {
        throw new Error("Filter name is required");
      }
      filterData.emoji = await this.generateFilterEmoji(
        filterData.name,
        filterData.semanticQuery
      );
    } catch (error) {
      console.error(`Error generating emoji for filter "${filterData.name}":`, error);
    }

    // Create the filter with embedding and emoji
    const filter = this.filterRepository.create({
      ...filterData,
      userId,
      isActive: filterData.isActive ?? true,
    });

    const savedFilter = await this.filterRepository.save(filter);
    console.log(`Successfully created filter "${filter.name}" (ID: ${filter.id}) for user ${userId}`);

    // Publish filter change event to Redis
    await this.publishFilterChange(userId);

    return savedFilter;
  }

  async updateFilter(
    filterId: string,
    userId: string,
    filterData: Partial<Filter>
  ): Promise<Filter> {
    console.log(`Updating filter ${filterId} for user ${userId}:`, filterData);
    
    // Ensure the filter belongs to the user
    const filter = await this.filterRepository.findOne({
      where: { id: filterId, userId },
    });

    if (!filter) {
      console.error(`Filter ${filterId} not found or does not belong to user ${userId}`);
      throw new Error("Filter not found or does not belong to user");
    }

    // Generate new embedding if semanticQuery is updated
    if (filterData.semanticQuery && filterData.semanticQuery !== filter.semanticQuery) {
      try {
        console.log(`Generating new embedding for updated filter "${filter.name}"`);
        const embeddingSql = await this.embeddingService.getStructuredEmbeddingSql({
          text: filterData.semanticQuery,
          weights: {
            text: 5,
          },
        });

        filterData.embedding = embeddingSql;
        console.log(`Successfully generated new embedding for filter "${filter.name}"`);
      } catch (error) {
        console.error(`Error generating embedding for filter update "${filter.name}":`, error);
      }
    }

    // Generate new emoji if name or semanticQuery is updated
    if (
      (filterData.name && filterData.name !== filter.name) ||
      (filterData.semanticQuery && filterData.semanticQuery !== filter.semanticQuery)
    ) {
      try {
        filterData.emoji = await this.generateFilterEmoji(
          filterData.name || filter.name,
          filterData.semanticQuery || filter.semanticQuery
        );
      } catch (error) {
        console.error(`Error generating emoji for filter update "${filter.name}":`, error);
      }
    }

    // Update the filter
    const updatedFilter = this.filterRepository.merge(filter, filterData);
    const savedFilter = await this.filterRepository.save(updatedFilter);
    console.log(`Successfully updated filter "${filter.name}" (ID: ${filter.id}) for user ${userId}`);

    // Publish filter change event to Redis
    await this.publishFilterChange(userId);

    return savedFilter;
  }

  /**
   * Delete a filter
   */
  async deleteFilter(filterId: string, userId: string): Promise<boolean> {
    console.log(`Attempting to delete filter ${filterId} for user ${userId}`);
    
    // Ensure the filter belongs to the user
    const filter = await this.filterRepository.findOne({
      where: { id: filterId, userId },
    });

    if (!filter) {
      console.error(`Filter ${filterId} not found or does not belong to user ${userId}`);
      throw new Error("Filter not found or does not belong to user");
    }

    // Delete the filter
    await this.filterRepository.remove(filter);
    console.log(`Successfully deleted filter "${filter.name}" (ID: ${filterId}) for user ${userId}`);

    // Publish filter change event to Redis
    await this.publishFilterChange(userId);

    return true;
  }

  /**
   * Set filters as active/inactive
   */
  async setActiveFilters(userId: string, filterIds: string[]): Promise<Filter[]> {
    console.log(`Setting active filters for user ${userId}:`, filterIds);
    
    return this.filterRepository.manager.transaction(async (transactionalEntityManager) => {
      // Get all user filters - using transactionalEntityManager
      const userFilters = await transactionalEntityManager.find(FilterEntity, {
        where: { userId },
        order: { updatedAt: "DESC" },
      });

      // Update the active state based on the provided IDs
      const updatedFilters = userFilters.map((filter) => ({
        ...filter,
        isActive: filterIds.includes(filter.id),
      }));

      // Save all updates - using transactionalEntityManager
      const savedFilters = await transactionalEntityManager.save(FilterEntity, updatedFilters);
      console.log(`Successfully updated active state for ${savedFilters.length} filters for user ${userId}`);

      // Publish filter change event to Redis (this happens outside the transaction)
      await this.publishFilterChange(userId);

      return savedFilters;
    });
  }

  /**
   * Clear all active filters for a user
   */
  async clearActiveFilters(userId: string): Promise<boolean> {
    console.log(`Clearing all active filters for user ${userId}`);
    
    const userFilters = await this.getUserFilters(userId);

    // Set all filters to inactive
    const updatedFilters = userFilters.map((filter) => ({
      ...filter,
      isActive: false,
    }));

    // Save all updates
    await this.filterRepository.save(updatedFilters);
    console.log(`Successfully cleared ${updatedFilters.length} active filters for user ${userId}`);

    // Publish filter change event to Redis
    await this.publishFilterChange(userId);

    return true;
  }

  /**
   * Publish filter change event to Redis
   */
  private async publishFilterChange(userId: string): Promise<void> {
    try {
      console.log(`Preparing to publish filter change event for user ${userId}`);
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

      console.log(`Successfully published filter change event for user ${userId} with ${activeFilters.length} active filters`);
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
      console.log(`Successfully updated active state for ${updatedFilters.length} filters`);

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
        `Successfully published filter change event for user ${userId} with ${activeFilters.length} active filters`
      );
      return true;
    } catch (error) {
      console.error(`Error applying filters for user ${userId}:`, error);
      return false;
    }
  }

  async getFilterById(filterId: string, userId: string): Promise<FilterEntity | null> {
    console.log(`Fetching filter ${filterId} for user ${userId}`);
    const filter = await this.filterRepository.findOne({
      where: {
        id: filterId,
        userId,
      },
    });
    console.log(`Filter ${filterId} ${filter ? 'found' : 'not found'} for user ${userId}`);
    return filter;
  }
}
