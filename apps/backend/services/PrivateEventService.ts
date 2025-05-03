import { DataSource, Repository } from "typeorm";
import { PrivateEvent, PrivateEventStatus } from "../entities/PrivateEvent";
import { User } from "../entities/User";
import { Category } from "../entities/Category";
import { GoogleGeocodingService } from "./shared/GoogleGeocodingService";
import { type Point } from "geojson";
import { CacheService } from "./shared/CacheService";
import { OpenAIService, OpenAIModel } from "./shared/OpenAIService";
import { In } from "typeorm";

interface CreatePrivateEventInput {
  emoji: string;
  emojiDescription?: string;
  title: string;
  description?: string;
  eventDate: Date;
  endDate?: Date;
  location?: Point;
  locationClues?: string[];
  categoryIds?: string[];
  creatorId: string;
  invitedUserIds: string[];
  imageUrl?: string;
  imageDescription?: string;
  timezone?: string;
  isProcessedByAI?: boolean;
}

interface UpdatePrivateEventInput extends Partial<CreatePrivateEventInput> {
  privateStatus?: PrivateEventStatus;
}

export class PrivateEventService {
  private privateEventRepository: Repository<PrivateEvent>;
  private userRepository: Repository<User>;
  private categoryRepository: Repository<Category>;
  private locationService: GoogleGeocodingService;

  constructor(private dataSource: DataSource) {
    this.privateEventRepository = dataSource.getRepository(PrivateEvent);
    this.userRepository = dataSource.getRepository(User);
    this.categoryRepository = dataSource.getRepository(Category);
    this.locationService = GoogleGeocodingService.getInstance();
  }

