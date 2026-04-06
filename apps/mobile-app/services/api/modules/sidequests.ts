import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";

export interface GoalRefinementState {
  rawGoal: string;
  turns: { question: string; answer: string }[];
  extractedSignals: {
    domain?: string;
    timeHorizon?: string;
    targetDate?: string;
    goalLocation?: string;
    currentBaseline?: string;
    successLooksLike?: string;
  };
}

export interface ObjectiveResponse {
  id: string;
  sortOrder: number;
  title: string;
  description?: string;
  emoji?: string;
  estimatedCost?: number;
  venueName?: string;
  venueAddress?: string;
  venueCategory?: string;
  latitude?: number;
  longitude?: number;
  hook?: string;
  checkedInAt?: string;
  entryLatitude?: number;
  entryLongitude?: number;
  entryPointName?: string;
  suggestedActivities?: string[];
  actionItems?: string[];
  completedActivity?: string;
  photoUrl?: string;
  journalPrompt?: string;
  journalEntry?: string;
  difficulty?: number;
  socialContext?: string;
  reflectionTags?: string[];
  reflectionDepth?: number;
  reflectionSentiment?: number;
}

export interface SidequestResponse {
  id: string;
  city: string;
  budgetMax: number;
  activityTypes: string[];
  prompt?: string;
  intention?: string;
  title?: string;
  summary?: string;
  status: "GENERATING" | "READY" | "FAILED";
  tier?: "QUICK" | "SWEET_SPOT" | "BEST";
  categories?: string[];
  objectives: ObjectiveResponse[];
  children?: SidequestResponse[];
  parentId?: string;
  rating?: number;
  ratingComment?: string;
  completedAt?: string;
  rarity?: string;
  prescribed?: boolean;
  distanceFromHome?: number;
  promotedAt?: string;
  createdAt: string;
  // Batch + pathway context
  batchId?: string;
  batchIndex?: number;
  pathwayTheme?: string;
  pathwayLabel?: string;
  pathwayPhase?: string;
  questRole?: string;
  isPublished?: boolean;
  timesAdopted?: number;
}

export interface BrowseSidequestResponse {
  id: string;
  title: string | null;
  summary: string | null;
  city: string;
  intention: string | null;
  durationHours?: number;
  rating: number | null;
  timesAdopted: number;
  itemCount?: number;
  objectiveCount?: number;
  creatorFirstName: string | null;
  completedAt: string;
  items: {
    emoji: string | null;
    title: string;
    venueName: string | null;
  }[];
  objectives?: {
    emoji: string | null;
    title: string;
    venueName: string | null;
  }[];
}

export interface ComfortZoneResponse {
  homeLatitude: number | null;
  homeLongitude: number | null;
  comfortRadiusMiles: number;
  pacePreference: string;
  hasHomeAnchor: boolean;
}

export interface WorldSizeResponse {
  areaSqMiles: number;
  totalLocations: number;
  furthestMiles: number;
  uniqueCategories: number;
}

