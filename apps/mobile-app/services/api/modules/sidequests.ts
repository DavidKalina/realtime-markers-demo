import { BaseApiClient } from "../base/ApiClient";

export type CompletedVersion = "full" | "smaller" | "tiny";

export type CapacityTrack =
  | "ACTIVATION"
  | "PUBLIC_PRESENCE"
  | "NOVELTY_TOLERANCE"
  | "STAYING_POWER"
  | "RETURNABILITY"
  | "MICRO_INTERACTION"
  | "SOCIAL_EXTENSION"
  | "RECOVERY"
  | "IDENTITY_EVIDENCE";

export const CAPACITY_TRACK_LABELS: Record<CapacityTrack, string> = {
  ACTIVATION: "Activation",
  PUBLIC_PRESENCE: "Public Presence",
  NOVELTY_TOLERANCE: "Novelty Tolerance",
  STAYING_POWER: "Staying Power",
  RETURNABILITY: "Returnability",
  MICRO_INTERACTION: "Micro-Interaction",
  SOCIAL_EXTENSION: "Social Extension",
  RECOVERY: "Recovery",
  IDENTITY_EVIDENCE: "Identity Evidence",
};

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
  // Rep variants (Slice A)
  smallerRep?: string;
  tinyRep?: string;
  minViableWin?: string;
  exitRamp?: string;
  completedVersion?: CompletedVersion;
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
  questType?: string;
  challengeCategory?: string;
  isPublished?: boolean;
  timesAdopted?: number;
  strategyNote?: string;
  aiReflection?: string;
  // Capacity rep (Slice C)
  capacityTrack?: CapacityTrack;
  repIntent?: string;
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

export type RejectionReason =
  | "TOO_SOCIAL"
  | "TOO_FAR"
  | "TOO_PUBLIC"
  | "TOO_MUCH_EFFORT"
  | "NOT_MY_VIBE"
  | "BAD_TIMING"
  | "NEED_GENTLER";

export const REJECTION_REASONS: { value: RejectionReason; label: string }[] = [
  { value: "TOO_SOCIAL", label: "Too social" },
  { value: "TOO_FAR", label: "Too far" },
  { value: "TOO_PUBLIC", label: "Too public" },
  { value: "TOO_MUCH_EFFORT", label: "Too much effort" },
  { value: "NOT_MY_VIBE", label: "Not my vibe" },
  { value: "BAD_TIMING", label: "Bad timing" },
  { value: "NEED_GENTLER", label: "Need gentler" },
];

