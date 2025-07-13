// database/derived-types.ts
// Derived types from database entities using utility types

import { Event as EventEntity } from "@realtime-markers/database";
import { User as UserEntity } from "@realtime-markers/database";
import { Category as CategoryEntity } from "@realtime-markers/database";
import { CivicEngagement as CivicEngagementEntity } from "@realtime-markers/database";
import { QueryAnalytics as QueryAnalyticsEntity } from "@realtime-markers/database";
import {
  EventShare as EventShareEntity,
  Filter as FilterEntity,
  UserEventView as UserEventViewEntity,
  UserEventDiscovery as UserEventDiscoveryEntity,
  UserEventRsvp as UserEventRsvpEntity,
  UserEventSave as UserEventSaveEntity,
  UserPushToken as UserPushTokenEntity,
} from "@realtime-markers/database";

// The full Event instance type (includes all properties, including relations)
export type Event = InstanceType<typeof EventEntity>;

// API-safe Event type (omit relations and internal fields)
export type EventResponse = Omit<
  Event,
  | "categories"
  | "creator"
  | "discoveries"
  | "saves"
  | "views"
  | "shares"
  | "rsvps"
  | "createdAt"
  | "updatedAt"
> & {
  categories?: Array<string>; // category IDs or names
  creatorId?: string;
  createdAt: string;
  updatedAt: string;
};

// Event creation request type (fields required to create an event)
export type CreateEventRequest = Pick<
  Event,
  | "title"
  | "description"
  | "eventDate"
  | "endDate"
  | "timezone"
  | "address"
  | "locationNotes"
  | "location"
  | "emoji"
  | "emojiDescription"
  | "isPrivate"
  | "isOfficial"
  | "isRecurring"
  | "recurrenceFrequency"
  | "recurrenceDays"
  | "recurrenceStartDate"
  | "recurrenceEndDate"
  | "recurrenceInterval"
  | "recurrenceTime"
  | "recurrenceExceptions"
> & {
  categoryIds?: string[];
};

// Event update request type (all fields optional)
export type UpdateEventRequest = Partial<CreateEventRequest> & { id: string };

// The full User instance type (includes all properties, including relations)
export type User = InstanceType<typeof UserEntity>;

// API-safe User type (omit sensitive and relation fields)
export type UserResponse = Omit<
  User,
  | "passwordHash"
  | "refreshToken"
  | "createdEvents"
  | "discoveries"
  | "savedEvents"
  | "viewedEvents"
  | "rsvps"
  | "pushTokens"
> & {
  createdAt: string;
  updatedAt: string;
};

// User creation request type (fields required to create a user)
export type CreateUserRequest = Pick<
  User,
  "email" | "firstName" | "lastName" | "phone" | "passwordHash"
>;

// User update request type (all fields optional except id)
export type UpdateUserRequest = Partial<
  Pick<User, "firstName" | "lastName" | "phone" | "avatarUrl" | "bio">
> & { id: string };

// The full Category instance type (includes all properties, including relations)
export type Category = InstanceType<typeof CategoryEntity>;

// API-safe Category type (omit relations)
export type CategoryResponse = Omit<Category, "events"> & {
  createdAt: string;
  updatedAt: string;
};

// Category creation request type (fields required to create a category)
export type CreateCategoryRequest = Pick<
  Category,
  "name" | "description" | "icon"
>;

// Category update request type (all fields optional except id)
export type UpdateCategoryRequest = Partial<
  Pick<Category, "name" | "description" | "icon">
> & { id: string };

// The full CivicEngagement instance type (includes all properties, including relations)
export type CivicEngagement = InstanceType<typeof CivicEngagementEntity>;

// API-safe CivicEngagement type (omit relations)
export type CivicEngagementResponse = Omit<CivicEngagement, "creator"> & {
  createdAt: string;
  updatedAt: string;
};

// CivicEngagement creation request type (fields required to create a civic engagement)
export type CreateCivicEngagementRequest = Pick<
  CivicEngagement,
  | "creatorId"
  | "title"
  | "description"
  | "type"
  | "location"
  | "address"
  | "locationNotes"
  | "imageUrls"
>;

// CivicEngagement update request type (all fields optional except id)
export type UpdateCivicEngagementRequest = Partial<
  Pick<
    CivicEngagement,
    | "title"
    | "description"
    | "type"
    | "status"
    | "location"
    | "address"
    | "locationNotes"
    | "imageUrls"
    | "adminNotes"
    | "implementedAt"
  >
> & { id: string };

// The full QueryAnalytics instance type (includes all properties)
export type QueryAnalytics = InstanceType<typeof QueryAnalyticsEntity>;

