import { BaseApiClient } from "./base/ApiClient";
import { GroupsModule } from "./modules/groups";
import {
  AuthTokens,
  User,
  ClientGroup,
  ClientGroupMembership,
  CreateGroupPayload,
  UpdateGroupPayload,
  ManageMembershipStatusPayload,
  UpdateMemberRolePayload,
  CursorPaginationParams,
  GetGroupMembersParams,
  GetGroupEventsParams,
} from "./base/types";
import { EventType } from "@/types/types";

// This class maintains backward compatibility with the old ApiClient interface
export class LegacyApiClient extends BaseApiClient {
  private groupsModule: GroupsModule;

  constructor(baseUrl: string = process.env.EXPO_PUBLIC_API_URL!) {
    super(baseUrl);
    this.groupsModule = new GroupsModule(baseUrl);
  }

  // --- START: Group API Methods ---
  // These methods delegate to the GroupsModule while maintaining the old interface

  async createGroup(payload: CreateGroupPayload): Promise<ClientGroup> {
    return this.groupsModule.createGroup(payload);
  }

  async getGroupById(groupId: string): Promise<ClientGroup> {
    return this.groupsModule.getGroupById(groupId);
  }

  async updateGroup(
    groupId: string,
    payload: UpdateGroupPayload,
  ): Promise<ClientGroup> {
    return this.groupsModule.updateGroup(groupId, payload);
  }

  async deleteGroup(groupId: string): Promise<{ message: string }> {
    return this.groupsModule.deleteGroup(groupId);
  }

  async listPublicGroups(params: CursorPaginationParams = {}): Promise<{
    groups: ClientGroup[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    return this.groupsModule.listPublicGroups(params);
  }

  async getUserGroups(params: CursorPaginationParams = {}): Promise<{
    groups: ClientGroup[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    return this.groupsModule.getUserGroups(params);
  }

  async getGroupMembers(
    groupId: string,
    params: GetGroupMembersParams = {},
  ): Promise<{
    members: ClientGroupMembership[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    return this.groupsModule.getGroupMembers(groupId, params);
  }

  async searchGroups(
    query: string,
    params: CursorPaginationParams & { categoryId?: string } = {},
  ): Promise<{
    groups: ClientGroup[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    return this.groupsModule.searchGroups(query, params);
  }

  async joinGroup(groupId: string): Promise<{
    message: string;
    membershipStatus: "PENDING" | "APPROVED" | "REJECTED" | "BANNED";
    role: "MEMBER" | "ADMIN";
  }> {
    return this.groupsModule.joinGroup(groupId);
  }

  async leaveGroup(groupId: string): Promise<{ message: string }> {
    return this.groupsModule.leaveGroup(groupId);
  }

  async manageMembershipStatus(
    groupId: string,
    memberUserId: string,
    payload: ManageMembershipStatusPayload,
  ): Promise<{ message: string; membership: ClientGroupMembership }> {
    return this.groupsModule.manageMembershipStatus(
      groupId,
      memberUserId,
      payload,
    );
  }

  async updateMemberRole(
    groupId: string,
    memberUserId: string,
    payload: UpdateMemberRolePayload,
  ): Promise<{ message: string; membership: ClientGroupMembership }> {
    return this.groupsModule.updateMemberRole(groupId, memberUserId, payload);
  }

  async removeMember(
    groupId: string,
    memberUserId: string,
  ): Promise<{ message: string }> {
    return this.groupsModule.removeMember(groupId, memberUserId);
  }

  async getGroupEvents(
    groupId: string,
    params: GetGroupEventsParams = {},
  ): Promise<{
    events: EventType[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    return this.groupsModule.getGroupEvents(groupId, params);
  }

  // --- END: Group API Methods ---

  // TODO: Add other module delegations as they are created
  // For now, we'll keep the original methods for non-group functionality
  // These will be gradually replaced as we create more modules

  // Example of a method that hasn't been modularized yet:
  async login(email: string, password: string): Promise<User> {
    const url = `${this.baseUrl}/api/auth/login`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await this.handleResponse<{
        user: User;
        tokens: AuthTokens;
      }>(response);

      if (!data.user) {
        throw new Error("User data missing from login response");
      }

      if (!data.tokens.accessToken) {
        throw new Error("Access token missing from login response");
      }

      await this.saveAuthState(data.user, data.tokens);
      return data.user;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  // ... other methods that haven't been modularized yet ...
}

// Export as singleton to maintain the same usage pattern
export const apiClient = new LegacyApiClient();
export default apiClient;
