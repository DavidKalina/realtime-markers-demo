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
}

export interface GetEventsParams {
  cursor?: string;
  limit?: number;
  direction?: "forward" | "backward";
  query?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  _t?: number; // Cache-busting timestamp
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

// Notification types
export interface NotificationData {
  eventId?: string;
  eventTitle?: string;
  friendId?: string;
  friendName?: string;
  level?: number;
  achievementId?: string;
  achievementName?: string;
  role?: string;
  timestamp?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface Notification {
  id: string;
  userId: string;
  type:
    | "EVENT_CREATED"
    | "EVENT_UPDATED"
    | "EVENT_DELETED"
    | "FRIEND_REQUEST"
    | "FRIEND_ACCEPTED"
    | "LEVEL_UP"
    | "ACHIEVEMENT_UNLOCKED"
    | "SYSTEM";
  title: string;
  message: string;
  data?: NotificationData;
  createdAt: string;
  read: boolean;
  readAt?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  actionUrl?: string;
  actionText?: string;
  icon?: string;
  category?: string;
}

export interface NotificationOptions {
  skip?: number;
  take?: number;
  read?: boolean;
  type?: NotificationType;
}

export type NotificationType =
  | "EVENT_CREATED"
  | "EVENT_UPDATED"
  | "EVENT_DELETED"
  | "FRIEND_REQUEST"
  | "FRIEND_ACCEPTED"
  | "LEVEL_UP"
  | "ACHIEVEMENT_UNLOCKED"
  | "SYSTEM";

export interface NotificationCounts {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
}

// Filter types
export interface Filter {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  semanticQuery?: string; // Natural language query
  emoji?: string; // AI-generated emoji for the filter
  criteria: {
    dateRange?: {
      start?: string;
      end?: string;
    };
    status?: string[];
    location?: {
      latitude?: number;
      longitude?: number;
      radius?: number; // in meters
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface FilterOptions {
  isActive?: boolean;
  semanticQuery?: string;
  emoji?: string;
  criteria?: {
    dateRange?: {
      start?: string;
      end?: string;
    };
    status?: string[];
    location?: {
      latitude?: number;
      longitude?: number;
      radius?: number; // in meters
    };
  };
}

// Event types
export interface EventType {
  id: string;
  title: string;
  description?: string;
  eventDate: string;
  endDate?: string;
  time: string;
  coordinates: [number, number];
  location: string;
  locationNotes?: string;
  distance?: string;
  emoji?: string;
  emojiDescription?: string;
  categories: string[];
  creator?: {
    id: string;
    displayName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    isVerified: boolean;
  };
  creatorId?: string;
  scanCount: number;
  saveCount: number;
  timezone: string;
  qrUrl?: string | null;
  qrCodeData?: string;
  qrImagePath?: string | null;
  hasQrCode?: boolean;
  qrGeneratedAt?: string | null;
  qrDetectedInImage?: boolean;
  isPrivate?: boolean;
  detectedQrData?: string | null;
  createdAt: string;
  updatedAt: string;
  sharedWithIds: string[];
  savedBy?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  }[];
}

/**
 * Category entity type
 */
export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}
