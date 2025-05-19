import { BaseApiClient } from "../base/ApiClient";
import { ApiEvent } from "../base/types";
import { EventType } from "@/types/types";
import { mapEventToEventType } from "../utils/eventMapper";

export class ClusterApiClient extends BaseApiClient {
  async getClusterHubData(markerIds: string[]): Promise<{
    featuredEvent: EventType | null;
    eventsByCategory: {
      category: { id: string; name: string };
      events: EventType[];
    }[];
    eventsByLocation: {
      location: string;
      events: EventType[];
    }[];
    eventsToday: EventType[];
    clusterEmoji: string;
    clusterName: string;
    clusterDescription: string;
    featuredCreator?: {
      id: string;
      displayName: string;
      email: string;
      eventCount: number;
      title: string;
      friendCode: string;
      creatorDescription: string;
    };
  }> {
    const url = `${this.baseUrl}/api/events/cluster-hub`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ markerIds }),
    });

    const data = await this.handleResponse<{
      featuredEvent: ApiEvent | null;
      eventsByCategory: {
        category: { id: string; name: string };
        events: ApiEvent[];
      }[];
      eventsByLocation: {
        location: string;
        events: ApiEvent[];
      }[];
      eventsToday: ApiEvent[];
      clusterEmoji: string;
      clusterName: string;
      clusterDescription: string;
      featuredCreator?: {
        id: string;
        displayName: string;
        email: string;
        eventCount: number;
        creatorDescription: string;
        title: string;
        friendCode: string;
      };
    }>(response);

    return {
      clusterEmoji: data.clusterEmoji,
      clusterName: data.clusterName,
      clusterDescription: data.clusterDescription,
      featuredEvent: data.featuredEvent
        ? mapEventToEventType(data.featuredEvent)
        : null,
      eventsByCategory: data.eventsByCategory.map((categoryGroup) => ({
        category: categoryGroup.category,
        events: categoryGroup.events.map(mapEventToEventType),
      })),
      eventsByLocation: data.eventsByLocation.map((locationGroup) => ({
        location: locationGroup.location,
        events: locationGroup.events.map(mapEventToEventType),
      })),
      eventsToday: data.eventsToday.map(mapEventToEventType),
      ...(data.featuredCreator && { featuredCreator: data.featuredCreator }),
    };
  }
}
