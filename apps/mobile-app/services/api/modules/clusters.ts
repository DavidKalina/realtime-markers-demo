import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";
import { ApiEvent } from "../base/types";
import { EventType } from "@/types/types";
import { mapEventToEventType } from "../utils/eventMapper";
import { Cluster, ClusterCreateInput, ClusterUpdateInput } from "../base/types";

export class ClusterApiClient extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async getClusters(params: {
    lat: number;
    lng: number;
    radius: number;
  }): Promise<Cluster[]> {
    const queryParams = new URLSearchParams({
      lat: params.lat.toString(),
      lng: params.lng.toString(),
      radius: params.radius.toString(),
    });

    const url = `${this.client.baseUrl}/api/clusters?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Cluster[]>(response);
  }

  async getCluster(id: string): Promise<Cluster> {
    const url = `${this.client.baseUrl}/api/clusters/${id}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Cluster>(response);
  }

  async createCluster(input: ClusterCreateInput): Promise<Cluster> {
    const url = `${this.client.baseUrl}/api/clusters`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return this.handleResponse<Cluster>(response);
  }

  async updateCluster(id: string, input: ClusterUpdateInput): Promise<Cluster> {
    const url = `${this.client.baseUrl}/api/clusters/${id}`;
    const response = await this.fetchWithAuth(url, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return this.handleResponse<Cluster>(response);
  }

  async deleteCluster(id: string): Promise<void> {
    const url = `${this.client.baseUrl}/api/clusters/${id}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    await this.handleResponse<void>(response);
  }

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
      firstName?: string;
      lastName?: string;
      email: string;
      eventCount: number;
      title: string;
      creatorDescription: string;
    };
  }> {
    const url = `${this.client.baseUrl}/api/events/cluster-hub`;
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
        firstName?: string;
        lastName?: string;
        email: string;
        eventCount: number;
        creatorDescription: string;
        title: string;
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