  /**
   * Create a new private event
   */
  async createEvent(input: CreatePrivateEventInput): Promise<PrivateEvent> {
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      // Resolve location if locationClues are provided
      let location: Point | undefined;
      let address: string | undefined;
      let locationNotes: string | undefined;

      if (input.locationClues?.length) {
        const locationResult = await this.locationService.resolveLocation(input.locationClues);
        location = locationResult.coordinates;
        address = locationResult.address;
        locationNotes = locationResult.locationNotes;
      } else if (input.location) {
        location = input.location;
        // Get address from coordinates
        const addressResult = await this.locationService.reverseGeocodeCityState(
          input.location.coordinates[1],
          input.location.coordinates[0]
        );
        address = addressResult;
      }

      // Get invited users
      const invitedUsers = await this.userRepository.findByIds(input.invitedUserIds);

      // Get categories if provided
      let categories: Category[] = [];
      if (input.categoryIds?.length) {
        categories = await this.categoryRepository.findByIds(input.categoryIds);
      }

      // Create the event
      const event = this.privateEventRepository.create({
        ...input,
        location,
        address,
        locationNotes,
        invitedUsers,
        categories,
        privateStatus: PrivateEventStatus.DRAFT,
      });

      // If AI processing is requested, process the event
      if (input.isProcessedByAI) {
        await this.processEventWithAI(event);
      }

      return transactionalEntityManager.save(event);
    });
  }

  /**
   * Get a private event by ID
   */
  async getEventById(id: string): Promise<PrivateEvent | null> {
    try {
      // Try to get from cache first
      const cachedEvent = await CacheService.getCachedEvent(id);
      if (cachedEvent && cachedEvent instanceof PrivateEvent) {
        return cachedEvent;
      }

      const event = await this.privateEventRepository.findOne({
        where: { id },
        relations: ["categories", "creator", "invitedUsers"],
      });

      if (event) {
        await CacheService.setCachedEvent(id, event, 300); // 5 minutes TTL
      }

      return event;
    } catch (error) {
      console.error(`Error fetching private event ${id}:`, error);
      return null;
    }
  }

  /**
   * Update a private event
   */
  async updateEvent(id: string, input: UpdatePrivateEventInput): Promise<PrivateEvent | null> {
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const event = await this.getEventById(id);
      if (!event) return null;

      // Handle location updates
      if (input.locationClues?.length) {
        const locationResult = await this.locationService.resolveLocation(input.locationClues);
        event.location = locationResult.coordinates;
        event.address = locationResult.address;
        event.locationNotes = locationResult.locationNotes;
      } else if (input.location) {
        event.location = input.location;
        const addressResult = await this.locationService.reverseGeocodeCityState(
          input.location.coordinates[1],
          input.location.coordinates[0]
        );
        event.address = addressResult;
      }

      // Handle invited users update
      if (input.invitedUserIds) {
        const invitedUsers = await this.userRepository.findByIds(input.invitedUserIds);
        event.invitedUsers = invitedUsers;
      }

      // Handle categories update
      if (input.categoryIds) {
        const categories = await this.categoryRepository.findByIds(input.categoryIds);
        event.categories = categories;
      }

      // Update other fields
      if (input.title) event.title = input.title;
      if (input.description !== undefined) event.description = input.description;
      if (input.eventDate) event.eventDate = input.eventDate;
      if (input.endDate !== undefined) event.endDate = input.endDate;
      if (input.emoji) event.emoji = input.emoji;
      if (input.emojiDescription !== undefined) event.emojiDescription = input.emojiDescription;
      if (input.imageUrl !== undefined) event.imageUrl = input.imageUrl;
      if (input.imageDescription !== undefined) event.imageDescription = input.imageDescription;
      if (input.privateStatus) event.privateStatus = input.privateStatus;
      if (input.timezone) event.timezone = input.timezone;

      // If AI processing is requested, process the event
      if (input.isProcessedByAI && !event.isProcessedByAI) {
        await this.processEventWithAI(event);
      }

      const updatedEvent = await transactionalEntityManager.save(event);

      // Invalidate cache
      await CacheService.invalidateEventCache(id);

      return updatedEvent;
    });
  }

  /**
   * Delete a private event
   */
  async deleteEvent(id: string): Promise<boolean> {
    try {
      const result = await this.privateEventRepository.delete(id);
      await CacheService.invalidateEventCache(id);
      return result.affected ? result.affected > 0 : false;
    } catch (error) {
      console.error(`Error deleting private event ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get events created by a user
   */
  async getEventsByCreator(
    creatorId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ events: PrivateEvent[]; total: number }> {
    const { limit = 10, offset = 0 } = options;

    const [events, total] = await this.privateEventRepository.findAndCount({
      where: { creatorId },
      relations: ["categories", "invitedUsers"],
      take: limit,
      skip: offset,
      order: { eventDate: "DESC" },
    });

    return { events, total };
  }

  /**
   * Get events where a user is invited
   */
  async getInvitedEvents(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ events: PrivateEvent[]; total: number }> {
    const { limit = 10, offset = 0 } = options;

    const [events, total] = await this.privateEventRepository
      .createQueryBuilder("event")
      .innerJoin("event.invitedUsers", "user", "user.id = :userId", { userId })
      .leftJoinAndSelect("event.categories", "category")
      .leftJoinAndSelect("event.creator", "creator")
      .take(limit)
      .skip(offset)
      .orderBy("event.eventDate", "DESC")
      .getManyAndCount();

    return { events, total };
  }

  /**
   * Process event with AI to enhance its data
   */
  private async processEventWithAI(event: PrivateEvent): Promise<void> {
    try {
      const response = await OpenAIService.executeChatCompletion({
        model: OpenAIModel.GPT4OMini,
        messages: [
          {
            role: "system",
            content: `You are an event analysis expert. Analyze the event details and provide enhancements.
            Focus on:
            1. Suggesting relevant categories
            2. Improving the description
            3. Adding relevant emoji
            4. Suggesting location notes
            
            Respond in JSON format:
            {
              "suggestedCategories": string[],
              "enhancedDescription": string,
              "suggestedEmoji": string,
              "locationNotes": string
            }`,
          },
          {
            role: "user",
            content: `Analyze this event:
            Title: ${event.title}
            Description: ${event.description || ""}
            Location: ${event.address || ""}
            Date: ${event.eventDate}
            Current Emoji: ${event.emoji}
            Current Categories: ${event.categories.map((c) => c.name).join(", ")}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");

      // Update event with AI suggestions
      if (result.enhancedDescription) {
        event.description = result.enhancedDescription;
      }
      if (result.suggestedEmoji) {
        event.emoji = result.suggestedEmoji;
      }
      if (result.locationNotes) {
        event.locationNotes = result.locationNotes;
      }

      // Update categories if suggested
      if (result.suggestedCategories?.length) {
        const categories = await this.categoryRepository.find({
          where: { name: In(result.suggestedCategories) },
        });
        event.categories = categories;
      }

      event.isProcessedByAI = true;
    } catch (error) {
      console.error("Error processing event with AI:", error);
      // Don't throw - we don't want to fail the event creation/update if AI processing fails
    }
  }

  /**
   * Search for places using Google Places API
   */
  async searchPlaces(
    query: string,
    userContext?: {
      cityState?: string;
      coordinates?: { lat: number; lng: number };
    }
  ) {
    return this.locationService.resolveLocation([query], userContext);
  }
}
