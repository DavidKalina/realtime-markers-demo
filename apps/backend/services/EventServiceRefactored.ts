import { DataSource } from "typeorm";
import {
  EventStatus,
  Filter,
  UserEventRsvp,
  RsvpStatus,
} from "@realtime-markers/database";
import type {
  EventUpdate,
  EventSummary,
  EventDetails,
  CategorySummary,
} from "@realtime-markers/database";
import type { EventLifecycleService } from "./EventLifecycleService";
import { createEventLifecycleService } from "./EventLifecycleService";
import type { EventSearchService } from "./EventSearchService";
import { createEventSearchService } from "./EventSearchService";
import type {
  UserEngagementService,
  EventEngagementMetrics,
} from "./UserEngagementService";
import { createUserEngagementService } from "./UserEngagementService";
import type { EventAdminService } from "./EventAdminService";
import { createEventAdminService } from "./EventAdminService";
import type { EventCacheService } from "./shared/EventCacheService";
import type { GoogleGeocodingService } from "./shared/GoogleGeocodingService";
import type { OpenAIService } from "./shared/OpenAIService";
import type { RedisService } from "./shared/RedisService";
import type { QueryAnalyticsService } from "./QueryAnalyticsService";
import { createQueryAnalyticsService } from "./QueryAnalyticsService";
import type { QueryInsights, QueryCluster } from "./QueryAnalyticsService";
import type { IEmbeddingService } from "./event-processing/interfaces/IEmbeddingService";
import type { CreateEventInput } from "../types/event";

// Replace SearchResult with EventSummary for better type safety
interface SearchResult {
  event: EventSummary;
  score: number;
}

export interface EventService {
  // Lifecycle operations
  cleanupOutdatedEvents(batchSize?: number): Promise<{
    deletedEvents: EventSummary[];
    deletedCount: number;
    hasMore: boolean;
  }>;

  getEvents(options?: {
    limit?: number;
    offset?: number;
    userId?: string;
  }): Promise<EventSummary[]>;

  getEventById(id: string): Promise<EventDetails | null>;

