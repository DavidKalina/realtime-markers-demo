import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";

export interface FollowResponse {
  following: boolean;
  followerCount: number;
  followingCount: number;
}

export interface FollowedUser {
  id: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  currentTier?: string;
  totalXp?: number;
  discoveryCount?: number;
}

export interface GetFollowingResponse {
  users: FollowedUser[];
  nextCursor?: string;
}

export class FollowsModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async toggleFollow(userId: string): Promise<FollowResponse> {
    const url = `${this.client.baseUrl}/api/users/${userId}/follow`;
    const response = await this.fetchWithAuth(url, { method: "POST" });
    return this.handleResponse<FollowResponse>(response);
  }

  async isFollowing(userId: string): Promise<{ following: boolean }> {
    const url = `${this.client.baseUrl}/api/users/${userId}/is-following`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{ following: boolean }>(response);
  }

  async getFollowing(
    userId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<GetFollowingResponse> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.cursor) params.set("cursor", options.cursor);
    const qs = params.toString();
    const url = `${this.client.baseUrl}/api/users/${userId}/following${qs ? `?${qs}` : ""}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<GetFollowingResponse>(response);
  }
}
