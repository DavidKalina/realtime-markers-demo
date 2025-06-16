import { DataSource, Repository } from "typeorm";
import { Event } from "../entities/Event";
import { Category } from "../entities/Category";
import { User } from "../entities/User";
import type { EventCacheService } from "./shared/EventCacheService";
import type { OpenAIService } from "./shared/OpenAIService";
import { OpenAIModel } from "./shared/OpenAIService";

export interface EventAnalysisService {
  getClusterHubData(markerIds: string[]): Promise<{
    featuredEvent: Event | null;
    eventsByCategory: { category: Category; events: Event[] }[];
    eventsByLocation: { location: string; events: Event[] }[];
    eventsToday: Event[];
    clusterName: string;
    clusterDescription: string;
    clusterEmoji: string;
    featuredCreator?: {
      id: string;
      displayName: string;
      email: string;
      eventCount: number;
      creatorDescription: string;
      title: string;
      friendCode: string;
    };
  }>;
}

export interface EventAnalysisServiceDependencies {
  dataSource: DataSource;
  eventCacheService: EventCacheService;
  openaiService: OpenAIService;
}

export class EventAnalysisServiceImpl implements EventAnalysisService {
  private eventRepository: Repository<Event>;
  private categoryRepository: Repository<Category>;
  private userRepository: Repository<User>;
  private eventCacheService: EventCacheService;
  private openaiService: OpenAIService;

  constructor(private dependencies: EventAnalysisServiceDependencies) {
    this.eventRepository = dependencies.dataSource.getRepository(Event);
    this.categoryRepository = dependencies.dataSource.getRepository(Category);
    this.userRepository = dependencies.dataSource.getRepository(User);
    this.eventCacheService = dependencies.eventCacheService;
    this.openaiService = dependencies.openaiService;
  }

  async getClusterHubData(markerIds: string[]): Promise<{
    featuredEvent: Event | null;
    eventsByCategory: { category: Category; events: Event[] }[];
    eventsByLocation: { location: string; events: Event[] }[];
    eventsToday: Event[];
    clusterName: string;
    clusterDescription: string;
    clusterEmoji: string;
    featuredCreator?: {
      id: string;
      displayName: string;
      email: string;
      eventCount: number;
      creatorDescription: string;
      title: string;
      friendCode: string;
    };
  }> {
    // Try to get from cache first
    const cachedData = await this.eventCacheService.getClusterHub(markerIds);
    if (cachedData) {
      return cachedData;
    }

    // Get all events from the marker IDs
    const events = await this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "category")
      .leftJoinAndSelect("event.creator", "creator") // Ensure we load creator information
      .where("event.id IN (:...markerIds)", { markerIds })
      .getMany();

    if (events.length === 0) {
      return {
        featuredEvent: null,
        eventsByCategory: [],
        eventsByLocation: [],
        eventsToday: [],
        clusterName: "",
        clusterDescription: "",
        clusterEmoji: "🎉",
      };
    }

    // Track creator contributions
    const creatorMap = new Map<string, { user: User; eventCount: number }>();
    events.forEach((event) => {
      if (event.creator) {
        const creatorId = event.creator.id;
        if (!creatorMap.has(creatorId)) {
          creatorMap.set(creatorId, { user: event.creator, eventCount: 0 });
        }
        creatorMap.get(creatorId)!.eventCount++;
      }
    });

    // Find the most prolific creator
    let featuredCreator;
    if (creatorMap.size > 0) {
      const [mostProlificCreator] = Array.from(creatorMap.entries())
        .sort(([, a], [, b]) => b.eventCount - a.eventCount)
        .slice(0, 1);

      if (mostProlificCreator) {
        const [, creatorData] = mostProlificCreator;
        featuredCreator = {
          id: creatorData.user.id,
          displayName: creatorData.user.displayName || creatorData.user.email,
          email: creatorData.user.email,
          eventCount: creatorData.eventCount,
          title: creatorData.user.currentTitle || "Explorer",
          friendCode: creatorData.user.friendCode || "NONE",
          creatorDescription: "", // Will be filled by LLM
        };
      }
    }

    // Generate cluster name and description
    let clusterName = "";
    let clusterDescription = "";
    let clusterEmoji = "🎉"; // Default emoji

