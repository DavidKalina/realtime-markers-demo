import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";
import {
  EventType,
  RSVP,
  RSVPCreateInput,
  RSVPUpdateInput,
} from "../base/types";
import { apiClient } from "../../ApiClient";

export type RSVPStatus = "GOING" | "NOT_GOING" | "MAYBE" | "PENDING";

export interface RSVPResponse {
  rsvped: boolean;
  rsvpCount: number;
  status: RSVPStatus;
  goingCount: number;
  notGoingCount: number;
  maybeCount: number;
}

export interface RSVPStats {
  total: number;
  going: number;
  notGoing: number;
  maybe: number;
  pending: number;
}

export interface RSVPDetails {
  eventId: string;
  userId: string;
  status: RSVPStatus;
  updatedAt: string;
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
  };
}

export class RSVPModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  /**
   * Toggle RSVP status for an event
   * @param eventId - ID of the event to RSVP to
   * @returns RSVP response with updated counts
   */
  async toggleRSVP(eventId: string): Promise<RSVPResponse> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/rsvp`;

    // First check current RSVP status
    const { isRsvped } = await this.isEventRsvped(eventId);

    // Toggle to the opposite status
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ status: isRsvped ? "NOT_GOING" : "GOING" }),
    });

    return this.handleResponse<RSVPResponse>(response);
  }

  /**
   * RSVP to an event with a specific status
   * @param eventId - ID of the event to RSVP to
   * @param status - RSVP status to set
   * @returns RSVP response with updated counts
   */
  async rsvpToEvent(
    eventId: string,
    status: RSVPStatus = "GOING",
  ): Promise<RSVPResponse> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/rsvp`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
    return this.handleResponse<RSVPResponse>(response);
  }

  /**
   * Cancel RSVP for an event
   * @param eventId - ID of the event to cancel RSVP for
   * @returns RSVP response with updated counts
   */
  async cancelRSVP(eventId: string): Promise<RSVPResponse> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/rsvp`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ status: "NOT_GOING" }),
    });
    return this.handleResponse<RSVPResponse>(response);
  }

  /**
   * Check if the current user has RSVPed to an event
   * @param eventId - ID of the event to check
   * @returns Object containing RSVP status
   */
  async isEventRsvped(
    eventId: string,
  ): Promise<{ isRsvped: boolean; status?: RSVPStatus }> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/rsvped`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{ isRsvped: boolean; status?: RSVPStatus }>(
      response,
    );
  }

  /**
   * Get all events the current user has RSVPed to
   * @param options - Pagination options
   * @returns Object containing RSVPed events and pagination info
   */
  async getRsvpedEvents(options?: {
    limit?: number;
    cursor?: string;
    status?: RSVPStatus;
  }): Promise<{
    events: EventType[];
    nextCursor?: string;
    stats: RSVPStats;
  }> {
    const queryParams = new URLSearchParams();

    if (options?.limit) queryParams.append("limit", options.limit.toString());
    if (options?.cursor) queryParams.append("cursor", options.cursor);
    if (options?.status) queryParams.append("status", options.status);

    const url = `${this.client.baseUrl}/api/events/rsvped?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);

    return this.handleResponse<{
      events: EventType[];
      nextCursor?: string;
      stats: RSVPStats;
    }>(response);
  }

  /**
   * Get RSVP details for an event
   * @param eventId - ID of the event to get RSVP details for
   * @param options - Pagination options
   * @returns Object containing RSVP details and pagination info
   */
  async getEventRSVPs(
    eventId: string,
    options?: {
      limit?: number;
      cursor?: string;
      status?: RSVPStatus;
    },
  ): Promise<{
    rsvps: RSVPDetails[];
    nextCursor?: string;
    stats: RSVPStats;
  }> {
    const queryParams = new URLSearchParams();

    if (options?.limit) queryParams.append("limit", options.limit.toString());
    if (options?.cursor) queryParams.append("cursor", options.cursor);
    if (options?.status) queryParams.append("status", options.status);

    const url = `${this.client.baseUrl}/api/events/${eventId}/rsvps?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);

    return this.handleResponse<{
      rsvps: RSVPDetails[];
      nextCursor?: string;
      stats: RSVPStats;
    }>(response);
  }

  /**
   * Get RSVP stats for an event
   * @param eventId - ID of the event to get RSVP stats for
   * @returns RSVP statistics
   */
  async getEventRSVPStats(eventId: string): Promise<RSVPStats> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/rsvps/stats`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<RSVPStats>(response);
  }

  /**
   * Get upcoming events the user has RSVPed to
   * @param options - Pagination options
   * @returns Object containing upcoming RSVPed events and pagination info
   */
  async getUpcomingRSVPs(options?: {
    limit?: number;
    cursor?: string;
  }): Promise<{
    events: EventType[];
    nextCursor?: string;
  }> {
    const queryParams = new URLSearchParams();

    if (options?.limit) queryParams.append("limit", options.limit.toString());
    if (options?.cursor) queryParams.append("cursor", options.cursor);

    const url = `${this.client.baseUrl}/api/events/rsvped/upcoming?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);

    return this.handleResponse<{
      events: EventType[];
      nextCursor?: string;
    }>(response);
  }

  async getRSVPs(eventId: string): Promise<RSVP[]> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/rsvps`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<RSVP[]>(response);
  }

  async createRSVP(eventId: string, input: RSVPCreateInput): Promise<RSVP> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/rsvps`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return this.handleResponse<RSVP>(response);
  }

  async updateRSVP(
    eventId: string,
    rsvpId: string,
    input: RSVPUpdateInput,
  ): Promise<RSVP> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/rsvps/${rsvpId}`;
    const response = await this.fetchWithAuth(url, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return this.handleResponse<RSVP>(response);
  }

  async deleteRSVP(eventId: string, rsvpId: string): Promise<void> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/rsvps/${rsvpId}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    await this.handleResponse<void>(response);
  }
}

// Export as singleton using the main ApiClient instance
export const rsvpModule = new RSVPModule(apiClient);
export default rsvpModule;