export class SidequestsModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async list(
    limit = 20,
    cursor?: string,
    filters?: {
      sort?: string;
      intention?: string;
      status?: string;
    },
  ): Promise<{ data: SidequestResponse[]; nextCursor: string | null }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    if (filters?.sort) params.set("sort", filters.sort);
    if (filters?.intention) params.set("intention", filters.intention);
    if (filters?.status) params.set("status", filters.status);
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests?${params}`,
    );
    const json = await response.json();
    if (Array.isArray(json)) {
      return { data: json, nextCursor: null };
    }
    return json;
  }

  async getById(id: string): Promise<SidequestResponse> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}`,
    );
    return this.handleResponse<SidequestResponse>(response);
  }

  async deleteById(id: string): Promise<void> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}`,
      { method: "DELETE" },
    );
    await this.handleResponse(response);
  }

  async batchDelete(ids: string[]): Promise<{ deletedCount: number }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/batch-delete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      },
    );
    return this.handleResponse<{ deletedCount: number }>(response);
  }

  async share(id: string): Promise<{ shareToken: string }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}/share`,
      { method: "POST" },
    );
    return this.handleResponse<{ shareToken: string }>(response);
  }

  async activate(id: string): Promise<{ success: boolean }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}/activate`,
      { method: "POST" },
    );
    return this.handleResponse<{ success: boolean }>(response);
  }

  async deactivate(): Promise<{ success: boolean }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/deactivate`,
      { method: "POST" },
    );
    return this.handleResponse<{ success: boolean }>(response);
  }

  async getActive(): Promise<{
    active: boolean;
    sidequest?: SidequestResponse;
  }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/active`,
    );
    return this.handleResponse<{
      active: boolean;
      sidequest?: SidequestResponse;
    }>(response);
  }

  async checkin(
    sidequestId: string,
    objectiveId: string,
  ): Promise<{ success: boolean; checkedInAt?: string }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${sidequestId}/objectives/${objectiveId}/checkin`,
      { method: "POST" },
    );
    return this.handleResponse<{ success: boolean; checkedInAt?: string }>(
      response,
    );
  }

  async rate(
    id: string,
    rating: number,
    comment?: string,
  ): Promise<{ success: boolean; rating: number }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}/rate`,
      {
        method: "POST",
        body: JSON.stringify({ rating, ...(comment && { comment }) }),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse<{ success: boolean; rating: number }>(response);
  }

  async search(
    query: string,
    limit = 20,
  ): Promise<{ data: SidequestResponse[] }> {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
    });
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/search?${params}`,
    );
    return this.handleResponse<{ data: SidequestResponse[] }>(response);
  }

  async listCompleted(limit = 20): Promise<{ data: SidequestResponse[] }> {
    const params = new URLSearchParams({ limit: String(limit) });
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/completed?${params}`,
    );
    return this.handleResponse<{ data: SidequestResponse[] }>(response);
  }

  async browse(
    city: string,
    options?: {
      sort?: "popular" | "recent" | "top_rated";
      intention?: string;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ data: BrowseSidequestResponse[] }> {
    const params = new URLSearchParams({
      city: encodeURIComponent(city),
    });
    if (options?.sort) params.set("sort", options.sort);
    if (options?.intention) params.set("intention", options.intention);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.cursor) params.set("cursor", options.cursor);

    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/browse?${params}`,
    );
    return this.handleResponse<{ data: BrowseSidequestResponse[] }>(response);
  }

  async promote(id: string): Promise<SidequestResponse> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}/promote`,
      { method: "POST" },
    );
    return this.handleResponse<SidequestResponse>(response);
  }

  async adopt(id: string): Promise<SidequestResponse> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}/adopt`,
      { method: "POST" },
    );
    return this.handleResponse<SidequestResponse>(response);
  }

  async getPopularStops(city: string, limit = 15): Promise<PopularStop[]> {
    const params = new URLSearchParams({
      city: encodeURIComponent(city),
      limit: String(limit),
    });
    const response = await fetch(
      `${this.client.baseUrl}/api/public/sidequests/popular-stops?${params}`,
    );
    const json = await this.handleResponse<{ data: PopularStop[] }>(response);
    return json.data;
  }

  async prescribeQuest(params: {
    latitude: number;
    longitude: number;
    timezone?: string;
  }): Promise<{ jobId: string; streamUrl: string }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/prescribe`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse<{ jobId: string; streamUrl: string }>(response);
  }

  async prescribeWeekPack(params: {
    latitude: number;
    longitude: number;
    timezone?: string;
  }): Promise<{ jobId: string; streamUrl: string }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/prescribe-pack`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse<{ jobId: string; streamUrl: string }>(response);
  }

  async getComfortZone(): Promise<ComfortZoneResponse> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/comfort-zone`,
    );
    return this.handleResponse<ComfortZoneResponse>(response);
  }

  async getWorldSize(): Promise<WorldSizeResponse> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/world-size`,
    );
    return this.handleResponse<WorldSizeResponse>(response);
  }

  async setHomeAnchor(
    latitude: number,
    longitude: number,
  ): Promise<ComfortZoneResponse> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/home-anchor`,
      {
        method: "POST",
        body: JSON.stringify({ latitude, longitude }),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse<ComfortZoneResponse>(response);
  }

  async assessGoal(params: {
    goal: string;
  }): Promise<{
    specificity: number;
    feasibility: "actionable" | "ambitious" | "unfeasible" | "concerning";
    needsRefinement: boolean;
    refinedGoal: string | null;
    firstQuestion: string | null;
    redirectMessage: string | null;
    state: GoalRefinementState;
  }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/assess-goal`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse(response);
  }

  async refineGoal(params: {
    state: GoalRefinementState;
    response: string;
  }): Promise<{
    done: boolean;
    question: string | null;
    refinedGoal: string | null;
    state: GoalRefinementState;
  }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/refine-goal`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse(response);
  }

  async generateBarriers(params: {
    primaryGoal: string;
  }): Promise<{ barriers: { key: string; label: string; text: string }[] }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/generate-barriers`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse(response);
  }

  async generateFearLadder(params: {
    primaryGoal: string;
    goals: string[];
    barriers: string[];
    activities: string[];
  }): Promise<{ scenarios: { id: string; text: string; dimension: string }[]; dimensions: string[] }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/generate-fear-ladder`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse(response);
  }

  async updateComfortProfile(params: {
    pacePreference?: string;
    comfortProfile?: { comfortZone: string; barriers: string; goals: string; goalTags?: string[]; northStar?: string; primaryGoal?: string; targetDate?: string; goalLocation?: string };
    fearLadder?: { overallScore: number; dimensionScores: Record<string, number>; responses: Record<string, number>; scenarios?: { id: string; text: string; dimension: string }[]; dimensions?: string[] };
  }): Promise<ComfortZoneResponse> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/comfort-profile`,
      {
        method: "PUT",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse<ComfortZoneResponse>(response);
  }

  async updateObjectiveJournal(
    objectiveId: string,
    params: {
      journalEntry?: string;
      completedActivity?: string;
      photoUrl?: string;
      socialContext?: string;
    },
  ): Promise<{ success: boolean }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/objectives/${objectiveId}/journal`,
      {
        method: "PUT",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse<{ success: boolean }>(response);
  }

  async updateObjectivePrediction(
    objectiveId: string,
    params: {
      predictedAnxiety?: number;
      predictedDifficulty?: number;
      predictedOutcome?: string;
    },
  ): Promise<{ success: boolean }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/objectives/${objectiveId}/prediction`,
      {
        method: "PUT",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse<{ success: boolean }>(response);
  }

  async getGoalCheckIn(): Promise<{
    isDue: boolean;
    milestone: "early_momentum" | "midpoint" | "approaching" | "final_stretch" | "target_reached" | null;
    journalPrompt: string | null;
  }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/goal-check-in`,
      { method: "GET" },
    );
    return this.handleResponse(response);
  }

  async saveGoalReflection(params: {
    milestone: string;
    journalEntry: string;
    journalPrompt?: string;
    percentElapsed?: number;
    remainingDays?: number;
    completedQuestCount?: number;
  }): Promise<{ id: string }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/goal-reflection`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse(response);
  }

  async getGoalPacing(): Promise<{
    hasTimeline: boolean;
    percentElapsed?: number;
    remainingDays?: number;
    totalDays?: number;
    milestone?: string | null;
    completedQuestCount?: number;
    isPast?: boolean;
  }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/goal-pacing`,
      { method: "GET" },
    );
    return this.handleResponse(response);
  }
}

// Backward-compat aliases for files still using old names
export type ItineraryResponse = SidequestResponse;
export type ItineraryItemResponse = ObjectiveResponse;
export type BrowseItineraryResponse = BrowseSidequestResponse;
export interface PopularStop {
  venueName: string;
  venueCategory: string | null;
  emoji: string | null;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
  googleRating: number | null;
  frequency: number;
  completions: number;
  completionRate: number;
  score: number;
}
