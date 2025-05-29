import { BaseApiClient } from "../base/ApiClient";
import {
  ApiGroup,
  ApiGroupMember,
  ClientGroup,
  ClientGroupMembership,
  CreateGroupPayload,
  GetGroupEventsParams,
  GetGroupMembersParams,
  ManageMembershipStatusPayload,
  UpdateGroupPayload,
  UpdateMemberRolePayload,
  GroupVisibility,
} from "../base/types";
import { EventType } from "@/types/types";

// Add headquarters type
interface Headquarters {
  placeId: string;
  name: string;
  address: string;
  coordinates: [number, number];
}

// Extend the imported ApiGroup type
declare module "../base/types" {
  interface ApiGroup {
    headquartersPlaceId?: string;
    headquartersName?: string;
    headquartersAddress?: string;
    headquartersLocation?: { type: string; coordinates: [number, number] };
  }

  interface ClientGroup {
    headquarters?: Headquarters;
  }
}

// Add ApiEvent interface to match the backend response
interface ApiEvent {
  id: string;
  title: string;
  description?: string;
  eventDate: string;
  endDate?: string;
  location: { type: string; coordinates: [number, number] };
  address?: string;
  locationNotes?: string;
  categories?: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
  emoji?: string;
  emojiDescription?: string;
  creator?: {
    id: string;
    displayName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    isVerified: boolean;
  };
  creatorId?: string;
  scanCount?: number;
  saveCount?: number;
  timezone?: string;
  qrUrl?: string | null;
  qrCodeData?: string;
  qrImagePath?: string | null;
  hasQrCode?: boolean;
  qrGeneratedAt?: string | null;
  qrDetectedInImage?: boolean;
  detectedQrData?: string | null;
  isPrivate?: boolean;
  shares?: { sharedWithId: string; sharedById: string }[];
  groupId?: string | null;
  group?: ClientGroup | null;
}

