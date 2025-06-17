import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";
import { Friend, FriendRequest, FriendRequestCreateInput } from "../base/types";
import { apiClient } from "../../ApiClient";

// Extended type for friend requests with user details
interface FriendRequestWithUsers extends FriendRequest {
  requester?: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
  addressee?: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
}

export class FriendsModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  /**
   * Get all friends of the current user
   */
  async getFriends(): Promise<Friend[]> {
    const url = `${this.client.baseUrl}/api/friendships`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Friend[]>(response);
  }

  /**
   * Get a specific friend by ID
   */
  async getFriend(id: string): Promise<Friend> {
    const url = `${this.client.baseUrl}/api/friendships/${id}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Friend>(response);
  }

  /**
   * Get all friend requests received by the current user
   */
  async getFriendRequests(): Promise<FriendRequest[]> {
    const url = `${this.client.baseUrl}/api/friendships/requests`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<FriendRequest[]>(response);
  }

  /**
   * Get pending friend requests received by the current user
   */
  async getPendingFriendRequests(): Promise<FriendRequestWithUsers[]> {
    const url = `${this.client.baseUrl}/api/friendships/requests/pending`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<FriendRequestWithUsers[]>(response);
  }

  /**
   * Get outgoing friend requests sent by the current user
   */
  async getOutgoingFriendRequests(): Promise<FriendRequestWithUsers[]> {
    const url = `${this.client.baseUrl}/api/friendships/requests/outgoing`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<FriendRequestWithUsers[]>(response);
  }

  /**
   * Send a friend request to another user
   */
  async sendFriendRequest(
    input: FriendRequestCreateInput,
  ): Promise<FriendRequest> {
    const url = `${this.client.baseUrl}/api/friendships/requests`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return this.handleResponse<FriendRequest>(response);
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(id: string): Promise<Friend> {
    const url = `${this.client.baseUrl}/api/friendships/requests/${id}/accept`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    return this.handleResponse<Friend>(response);
  }

  /**
   * Reject a friend request
   */
  async rejectFriendRequest(id: string): Promise<void> {
    const url = `${this.client.baseUrl}/api/friendships/requests/${id}/reject`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    await this.handleResponse<void>(response);
  }

  /**
   * Cancel an outgoing friend request
   */
  async cancelFriendRequest(id: string): Promise<void> {
    const url = `${this.client.baseUrl}/api/friendships/requests/${id}/cancel`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    await this.handleResponse<void>(response);
  }

  /**
   * Remove a friend
   */
  async removeFriend(id: string): Promise<void> {
    const url = `${this.client.baseUrl}/api/friendships/${id}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    await this.handleResponse<void>(response);
  }

  /**
   * Search for friends based on a query
   */
  async searchFriends(query: string): Promise<Friend[]> {
    const url = `${this.client.baseUrl}/api/friendships/search?query=${encodeURIComponent(query)}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Friend[]>(response);
  }

  /**
   * Send a friend request by username
   */
  async sendFriendRequestByUsername(username: string): Promise<void> {
    const url = `${this.client.baseUrl}/api/friendships/requests/by-username`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ username }),
    });
    await this.handleResponse<void>(response);
  }
}

// Export as singleton using the main ApiClient instance
export const friendsModule = new FriendsModule(apiClient);
export default friendsModule;
