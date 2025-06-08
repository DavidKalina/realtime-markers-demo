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
  // Recurring event fields
  isRecurring?: boolean;
  recurrenceFrequency?: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY";
  recurrenceDays?: (
    | "SUNDAY"
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY"
  )[];
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceInterval?: number;
  recurrenceTime?: string;
  recurrenceExceptions?: string[];
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
  eventDate?: string; // Optional for regular events
  date?: string; // Optional for private events
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
  // Recurring event fields
  isRecurring?: boolean;
  recurrenceFrequency?: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY";
  recurrenceDays?: (
    | "SUNDAY"
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY"
  )[];
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceInterval?: number;
  recurrenceTime?: string;
  recurrenceExceptions?: string[];
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
  userId: string;
  friendId: string;
  status: "ACCEPTED" | "PENDING" | "REJECTED";
  createdAt: string;
  updatedAt: string;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
}

export interface FriendRequestCreateInput {
  receiverId: string;
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
  friendId?: string;
  actionUrl?: string;
  actionText?: string;
  icon?: string;
  category?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  metadata?: Record<string, string | number | boolean>;
}

export interface Notification {
  id: string;
  userId: string;
  type: "FRIEND_REQUEST" | "EVENT_INVITE" | "EVENT_UPDATE" | "SYSTEM";
  title: string;
  message: string;
  data?: NotificationData;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationCreateInput {
  userId: string;
  type: "FRIEND_REQUEST" | "EVENT_INVITE" | "EVENT_UPDATE" | "SYSTEM";
  title: string;
  message: string;
  data?: NotificationData;
}

export interface NotificationUpdateInput {
  read?: boolean;
  data?: NotificationData;
}

export interface NotificationCounts {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

export interface NotificationOptions {
  limit?: number;
  offset?: number;
  type?: string;
  read?: boolean;
}

// Filter types
export interface Filter {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  categories?: string[];
  radius?: number;
  createdAt: string;
  updatedAt: string;
  createdById: string;
}

export interface FilterCreateInput {
  name: string;
  description?: string;
  emoji?: string;
  categories?: string[];
  radius?: number;
}

export interface FilterUpdateInput {
  name?: string;
  description?: string;
  emoji?: string;
  categories?: string[];
  radius?: number;
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
  emoji?: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryCreateInput {
  name: string;
  description?: string;
  emoji?: string;
  parentId?: string;
}

export interface CategoryUpdateInput {
  name?: string;
  description?: string;
  emoji?: string;
  parentId?: string;
}

export interface Cluster {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  radius: number;
  createdAt: string;
  updatedAt: string;
  createdById: string;
}

export interface ClusterCreateInput {
  name: string;
  description?: string;
  lat: number;
  lng: number;
  radius: number;
}

export interface ClusterUpdateInput {
  name?: string;
  description?: string;
  lat?: number;
  lng?: number;
  radius?: number;
}

export interface Place {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
}

export interface PlaceCreateInput {
  name: string;
  description?: string;
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface PlaceUpdateInput {
  name?: string;
  description?: string;
  lat?: number;
  lng?: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface RSVP {
  id: string;
  eventId: string;
  userId: string;
  status: "GOING" | "NOT_GOING" | "MAYBE" | "PENDING";
  createdAt: string;
  updatedAt: string;
}

export interface RSVPCreateInput {
  status: "GOING" | "NOT_GOING" | "MAYBE" | "PENDING";
}

export interface RSVPUpdateInput {
  status?: "GOING" | "NOT_GOING" | "MAYBE" | "PENDING";
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  type: "FREE" | "BASIC" | "PREMIUM" | "ENTERPRISE";
  price: number;
  currency: string;
  features: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlanCreateInput {
  name: string;
  description?: string;
  type: "FREE" | "BASIC" | "PREMIUM" | "ENTERPRISE";
  price: number;
  currency: string;
  features: string[];
}

export interface PlanUpdateInput {
  name?: string;
  description?: string;
  type?: "FREE" | "BASIC" | "PREMIUM" | "ENTERPRISE";
  price?: number;
  currency?: string;
  features?: string[];
}