  getNearbyEvents(
    lat: number,
    lng: number,
    radius?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<EventSummary[]>;

  storeDetectedQRCode(
    eventId: string,
    qrCodeData: string,
  ): Promise<EventDetails | null>;

  createEvent(input: CreateEventInput): Promise<EventDetails>;

  updateEvent(id: string, eventData: EventUpdate): Promise<EventDetails | null>;

  deleteEvent(id: string): Promise<boolean>;

  updateEventStatus(
    id: string,
    status: EventStatus,
  ): Promise<EventDetails | null>;

  // Search operations
  searchEvents(
    query: string,
    limit?: number,
    cursor?: string,
  ): Promise<{ results: SearchResult[]; nextCursor?: string }>;

  getEventsByCategories(
    categoryIds: string[],
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ events: EventSummary[]; total: number; hasMore: boolean }>;

  getAllCategories(): Promise<CategorySummary[]>;

  searchEventsByFilter(
    filter: Filter,
    options?: { limit?: number; offset?: number },
  ): Promise<{ events: EventSummary[]; total: number; hasMore: boolean }>;

  getEventsByCategory(
    categoryId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ events: EventSummary[]; nextCursor?: string }>;

  getLandingPageData(options?: {
    featuredLimit?: number;
    upcomingLimit?: number;
    communityLimit?: number;
    userLat?: number;
    userLng?: number;
  }): Promise<{
    featuredEvents: EventSummary[];
    upcomingEvents: EventSummary[];
    communityEvents: EventSummary[];
    popularCategories: CategorySummary[];
  }>;

  // User engagement operations
  toggleSaveEvent(
    userId: string,
    eventId: string,
  ): Promise<{ saved: boolean; saveCount: number }>;

  isEventSavedByUser(userId: string, eventId: string): Promise<boolean>;

  getSavedEventsByUser(
    userId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ events: EventSummary[]; nextCursor?: string }>;

  toggleRsvpEvent(
    userId: string,
    eventId: string,
    status: RsvpStatus,
  ): Promise<{
    status: RsvpStatus;
    goingCount: number;
    notGoingCount: number;
  }>;

  getUserRsvpStatus(
    userId: string,
    eventId: string,
  ): Promise<UserEventRsvp | null>;

  createDiscoveryRecord(userId: string, eventId: string): Promise<void>;

  createViewRecord(userId: string, eventId: string): Promise<void>;

  getDiscoveredEventsByUser(
    userId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ events: EventSummary[]; nextCursor?: string }>;

  getEventEngagement(eventId: string): Promise<EventEngagementMetrics>;

  // Admin operations
  recalculateCounts(): Promise<{ eventsUpdated: number; usersUpdated: number }>;

  // Add analytics methods to the interface
  getQueryInsights(options?: {
    days?: number;
    limit?: number;
    minSearches?: number;
    similarityThreshold?: number;
  }): Promise<QueryInsights>;

  getPopularQueries(limit?: number): Promise<
    Array<{
      query: string;
      totalSearches: number;
      hitRate: number;
      averageResults: number;
    }>
  >;

  getLowHitRateQueries(limit?: number): Promise<
    Array<{
      query: string;
      totalSearches: number;
      hitRate: number;
      lastSearched: Date;
    }>
  >;

  getZeroResultQueries(limit?: number): Promise<
    Array<{
      query: string;
      searchCount: number;
      lastSearched: Date;
    }>
  >;

  getQueryStats(query: string): Promise<{
    totalSearches: number;
    totalHits: number;
    hitRate: number;
    averageResults: number;
    firstSearched: Date | null;
    lastSearched: Date | null;
    topResults: string[];
    searchCategories: string[];
  } | null>;

  getQueryClusters(similarityThreshold?: number): Promise<QueryCluster[]>;

  findSimilarQueries(
    query: string,
    limit?: number,
    similarityThreshold?: number,
  ): Promise<
    Array<{
      query: string;
      similarity: number;
      totalSearches: number;
      hitRate: number;
    }>
  >;

  updateQueryFlags(): Promise<{
    popularQueriesUpdated: number;
    attentionQueriesUpdated: number;
  }>;
}

// Define dependencies interface for cleaner constructor
export interface EventServiceDependencies {
  dataSource: DataSource;
  redisService: RedisService;
  locationService: GoogleGeocodingService;
  eventCacheService: EventCacheService;
  openaiService: OpenAIService;
  embeddingService: IEmbeddingService;
}

export class EventServiceRefactored implements EventService {
  private lifecycleService: EventLifecycleService;
  private searchService: EventSearchService;
  private engagementService: UserEngagementService;
  private adminService: EventAdminService;
  private queryAnalyticsService: QueryAnalyticsService;

  constructor(private dependencies: EventServiceDependencies) {
    // Initialize the query analytics service first
    this.queryAnalyticsService = createQueryAnalyticsService({
      dataSource: dependencies.dataSource,
      embeddingService: dependencies.embeddingService,
    });

    // Initialize all the smaller services
    this.lifecycleService = createEventLifecycleService({
      dataSource: dependencies.dataSource,
      eventCacheService: dependencies.eventCacheService,
      locationService: dependencies.locationService,
      redisService: dependencies.redisService,
    });

    this.searchService = createEventSearchService({
      dataSource: dependencies.dataSource,
      eventCacheService: dependencies.eventCacheService,
      openaiService: dependencies.openaiService,
      queryAnalyticsService: this.queryAnalyticsService,
    });

    this.engagementService = createUserEngagementService({
      dataSource: dependencies.dataSource,
      redisService: dependencies.redisService,
    });

    this.adminService = createEventAdminService({
      dataSource: dependencies.dataSource,
      eventCacheService: dependencies.eventCacheService,
      redisService: dependencies.redisService,
    });
  }

  // Lifecycle operations - delegate to EventLifecycleService
  async cleanupOutdatedEvents(batchSize = 100) {
    return this.adminService.cleanupOutdatedEvents(batchSize);
  }

  async getEvents(options = {}) {
    return this.adminService.getEvents(options);
  }

  async getEventById(id: string) {
    return this.lifecycleService.getEventById(id);
  }

  async getNearbyEvents(
    lat: number,
    lng: number,
    radius = 5000,
    startDate?: Date,
    endDate?: Date,
  ) {
    return this.searchService.getNearbyEvents(
      lat,
      lng,
      radius,
      startDate,
      endDate,
    );
  }

  async storeDetectedQRCode(eventId: string, qrCodeData: string) {
    return this.lifecycleService.storeDetectedQRCode(eventId, qrCodeData);
  }

  async createEvent(input: CreateEventInput) {
    return this.lifecycleService.createEvent(input);
  }