export class SidequestsModule {
  constructor(protected readonly client: BaseApiClient) {}

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
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests?${params}`,
    );
    const json = await response.json();
    if (Array.isArray(json)) {
      return { data: json, nextCursor: null };
    }
    return json;
  }

  async getById(id: string): Promise<SidequestResponse> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}`,
    );
    return this.client.handleResponse<SidequestResponse>(response);
  }

  async deleteById(id: string): Promise<void> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}`,
      { method: "DELETE" },
    );
    await this.client.handleResponse(response);
  }

  async batchDelete(ids: string[]): Promise<{ deletedCount: number }> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/batch-delete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      },
    );
    return this.client.handleResponse<{ deletedCount: number }>(response);
  }

  async share(id: string): Promise<{ shareToken: string }> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}/share`,
      { method: "POST" },
    );
    return this.client.handleResponse<{ shareToken: string }>(response);
  }

  async activate(id: string): Promise<{ success: boolean }> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}/activate`,
      { method: "POST" },
    );
    return this.client.handleResponse<{ success: boolean }>(response);
  }

  async deactivate(): Promise<{ success: boolean }> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/deactivate`,
      { method: "POST" },
    );
    return this.client.handleResponse<{ success: boolean }>(response);
  }

  async getActive(): Promise<{
    active: boolean;
    sidequest?: SidequestResponse;
  }> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/active`,
    );
    return this.client.handleResponse<{
      active: boolean;
      sidequest?: SidequestResponse;
    }>(response);
  }

  async checkin(
    sidequestId: string,
    objectiveId: string,
    location?: { latitude: number; longitude: number },
  ): Promise<{ success: boolean; checkedInAt?: string }> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${sidequestId}/objectives/${objectiveId}/checkin`,
      {
        method: "POST",
        ...(location
          ? {
              body: JSON.stringify(location),
              headers: { "Content-Type": "application/json" },
            }
          : {}),
      },
    );
    return this.client.handleResponse<{ success: boolean; checkedInAt?: string }>(
      response,
    );
  }

  async completeChallenge(
    sidequestId: string,
    objectiveId: string,
    params: {
      journalEntry: string;
      completedActivity?: string;
      socialContext?: string;
      completedVersion?: CompletedVersion;
    },
  ): Promise<{ success: boolean; checkedInAt?: string }> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${sidequestId}/objectives/${objectiveId}/complete-challenge`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.client.handleResponse<{ success: boolean; checkedInAt?: string }>(
      response,
    );
  }

  async rate(
    id: string,
    rating: number,
    comment?: string,
  ): Promise<{ success: boolean; rating: number }> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}/rate`,
      {
        method: "POST",
        body: JSON.stringify({ rating, ...(comment && { comment }) }),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.client.handleResponse<{ success: boolean; rating: number }>(response);
  }

  async search(
    query: string,
    limit = 20,
  ): Promise<{ data: SidequestResponse[] }> {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
    });
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/search?${params}`,
    );
    return this.client.handleResponse<{ data: SidequestResponse[] }>(response);
  }

  async listCompleted(limit = 20): Promise<{ data: SidequestResponse[] }> {
    const params = new URLSearchParams({ limit: String(limit) });
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/completed?${params}`,
    );
    return this.client.handleResponse<{ data: SidequestResponse[] }>(response);
  }

  async listUnrated(limit = 5): Promise<{ data: SidequestResponse[] }> {
    const params = new URLSearchParams({ limit: String(limit) });
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/unrated?${params}`,
    );
    return this.client.handleResponse<{ data: SidequestResponse[] }>(response);
  }

  async listPendingCapture(limit = 3): Promise<{ data: SidequestResponse[] }> {
    const params = new URLSearchParams({ limit: String(limit) });
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/pending-capture?${params}`,
    );
    return this.client.handleResponse<{ data: SidequestResponse[] }>(response);
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

    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/browse?${params}`,
    );
    return this.client.handleResponse<{ data: BrowseSidequestResponse[] }>(response);
  }

  async promote(id: string): Promise<SidequestResponse> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}/promote`,
      { method: "POST" },
    );
    return this.client.handleResponse<SidequestResponse>(response);
  }

  async getPopularStops(city: string, limit = 15): Promise<PopularStop[]> {
    const params = new URLSearchParams({
      city: encodeURIComponent(city),
      limit: String(limit),
    });
    const response = await fetch(
      `${this.client.baseUrl}/api/public/sidequests/popular-stops?${params}`,
    );
    const json = await this.client.handleResponse<{ data: PopularStop[] }>(response);
    return json.data;
  }

  async prescribeQuest(params: {
    latitude: number;
    longitude: number;
    timezone?: string;
    questType?: "venue" | "challenge";
    challengeCategory?: string;
  }): Promise<{ jobId: string; streamUrl: string }> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/prescribe`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.client.handleResponse<{ jobId: string; streamUrl: string }>(response);
  }

  async rejectQuest(
    id: string,
    params: {
      reason: RejectionReason;
      latitude: number;
      longitude: number;
      timezone?: string;
      note?: string;
    },
  ): Promise<{ jobId: string; streamUrl: string; rejectionId: string }> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}/reject`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.client.handleResponse<{ jobId: string; streamUrl: string; rejectionId: string }>(response);
  }

  async getComfortZone(): Promise<ComfortZoneResponse> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/comfort-zone`,
    );
    return this.client.handleResponse<ComfortZoneResponse>(response);
  }

  async getWorldSize(): Promise<WorldSizeResponse> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/world-size`,
    );
    return this.client.handleResponse<WorldSizeResponse>(response);
  }

  async setHomeAnchor(
    latitude: number,
    longitude: number,
  ): Promise<ComfortZoneResponse> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/home-anchor`,
      {
        method: "POST",
        body: JSON.stringify({ latitude, longitude }),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.client.handleResponse<ComfortZoneResponse>(response);
  }

  async generateBarriers(params: {
    primaryGoal: string;
  }): Promise<{ barriers: { key: string; label: string; text: string }[] }> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/generate-barriers`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.client.handleResponse(response);
  }

  async generateFearLadder(params: {
    primaryGoal: string;
    goals: string[];
    barriers: string[];
    activities: string[];
  }): Promise<{ scenarios: { id: string; text: string; dimension: string }[]; dimensions: string[] }> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/generate-fear-ladder`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.client.handleResponse(response);
  }

  async updateComfortProfile(params: {
    pacePreference?: string;
    comfortProfile?: { comfortZone: string; barriers: string; goals: string; goalKey?: string; goalTags?: string[]; primaryGoal?: string };
    fearLadder?: { overallScore: number; dimensionScores: Record<string, number>; responses: Record<string, number>; scenarios?: { id: string; text: string; dimension: string }[]; dimensions?: string[] };
    onboardingProfile?: { activities: string[] };
    socialSituation?: { ageRange: string; gender: string; timeInArea: string; currentSocialLife: string; lookingFor: string[]; workSituation: string; livingSituation: string; dailyRoutine?: string; transportation?: string; budget?: string };
    onboardingPhase?: number;
  }): Promise<ComfortZoneResponse> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/comfort-profile`,
      {
        method: "PUT",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.client.handleResponse<ComfortZoneResponse>(response);
  }

  async updateObjectiveJournal(
    objectiveId: string,
    params: {
      journalEntry?: string;
      completedActivity?: string;
      photoBase64?: string;
      socialContext?: string;
      wouldReturn?: boolean;
      completedVersion?: CompletedVersion;
    },
  ): Promise<{ success: boolean }> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/objectives/${objectiveId}/journal`,
      {
        method: "PUT",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.client.handleResponse<{ success: boolean }>(response);
  }

  async updateObjectivePrediction(
    objectiveId: string,
    params: {
      predictedAnxiety?: number;
      predictedDifficulty?: number;
      predictedOutcome?: string;
    },
  ): Promise<{ success: boolean }> {
    const response = await this.client.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/objectives/${objectiveId}/prediction`,
      {
        method: "PUT",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.client.handleResponse<{ success: boolean }>(response);
  }

}

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