interface RecentGroupsParams {
  cursor?: string;
  limit?: number;
  direction?: "forward" | "backward";
  categoryId?: string;
  minMemberCount?: number;
  maxDistance?: number;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface NearbyGroupsParams {
  cursor?: string;
  limit?: number;
  direction?: "forward" | "backward";
  categoryId?: string;
  minMemberCount?: number;
  maxDistance?: number;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export class GroupsModule extends BaseApiClient {
  private mapGroupToClientGroup(group: ApiGroup): ClientGroup {
    return {
      id: group.id,
      name: group.name,
      description: group.description || "",
      emoji: group.emoji,
      visibility: group.visibility as GroupVisibility,
      address: group.address,
      memberCount: group.memberCount,
      ownerId: group.ownerId,
      allowMemberEventCreation: group.allowMemberEventCreation,
      categories: group.categories,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      headquarters: group.headquartersPlaceId
        ? {
            placeId: group.headquartersPlaceId,
            name: group.headquartersName || "",
            address: group.headquartersAddress || "",
            coordinates: group.headquartersLocation?.coordinates || [0, 0],
          }
        : undefined,
    };
  }

  async createGroup(payload: CreateGroupPayload): Promise<ClientGroup> {
    const url = `${this.baseUrl}/api/groups/create`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return this.handleResponse<ClientGroup>(response);
  }

  async getGroupById(groupId: string): Promise<ClientGroup> {
    const url = `${this.baseUrl}/api/groups/${groupId}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<ClientGroup>(response);
  }

  async updateGroup(
    groupId: string,
    payload: UpdateGroupPayload,
  ): Promise<ClientGroup> {
    const url = `${this.baseUrl}/api/groups/${groupId}`;
    const response = await this.fetchWithAuth(url, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return this.handleResponse<ClientGroup>(response);
  }

  async deleteGroup(groupId: string): Promise<{ message: string }> {
    const url = `${this.baseUrl}/api/groups/${groupId}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    return this.handleResponse<{ message: string }>(response);
  }

  async listPublicGroups(
    params: {
      cursor?: string;
      limit?: number;
      direction?: "forward" | "backward";
    } = {},
  ): Promise<{
    groups: ClientGroup[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.direction) queryParams.append("direction", params.direction);

    const response = await this.fetchWithAuth(
      `${this.baseUrl}/api/groups?${queryParams.toString()}`,
    );
    const data = await this.handleResponse<{
      groups: ApiGroup[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      groups: data.groups.map(this.mapGroupToClientGroup),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }

  async getUserGroups(
    params: {
      cursor?: string;
      limit?: number;
      direction?: "forward" | "backward";
    } = {},
  ): Promise<{
    groups: ClientGroup[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.direction) queryParams.append("direction", params.direction);

    const response = await this.fetchWithAuth(
      `${this.baseUrl}/api/groups/user/me?${queryParams.toString()}`,
    );
    const data = await this.handleResponse<{
      groups: ApiGroup[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      groups: data.groups.map(this.mapGroupToClientGroup),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }

  async getGroupMembers(
    groupId: string,
    params: GetGroupMembersParams = {},
  ): Promise<{
    members: ClientGroupMembership[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.direction) queryParams.append("direction", params.direction);
    if (params.status) queryParams.append("status", params.status);

    const url = `${this.baseUrl}/api/groups/${groupId}/members?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{
      members: ApiGroupMember[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);
  }

  async searchGroups(
    query: string,
    params: {
      cursor?: string;
      limit?: number;
      direction?: "forward" | "backward";
      categoryId?: string;
    } = {},
  ): Promise<{
    groups: ClientGroup[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams({ query });
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.direction) queryParams.append("direction", params.direction);
    if (params.categoryId) queryParams.append("categoryId", params.categoryId);

    const response = await this.fetchWithAuth(
      `${this.baseUrl}/api/groups/search?${queryParams.toString()}`,
    );
    const data = await this.handleResponse<{
      groups: ApiGroup[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      groups: data.groups.map(this.mapGroupToClientGroup),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }

  async joinGroup(groupId: string): Promise<{
    message: string;
    membershipStatus: "PENDING" | "APPROVED" | "REJECTED" | "BANNED";
    role: "MEMBER" | "ADMIN";
  }> {
    const url = `${this.baseUrl}/api/groups/${groupId}/join`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    return this.handleResponse<{
      message: string;
      membershipStatus: "PENDING" | "APPROVED" | "REJECTED" | "BANNED";
      role: "MEMBER" | "ADMIN";
    }>(response);
  }

  async leaveGroup(groupId: string): Promise<{ message: string }> {
    const url = `${this.baseUrl}/api/groups/${groupId}/leave`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    return this.handleResponse<{ message: string }>(response);
  }

  async manageMembershipStatus(
    groupId: string,
    memberUserId: string,
    payload: ManageMembershipStatusPayload,
  ): Promise<{ message: string; membership: ClientGroupMembership }> {
    const url = `${this.baseUrl}/api/groups/${groupId}/members/${memberUserId}/status`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return this.handleResponse<{
      message: string;
      membership: ClientGroupMembership;
    }>(response);
  }

  async updateMemberRole(
    groupId: string,
    memberUserId: string,
    payload: UpdateMemberRolePayload,
  ): Promise<{ message: string; membership: ClientGroupMembership }> {
    const url = `${this.baseUrl}/api/groups/${groupId}/members/${memberUserId}/role`;
    const response = await this.fetchWithAuth(url, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return this.handleResponse<{
      message: string;
      membership: ClientGroupMembership;
    }>(response);
  }

  async removeMember(
    groupId: string,
    memberUserId: string,
  ): Promise<{ message: string }> {
    const url = `${this.baseUrl}/api/groups/${groupId}/members/${memberUserId}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    return this.handleResponse<{ message: string }>(response);
  }

  async getGroupEvents(
    groupId: string,
    params: GetGroupEventsParams = {},
  ): Promise<{
    events: EventType[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.direction) queryParams.append("direction", params.direction);
    if (params.query) queryParams.append("query", params.query);
    if (params.categoryId) queryParams.append("categoryId", params.categoryId);
    if (params.startDate) queryParams.append("startDate", params.startDate);
    if (params.endDate) queryParams.append("endDate", params.endDate);

    const url = `${this.baseUrl}/api/groups/${groupId}/events?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    // Map ApiEvent to EventType
    const mappedEvents: EventType[] = data.events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description || "",
      eventDate: event.eventDate,
      endDate: event.endDate,
      time: new Date(event.eventDate).toLocaleTimeString(),
      coordinates: event.location.coordinates,
      location: event.address || "",
      locationNotes: event.locationNotes || "",
      distance: "",
      emoji: event.emoji || "📍",
      emojiDescription: event.emojiDescription,
      categories: event.categories?.map((c) => c.name) || [],
      creator: event.creator,
      creatorId: event.creatorId,
      scanCount: event.scanCount || 0,
      saveCount: event.saveCount || 0,
      timezone: event.timezone || "UTC",
      qrUrl: event.qrUrl,
      qrCodeData: event.qrCodeData,
      qrImagePath: event.qrImagePath,
      hasQrCode: event.hasQrCode,
      qrGeneratedAt: event.qrGeneratedAt,
      qrDetectedInImage: event.qrDetectedInImage,
      isPrivate: event.isPrivate,
      detectedQrData: event.detectedQrData,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      sharedWithIds: event.shares?.map((share) => share.sharedWithId) || [],
      groupId: event.groupId,
      group: event.group,
    }));

    return {
      events: mappedEvents,
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }

  async recentGroups(params: RecentGroupsParams = {}): Promise<{
    groups: ClientGroup[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.direction) queryParams.append("direction", params.direction);
    if (params.categoryId) queryParams.append("categoryId", params.categoryId);
    if (params.minMemberCount)
      queryParams.append("minMemberCount", params.minMemberCount.toString());
    if (params.maxDistance)
      queryParams.append("maxDistance", params.maxDistance.toString());
    if (params.coordinates) {
      queryParams.append("lat", params.coordinates.lat.toString());
      queryParams.append("lng", params.coordinates.lng.toString());
    }

    const response = await this.fetchWithAuth(
      `${this.baseUrl}/api/groups/recent?${queryParams.toString()}`,
    );
    const data = await this.handleResponse<{
      groups: ApiGroup[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      groups: data.groups.map(this.mapGroupToClientGroup),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }

  async nearbyGroups(params: NearbyGroupsParams): Promise<{
    groups: ClientGroup[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams();

    if (params.cursor) {
      queryParams.append("cursor", params.cursor);
    }
    if (params.limit) {
      queryParams.append("limit", params.limit.toString());
    }
    if (params.direction) {
      queryParams.append("direction", params.direction);
    }
    if (params.categoryId) {
      queryParams.append("categoryId", params.categoryId);
    }
    if (params.minMemberCount) {
      queryParams.append("minMemberCount", params.minMemberCount.toString());
    }
    if (params.maxDistance) {
      queryParams.append("maxDistance", params.maxDistance.toString());
    }
    queryParams.append("lat", params.coordinates.lat.toString());
    queryParams.append("lng", params.coordinates.lng.toString());

    const response = await this.fetchWithAuth(
      `${this.baseUrl}/api/groups/nearby?${queryParams.toString()}`,
    );
    const data = await this.handleResponse<{
      groups: ApiGroup[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      groups: data.groups.map(this.mapGroupToClientGroup),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }
}

// Export as singleton
export const groupsModule = new GroupsModule();