  async updateEvent(id: string, eventData: EventUpdate) {
    return this.lifecycleService.updateEvent(id, eventData);
  }

  async deleteEvent(id: string) {
    return this.lifecycleService.deleteEvent(id);
  }

  async updateEventStatus(id: string, status: EventStatus) {
    return this.lifecycleService.updateEventStatus(id, status);
  }

  // Search operations - delegate to EventSearchService
  async searchEvents(query: string, limit = 10, cursor?: string) {
    return this.searchService.searchEvents(query, limit, cursor);
  }

  async getEventsByCategories(categoryIds: string[], options = {}) {
    return this.searchService.getEventsByCategories(categoryIds, options);
  }

  async getAllCategories() {
    return this.adminService.getAllCategories();
  }

  async searchEventsByFilter(filter: Filter, options = {}) {
    return this.searchService.searchEventsByFilter(filter, options);
  }

  async getEventsByCategory(categoryId: string, options = {}) {
    return this.searchService.getEventsByCategory(categoryId, options);
  }

  async getLandingPageData(options?: {
    featuredLimit?: number;
    upcomingLimit?: number;
    communityLimit?: number;
    userLat?: number;
    userLng?: number;
  }): Promise<{
    featuredEvents: EventSummary[];
    upcomingEvents: EventSummary[];
    communityEvents: EventSummary[];
    popularCategories: CategorySummary[];
  }> {
    return this.searchService.getLandingPageData(options);
  }

  // User engagement operations - delegate to UserEngagementService
  async toggleSaveEvent(userId: string, eventId: string) {
    return this.engagementService.toggleSaveEvent(userId, eventId);
  }

  async isEventSavedByUser(userId: string, eventId: string) {
    return this.engagementService.isEventSavedByUser(userId, eventId);
  }

  async getSavedEventsByUser(userId: string, options = {}) {
    return this.engagementService.getSavedEventsByUser(userId, options);
  }

  async toggleRsvpEvent(userId: string, eventId: string, status: RsvpStatus) {
    return this.engagementService.toggleRsvpEvent(userId, eventId, status);
  }

  async getUserRsvpStatus(userId: string, eventId: string) {
    return this.engagementService.getUserRsvpStatus(userId, eventId);
  }

  async createDiscoveryRecord(userId: string, eventId: string) {
    return this.engagementService.createDiscoveryRecord(userId, eventId);
  }

  async createViewRecord(userId: string, eventId: string) {
    return this.engagementService.createViewRecord(userId, eventId);
  }

  async getDiscoveredEventsByUser(userId: string, options = {}) {
    return this.engagementService.getDiscoveredEventsByUser(userId, options);
  }

  async getEventEngagement(eventId: string) {
    return this.engagementService.getEventEngagement(eventId);
  }

  // Admin operations - delegate to EventAdminService
  async recalculateCounts() {
    return this.adminService.recalculateCounts();
  }

  // Add analytics methods to the interface
  async getQueryInsights(options?: {
    days?: number;
    limit?: number;
    minSearches?: number;
    similarityThreshold?: number;
  }): Promise<QueryInsights> {
    return this.queryAnalyticsService.getQueryInsights(options);
  }

  async getPopularQueries(limit?: number) {
    return this.queryAnalyticsService.getPopularQueries(limit);
  }

  async getLowHitRateQueries(limit?: number) {
    return this.queryAnalyticsService.getLowHitRateQueries(limit);
  }

  async getZeroResultQueries(limit?: number) {
    return this.queryAnalyticsService.getZeroResultQueries(limit);
  }

  async getQueryStats(query: string) {
    return this.queryAnalyticsService.getQueryStats(query);
  }

  async getQueryClusters(similarityThreshold?: number) {
    return this.queryAnalyticsService.getQueryClusters(similarityThreshold);
  }

  async findSimilarQueries(
    query: string,
    limit?: number,
    similarityThreshold?: number,
  ) {
    return this.queryAnalyticsService.findSimilarQueries(
      query,
      limit,
      similarityThreshold,
    );
  }

  async updateQueryFlags() {
    return this.queryAnalyticsService.updateQueryFlags();
  }
}

/**
 * Factory function to create an EventService instance
 */
export function createEventService(
  dependencies: EventServiceDependencies,
): EventService {
  return new EventServiceRefactored(dependencies);
}
