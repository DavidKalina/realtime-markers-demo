// Base API types
export interface Location {
  type: string;
  coordinates: [number, number]; // [longitude, latitude]
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  avatarUrl?: string;
  isVerified: boolean;
  bio?: string;
  createdAt?: Date;
  scanCount?: number;
  saveCount?: number;
  totalXp?: number;
  currentTitle?: string;
  level?: number;
  nextLevelXp?: number;
  xpProgress?: number;
  friendCode?: string;
  username?: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
  accessToken: string;
  refreshToken?: string;
}

// Pagination types
export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  direction?: "forward" | "backward";
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// Group types
export type GroupVisibility = "PUBLIC" | "PRIVATE";
export type GroupMemberRole = "MEMBER" | "ADMIN";
export type GroupMembershipStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "BANNED";

export interface ClientGroup {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  bannerImageUrl?: string;
  avatarImageUrl?: string;
  visibility: GroupVisibility;
  ownerId: string;
  owner?: User;
  location?: { type: "Point"; coordinates: [number, number] };
  address?: string;
  memberCount: number;
  allowMemberEventCreation: boolean;
  categories?: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface ClientGroupMembership {
  id: string;
  userId: string;
  groupId: string;
  user: User;
  group?: ClientGroup;
  role: GroupMemberRole;
  status: GroupMembershipStatus;
  joinedAt: string;
  updatedAt: string;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
  emoji?: string;
  bannerImageUrl?: string;
  avatarImageUrl?: string;
  visibility?: GroupVisibility;
  location?: { type: "Point"; coordinates: [number, number] };
  address?: string;
  allowMemberEventCreation?: boolean;
  categoryIds?: string[];
}

export interface UpdateGroupPayload {
  name?: string;
  description?: string;
  emoji?: string;
  bannerImageUrl?: string;
  avatarImageUrl?: string;
  visibility?: GroupVisibility;
  location?: { type: "Point"; coordinates: [number, number] };
  address?: string;
  allowMemberEventCreation?: boolean;
  categoryIds?: string[];
}

export interface ManageMembershipStatusPayload {
  status: "APPROVED" | "REJECTED" | "BANNED";
  role?: GroupMemberRole;
}

export interface UpdateMemberRolePayload {
  role: GroupMemberRole;
}

export interface GetGroupEventsParams extends CursorPaginationParams {
  query?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}

export interface GetGroupMembersParams extends CursorPaginationParams {
  status?: GroupMembershipStatus;
}

// API Group interfaces
export interface ApiGroup {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  visibility: "PUBLIC" | "PRIVATE";
  address?: string;
  memberCount: number;
  ownerId: string;
  allowMemberEventCreation: boolean;
  categories?: Array<{
    id: string;
    name: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ApiGroupMember {
  id: string;
  userId: string;
  groupId: string;
  role: "ADMIN" | "MEMBER";
  status: "PENDING" | "APPROVED" | "REJECTED" | "BANNED";
  joinedAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    role: "USER" | "ADMIN";
    isVerified: boolean;
  };
}