// API-safe QueryAnalytics type (dates as strings)
export type QueryAnalyticsResponse = Omit<
  QueryAnalytics,
  "createdAt" | "updatedAt" | "firstSearchedAt" | "lastSearchedAt"
> & {
  createdAt: string;
  updatedAt: string;
  firstSearchedAt: string | null;
  lastSearchedAt: string | null;
};

// QueryAnalytics creation request type (fields required to create a query analytics record)
export type CreateQueryAnalyticsRequest = Pick<
  QueryAnalytics,
  | "query"
  | "normalizedQuery"
  | "totalSearches"
  | "totalHits"
  | "zeroResultSearches"
  | "averageResultsPerSearch"
  | "hitRate"
  | "firstSearchedAt"
  | "lastSearchedAt"
  | "topResults"
  | "searchCategories"
  | "isPopular"
  | "needsAttention"
>;

// QueryAnalytics update request type (all fields optional except id)
export type UpdateQueryAnalyticsRequest = Partial<
  Pick<
    QueryAnalytics,
    | "query"
    | "normalizedQuery"
    | "totalSearches"
    | "totalHits"
    | "zeroResultSearches"
    | "averageResultsPerSearch"
    | "hitRate"
    | "firstSearchedAt"
    | "lastSearchedAt"
    | "topResults"
    | "searchCategories"
    | "isPopular"
    | "needsAttention"
  >
> & { id: string };

// EventShare
export type EventShare = InstanceType<typeof EventShareEntity>;
export type EventShareResponse = Omit<EventShare, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};
export type CreateEventShareRequest = Pick<
  EventShare,
  "eventId" | "sharedById" | "sharedWithId"
>;
export type UpdateEventShareRequest = Partial<CreateEventShareRequest> & {
  id: string;
};

// Filter
export type Filter = InstanceType<typeof FilterEntity>;
export type FilterResponse = Omit<Filter, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};
export type CreateFilterRequest = Pick<
  Filter,
  | "userId"
  | "name"
  | "isActive"
  | "criteria"
  | "semanticQuery"
  | "embedding"
  | "emoji"
>;
export type UpdateFilterRequest = Partial<CreateFilterRequest> & { id: string };

// UserEventView
export type UserEventView = InstanceType<typeof UserEventViewEntity>;
export type UserEventViewResponse = Omit<UserEventView, "viewedAt"> & {
  viewedAt: string;
};
export type CreateUserEventViewRequest = Pick<
  UserEventView,
  "userId" | "eventId"
>;
export type UpdateUserEventViewRequest = Partial<CreateUserEventViewRequest> & {
  id: string;
};

// UserEventDiscovery
export type UserEventDiscovery = InstanceType<typeof UserEventDiscoveryEntity>;
export type UserEventDiscoveryResponse = Omit<
  UserEventDiscovery,
  "discoveredAt"
> & {
  discoveredAt: string;
};
export type CreateUserEventDiscoveryRequest = Pick<
  UserEventDiscovery,
  "userId" | "eventId"
>;
export type UpdateUserEventDiscoveryRequest =
  Partial<CreateUserEventDiscoveryRequest> & { id: string };

// UserEventRsvp
export type UserEventRsvp = InstanceType<typeof UserEventRsvpEntity>;
export type UserEventRsvpResponse = Omit<
  UserEventRsvp,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};
export type CreateUserEventRsvpRequest = Pick<
  UserEventRsvp,
  "userId" | "eventId" | "status"
>;
export type UpdateUserEventRsvpRequest = Partial<CreateUserEventRsvpRequest> & {
  id: string;
};

// UserEventSave
export type UserEventSave = InstanceType<typeof UserEventSaveEntity>;
export type UserEventSaveResponse = Omit<UserEventSave, "savedAt"> & {
  savedAt: string;
};
export type CreateUserEventSaveRequest = Pick<
  UserEventSave,
  "userId" | "eventId"
>;
export type UpdateUserEventSaveRequest = Partial<CreateUserEventSaveRequest> & {
  id: string;
};

// UserPushToken
export type UserPushToken = InstanceType<typeof UserPushTokenEntity>;
export type UserPushTokenResponse = Omit<UserPushToken, "lastUsedAt"> & {
  lastUsedAt?: string;
};
export type CreateUserPushTokenRequest = Pick<
  UserPushToken,
  "userId" | "token" | "isActive" | "deviceInfo"
>;
export type UpdateUserPushTokenRequest = Partial<CreateUserPushTokenRequest> & {
  id: string;
};
