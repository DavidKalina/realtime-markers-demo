import { BaseApiClient } from "../base/ApiClient";
import { Friend, FriendRequest, Contact } from "../base/types";

export class FriendsModule extends BaseApiClient {
  /**
   * Get all friends of the current user
   */
  async getFriends(): Promise<Friend[]> {
    const url = `${this.baseUrl}/api/friendships`;
    console.log("Fetching friends from URL:", url);
    console.log(
      "Current auth token:",
      this.tokens?.accessToken ? "Present" : "Missing",
    );

    const response = await this.fetchWithAuth(url);
    console.log("Friends response status:", response.status);

    const data = await this.handleResponse<Friend[]>(response);
    console.log("Parsed friends data:", data);

    return data;
  }

  /**
   * Get pending friend requests received by the current user
   */
  async getPendingFriendRequests(): Promise<FriendRequest[]> {
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/api/friendships/requests/pending`,
    );
    return this.handleResponse<FriendRequest[]>(response);
  }

  /**
   * Get outgoing friend requests sent by the current user
   */
  async getOutgoingFriendRequests(): Promise<FriendRequest[]> {
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/api/friendships/requests/outgoing`,
    );
    return this.handleResponse<FriendRequest[]>(response);
  }

  /**
   * Update the user's contacts list
   */
  async updateContacts(contacts: Contact[]): Promise<void> {
    const url = `${this.baseUrl}/api/friendships/contacts`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ contacts }),
    });
    return this.handleResponse<void>(response);
  }

  /**
   * Find potential friends from the user's contacts
   */
  async findPotentialFriends(): Promise<Friend[]> {
    const url = `${this.baseUrl}/api/friendships/contacts/potential`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Friend[]>(response);
  }

  /**
   * Send a friend request to another user by their ID
   */
  async sendFriendRequest(addresseeId: string): Promise<FriendRequest> {
    const url = `${this.baseUrl}/api/friendships/requests`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ addresseeId }),
    });
    return this.handleResponse<FriendRequest>(response);
  }

  /**
   * Send a friend request using a friend code
   */
  async sendFriendRequestByCode(friendCode: string): Promise<FriendRequest> {
    const url = `${this.baseUrl}/api/friendships/requests/code`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ friendCode }),
    });
    return this.handleResponse<FriendRequest>(response);
  }

  /**
   * Send a friend request using a username
   */
  async sendFriendRequestByUsername(username: string): Promise<FriendRequest> {
    const url = `${this.baseUrl}/api/friendships/requests/username`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ username }),
    });
    return this.handleResponse<FriendRequest>(response);
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(requestId: string): Promise<FriendRequest> {
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/api/friendships/requests/${requestId}/accept`,
      {
        method: "POST",
      },
    );
    return this.handleResponse<FriendRequest>(response);
  }

  /**
   * Reject a friend request
   */
  async rejectFriendRequest(requestId: string): Promise<FriendRequest> {
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/api/friendships/requests/${requestId}/reject`,
      {
        method: "POST",
      },
    );
    return this.handleResponse<FriendRequest>(response);
  }

  /**
   * Cancel an outgoing friend request
   */
  async cancelFriendRequest(requestId: string): Promise<FriendRequest> {
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/api/friendships/requests/${requestId}/cancel`,
      {
        method: "POST",
      },
    );
    return this.handleResponse<FriendRequest>(response);
  }

  /**
   * Remove a friend
   */
  async removeFriend(friendId: string): Promise<{ message: string }> {
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/api/friendships/${friendId}`,
      {
        method: "DELETE",
      },
    );
    return this.handleResponse<{ message: string }>(response);
  }

  /**
   * Get friend suggestions based on mutual friends and interests
   */
  async getFriendSuggestions(limit: number = 10): Promise<Friend[]> {
    const url = `${this.baseUrl}/api/friendships/suggestions?limit=${limit}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Friend[]>(response);
  }

  /**
   * Get mutual friends between the current user and another user
   */
  async getMutualFriends(userId: string): Promise<Friend[]> {
    const url = `${this.baseUrl}/api/friendships/${userId}/mutual`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Friend[]>(response);
  }
}

// Export as singleton
export const friendsModule = new FriendsModule();
export default friendsModule;