    try {
      const eventContext = events
        .slice(0, 10)
        .map(
          (event) =>
            `${event.title}${event.description ? `: ${event.description}` : ""}`,
        )
        .join("\n");

      const creatorContext = featuredCreator
        ? `\n\nFeatured Creator: ${featuredCreator.displayName} has created ${featuredCreator.eventCount} events in this cluster.`
        : "";

      const response = await this.openaiService.executeChatCompletion({
        model: OpenAIModel.GPT4OMini,
        messages: [
          {
            role: "system",
            content: `
You are a 'Spark,' an AI that uncovers and describes exciting 'Hotspots' where interesting things are happening.
Your goal is to make each cluster of events sound like a unique find, a vibrant corner of the world beckoning exploration.
Frame it with a sense of adventure and discovery, but keep it concise and catchy.

If a 'Featured Creator' is present, portray them as a 'Pioneer' or 'Catalyst' who has significantly shaped this hotspot's character.
Your response MUST be a JSON object in this exact format:
{
  "name": "A snappy, evocative 'Hotspot Name' (2-3 words) that hints at the adventure or core activity.",
  "description": "A brief, punchy 'Discovery Blurb' (1-2 short sentences) that makes people curious and eager to check out what's going on.",
  "emoji": "A single emoji that serves as a 'Discovery Marker' or 'Map Pin' for this hotspot.",
  "creatorDescription": "IF a creator is present: A concise, impactful acknowledgement of the 'Pioneer/Catalyst' (1 sentence). How have they ignited activity here?"
}

Use the provided event details as clues to define the hotspot's unique flavor.
The name should be intriguing. The blurb should feel like an invitation to an adventure.
`,
          },
          {
            role: "user",
            content: `Based on these events${creatorContext}, create a name, tagline, and emoji for this cluster:\n\n${eventContext}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");
      clusterName = result.name || events[0]?.title || "Event Cluster";
      clusterDescription =
        result.description ||
        events[0]?.description ||
        "Check out these exciting events!";
      clusterEmoji = result.emoji || "🎉";

      if (featuredCreator) {
        featuredCreator.creatorDescription = result.creatorDescription || "";
      }
    } catch (error) {
      console.error("Error generating cluster name and description:", error);
      clusterName = events[0]?.title || "Event Cluster";
      clusterDescription =
        events[0]?.description || "Check out these exciting events!";
      // clusterEmoji remains default "🎉"
    }

    // 1. Get featured event (oldest event for now)
    const featuredEvent = events.reduce((oldest, current) => {
      // Compare dates properly
      const oldestDate = new Date(oldest.eventDate);
      const currentDate = new Date(current.eventDate);
      return oldestDate.getTime() < currentDate.getTime() ? oldest : current;
    });

    // 2. Get events by category (IMPROVED LOGIC)
    // First, group all events by all their categories to count initial popularity
    const allCategoryDataMap = new Map<
      string,
      { category: Category; events: Event[] }
    >();
    events.forEach((event) => {
      // Ensure event.categories is an array before iterating
      if (event.categories && Array.isArray(event.categories)) {
        event.categories.forEach((category) => {
          if (!allCategoryDataMap.has(category.id)) {
            allCategoryDataMap.set(category.id, { category, events: [] });
          }
          // Collect all events for each category at this stage
          allCategoryDataMap.get(category.id)!.events.push(event);
        });
      }
    });

    // Determine the top N categories based on raw event counts (before deduplication)
    const sortedTopCategoryCandidates = Array.from(allCategoryDataMap.values())
      .sort((a, b) => b.events.length - a.events.length) // Sort by most events first
      .slice(0, 10); // Take the top 10 candidates

    const finalEventsByCategory: { category: Category; events: Event[] }[] = [];
    const assignedEventIds = new Set<string>(); // To track events already assigned

    for (const candidate of sortedTopCategoryCandidates) {
      const exclusiveEventsForThisCategory: Event[] = [];
      // Iterate through all events originally mapped to this candidate category
      for (const event of candidate.events) {
        if (!assignedEventIds.has(event.id)) {
          // If the event hasn't been assigned to a previous (higher-priority) category,
          // it belongs to this current category.
          exclusiveEventsForThisCategory.push(event);
          // Mark it as assigned immediately so it's not picked up by other categories
          // within this same candidate's event list (if an event somehow appeared twice
          // in candidate.events) or by subsequent, lower-priority categories.
          assignedEventIds.add(event.id);
        }
      }

      // Only add the category to the final list if it has any exclusive events
      if (exclusiveEventsForThisCategory.length > 0) {
        finalEventsByCategory.push({
          category: candidate.category,
          events: exclusiveEventsForThisCategory,
        });
      }
    }
    // `finalEventsByCategory` now holds categories with exclusive event lists.
    // Assign it to the variable name expected in the return object.
    const eventsByCategory = finalEventsByCategory;

    // 3. Get events by location
    const locationMap = new Map<string, Event[]>();
    events.forEach((event) => {
      if (event.address) {
        const locationMatch = event.address.match(/([^,]+,\s*[A-Z]{2})/); // e.g., "Provo, UT"
        if (locationMatch) {
          const location = locationMatch[0].trim(); // Trim whitespace from the captured location
          if (!locationMap.has(location)) {
            locationMap.set(location, []);
          }
          locationMap.get(location)!.push(event);
        }
        // Consider adding a fallback or more general location parsing if addresses vary widely
      }
    });

    const eventsByLocation = Array.from(locationMap.entries())
      .map(([location, locEvents]) => ({ location, events: locEvents }))
      .sort((a, b) => b.events.length - a.events.length);

    // 4. Get events happening today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const eventsToday = events.filter((event) => {
      const eventDate = new Date(event.eventDate);
      return eventDate >= today && eventDate < tomorrow;
    });

    const result = {
      featuredEvent,
      eventsByCategory,
      eventsByLocation,
      eventsToday,
      clusterName,
      clusterDescription,
      clusterEmoji,
      ...(featuredCreator && { featuredCreator }),
    };

    // Cache the result
    await this.eventCacheService.setClusterHub(markerIds, result);

    return result;
  }
}

/**
 * Factory function to create an EventAnalysisService instance
 */
export function createEventAnalysisService(
  dependencies: EventAnalysisServiceDependencies,
): EventAnalysisService {
  return new EventAnalysisServiceImpl(dependencies);
}
