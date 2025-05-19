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

// Event-related types
export interface ApiEvent {
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

export interface GetEventsParams {
  cursor?: string;
  limit?: number;
  direction?: "forward" | "backward";
  query?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreateEventPayload {
  title: string;
  description?: string;
  eventDate: string;
  endDate?: string;
  location: {
    type?: string;
    coordinates: [number, number];
  };
  address?: string;
  locationNotes?: string;
  categories?: { id: string; name: string }[];
  timezone?: string;
  emoji?: string;
  emojiDescription?: string;
  isPrivate?: boolean;
  sharedWithIds?: string[];
  userCoordinates?: {
    lat: number;
    lng: number;
  };
}

export interface UpdateEventPayload extends Partial<CreateEventPayload> {}

export interface JobStatus {
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  result?: unknown;
  error?: string;
}

export interface JobStreamMessage extends JobStatus {}

export interface ProcessEventImagePayload {
  imageFile: File;
  userLat: number;
  userLng: number;
  source: string;
}

export interface ClusterHubData {
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
}

// Friend-related types
export interface Friend {
  id: string;
  displayName?: string;
  email: string;
  avatarUrl?: string;
  friendCode?: string;
  username?: string;
  mutualFriendsCount?: number;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface FriendRequest {
  id: string;
  requester: Friend;
  addressee: Friend;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  updatedAt?: string;
}

export interface Contact {
  name?: string;
  email?: string;
  phone?: string;
  hasAccount?: boolean;
  userId?: string;
  avatarUrl?: string;
}
